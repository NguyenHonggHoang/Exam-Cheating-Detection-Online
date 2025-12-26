import { useRef, useEffect, useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import { initializeTFBackend, warmUpModels } from '../utils/tfBackend';
import { calculateEyeAspectRatio, calculateHeadPose, isLookingAway } from '../utils/faceAnalysis';
import { DetectionState, HeadPoseCalibration } from '../types/detection';

export interface UseTensorFlowWebcamOptions {
    onDetection?: (state: DetectionState) => void;
    intervalMs?: number;
    enabled?: boolean;
    calibration?: HeadPoseCalibration | null;
    onCalibrationSample?: (headPose: any) => void;
}

export function useTensorFlowWebcam(options: UseTensorFlowWebcamOptions = {}) {
    const {
        onDetection,
        intervalMs = 200,
        enabled = true,
        calibration,
        onCalibrationSample
    } = options;

    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationIdRef = useRef<number | null>(null);
    const detectionIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const blazeFaceModelRef = useRef<blazeface.BlazeFaceModel | null>(null);
    const faceLandmarksModelRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);

    const [tfReady, setTfReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [detectionState, setDetectionState] = useState<DetectionState>({
        faceCount: 0,
        confidence: 0,
        headPose: null,
        eyeState: null,
        landmarks: null,
        timestamp: Date.now()
    });

    // Initialize TensorFlow.js backend and models
    useEffect(() => {
        let isMounted = true;

        const initModels = async () => {
            try {
                // Initialize backend (WebGL → WASM fallback)
                await initializeTFBackend();

                // Load BlazeFace model for fast face detection
                const blazeFaceModel = await blazeface.load();

                // Load MediaPipe FaceLandmarks for detailed detection
                const faceLandmarksModel = await faceLandmarksDetection.createDetector(
                    faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
                    {
                        runtime: 'mediapipe',
                        solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
                        maxFaces: 3,
                        refineLandmarks: true
                    }
                );

                if (!isMounted) return;

                blazeFaceModelRef.current = blazeFaceModel;
                faceLandmarksModelRef.current = faceLandmarksModel;

                // Warm up models
                await warmUpModels({
                    blazeFace: blazeFaceModel,
                    faceLandmarks: faceLandmarksModel
                });

                setTfReady(true);
                console.log('✅ TensorFlow.js models loaded successfully');
            } catch (err) {
                console.error('Error initializing TensorFlow.js models:', err);
                if (isMounted) {
                    setError('Failed to initialize AI models');
                }
            }
        };

        initModels();

        return () => {
            isMounted = false;
        };
    }, []);

    // Initialize webcam
    useEffect(() => {
        if (!enabled || !tfReady) return;

        let isMounted = true;

        const startWebcam = async () => {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: 'user'
                    },
                    audio: false
                });

                if (!isMounted) {
                    stream.getTracks().forEach(track => track.stop());
                    return;
                }

                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    streamRef.current = stream;
                    await videoRef.current.play();
                }
            } catch (error) {
                console.error('Error accessing webcam:', error);
                if (isMounted) {
                    setError('Cannot access webcam');
                }
            }
        };

        startWebcam();

        return () => {
            isMounted = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, [enabled, tfReady]);

    // Render video to canvas (continuous for preview)
    useEffect(() => {
        if (!enabled || !tfReady) return;

        let isMounted = true;

        const renderFrame = () => {
            if (!isMounted || !videoRef.current || !canvasRef.current) return;

            const video = videoRef.current;
            const canvas = canvasRef.current;

            if (video.readyState < video.HAVE_CURRENT_DATA) {
                animationIdRef.current = requestAnimationFrame(renderFrame);
                return;
            }

            // Set canvas size to match video
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 480;
            }

            const ctx = canvas.getContext('2d');
            if (!ctx) {
                animationIdRef.current = requestAnimationFrame(renderFrame);
                return;
            }

            // Draw video frame
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            if (isMounted) {
                animationIdRef.current = requestAnimationFrame(renderFrame);
            }
        };

        animationIdRef.current = requestAnimationFrame(renderFrame);

        return () => {
            isMounted = false;
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
            }
        };
    }, [enabled, tfReady]);

    // Run detection at intervals
    const runDetection = useCallback(async () => {
        if (!videoRef.current || !blazeFaceModelRef.current || !faceLandmarksModelRef.current) {
            return;
        }

        const video = videoRef.current;
        if (video.readyState < video.HAVE_CURRENT_DATA) return;

        try {
            // Run BlazeFace for fast face counting
            const faces = await blazeFaceModelRef.current.estimateFaces(video, false);
            const faceCount = faces.length;

            let confidence = 0;
            if (faces.length > 0) {
                const prob = faces[0].probability;
                confidence = Array.isArray(prob) ? prob[0] : (typeof prob === 'number' ? prob : 0);
            }

            let newState: DetectionState = {
                faceCount,
                confidence,
                headPose: null,
                eyeState: null,
                landmarks: null,
                timestamp: Date.now()
            };

            // If exactly one face, run detailed analysis
            if (faceCount === 1) {
                const predictions = await faceLandmarksModelRef.current.estimateFaces(video);

                if (predictions.length > 0) {
                    const prediction = predictions[0];
                    const keypoints = prediction.keypoints;

                    // Convert keypoints to our format
                    const landmarks = keypoints.map(kp => ({
                        x: kp.x,
                        y: kp.y,
                        z: (kp as any).z || 0
                    }));

                    // Calculate head pose
                    const headPose = calculateHeadPose(landmarks, calibration);

                    // If calibrating, send sample
                    if (onCalibrationSample) {
                        onCalibrationSample(headPose);
                    }

                    // Calculate eye state (blink detection)
                    const eyeState = calculateEyeAspectRatio(landmarks);

                    newState = {
                        ...newState,
                        headPose,
                        eyeState,
                        landmarks
                    };
                }
            }

            setDetectionState(newState);

            if (onDetection) {
                onDetection(newState);
            }
        } catch (error) {
            console.error('Detection error:', error);
        }
    }, [calibration, onCalibrationSample, onDetection]);

    // Set up detection interval
    useEffect(() => {
        if (!enabled || !tfReady) return;

        const interval = setInterval(runDetection, intervalMs);
        detectionIntervalRef.current = interval;

        return () => {
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
            }
        };
    }, [enabled, tfReady, intervalMs, runDetection]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
            }
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
            }
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }
        };
    }, []);

    return {
        videoRef,
        canvasRef,
        detectionState,
        tfReady,
        error
    };
}
