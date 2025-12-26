/**
 * useFaceQuality Hook
 * 
 * React hook for real-time face quality detection during exam verification.
 * Uses TensorFlow.js face-landmarks-detection for face analysis.
 * 
 * Features:
 * - Real-time face quality metrics
 * - Oval frame positioning check
 * - Lighting and sharpness analysis
 * - Capture functionality with quality validation
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import '@mediapipe/face_mesh';

import {
    FaceQualityMetrics,
    FaceBoundingBox,
    QUALITY_THRESHOLDS,
    calculateFaceSizePercent,
    isFaceInOvalFrame,
    calculateBrightness,
    calculateContrast,
    calculateSharpness,
    calculateQualityScore,
    getQualityLevel,
    buildSuggestions,
    drawFaceGuideFrame,
    drawDimmedOverlay,
    FACE_FRAME_CONFIG,
} from '@/lib/utils/faceQuality';
import { calculateHeadPose, calculateEyeAspectRatio } from '@/lib/utils/faceAnalysis';
import type { HeadPose } from '@/lib/types/detection';

interface UseFaceQualityOptions {
    videoRef: React.RefObject<HTMLVideoElement>;
    canvasRef: React.RefObject<HTMLCanvasElement>;
    enabled: boolean;
    targetFPS?: number;
    showGuideFrame?: boolean;
    showDimmedOverlay?: boolean;
}

interface UseFaceQualityReturn {
    // State
    metrics: FaceQualityMetrics | null;
    isReady: boolean;
    isAnalyzing: boolean;
    error: string | null;

    // Computed
    isQualityOk: boolean;
    qualityLevel: 'excellent' | 'good' | 'acceptable' | 'poor' | 'none';
    suggestions: string[];

    // Actions
    capture: () => Promise<Blob | null>;
    reset: () => void;
}

// Default empty metrics
const createEmptyMetrics = (): FaceQualityMetrics => ({
    faceDetected: false,
    faceCount: 0,
    faceBoundingBox: null,
    faceInFrame: false,
    faceCentered: false,
    faceSizeOk: false,
    faceSizePercent: 0,
    lightingOk: false,
    brightness: 0,
    contrast: 0,
    sharpnessOk: false,
    sharpness: 0,
    faceFrontal: false,
    headPose: null,
    eyesVisible: false,
    eyesOpen: false,
    overallQuality: 'poor',
    qualityScore: 0,
    passesThreshold: false,
    suggestions: ['Đang khởi tạo...'],
});

export function useFaceQuality({
    videoRef,
    canvasRef,
    enabled,
    targetFPS = 10,
    showGuideFrame = true,
    showDimmedOverlay = true,
}: UseFaceQualityOptions): UseFaceQualityReturn {

    const [metrics, setMetrics] = useState<FaceQualityMetrics | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const modelRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);
    const analysisIntervalRef = useRef<number | null>(null);
    const lastAnalysisTimeRef = useRef<number>(0);

    // Load model
    useEffect(() => {
        if (!enabled) return;

        const loadModel = async () => {
            try {
                setError(null);
                console.log('[FaceQuality] Loading face detection model...');

                const model = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh;
                const detector = await faceLandmarksDetection.createDetector(model, {
                    runtime: 'mediapipe',
                    refineLandmarks: true,
                    solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
                });

                modelRef.current = detector;
                setIsReady(true);
                console.log('[FaceQuality] Model loaded successfully');

            } catch (err) {
                console.error('[FaceQuality] Failed to load model:', err);
                setError('Không thể tải mô hình nhận diện khuôn mặt');
            }
        };

        loadModel();

        return () => {
            if (modelRef.current) {
                modelRef.current = null;
            }
        };
    }, [enabled]);

    // Analyze frame
    const analyzeFrame = useCallback(async () => {
        if (!modelRef.current || !videoRef.current || !canvasRef.current) return;
        if (!enabled || !isReady) return;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        if (!ctx || video.readyState < 2) return;

        // Throttle analysis
        const now = performance.now();
        if (now - lastAnalysisTimeRef.current < 1000 / targetFPS) return;
        lastAnalysisTimeRef.current = now;

        setIsAnalyzing(true);

        try {
            // Set canvas size to match video
            if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                canvas.width = video.videoWidth || 640;
                canvas.height = video.videoHeight || 480;
            }

            // Draw video frame to canvas
            ctx.drawImage(video, 0, 0);

            // Get image data for lighting/sharpness analysis
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Detect faces
            const faces = await modelRef.current.estimateFaces(video);

            let newMetrics: FaceQualityMetrics;

            if (faces.length === 0) {
                newMetrics = {
                    ...createEmptyMetrics(),
                    suggestions: ['Không phát hiện khuôn mặt. Đưa mặt vào khung hình.'],
                };
            } else {
                const face = faces[0];
                const keypoints = face.keypoints;

                // Calculate bounding box from keypoints
                const xs = keypoints.map(kp => kp.x);
                const ys = keypoints.map(kp => kp.y);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);

                const faceBbox: FaceBoundingBox = {
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY,
                };

                // Calculate metrics
                const landmarks = keypoints.map(kp => ({
                    x: kp.x,
                    y: kp.y,
                    z: (kp as any).z || 0,
                }));

                const headPose = calculateHeadPose(landmarks, null);
                const eyeState = calculateEyeAspectRatio(landmarks);

                const faceSizePercent = calculateFaceSizePercent(faceBbox, canvas.width, canvas.height);
                const faceInFrame = isFaceInOvalFrame(faceBbox, canvas.width, canvas.height);

                // Calculate face center for centering check
                const faceCenterX = (faceBbox.x + faceBbox.width / 2) / canvas.width;
                const faceCenterY = (faceBbox.y + faceBbox.height / 2) / canvas.height;
                const faceCentered =
                    Math.abs(faceCenterX - FACE_FRAME_CONFIG.centerX) < QUALITY_THRESHOLDS.CENTER_TOLERANCE_X &&
                    Math.abs(faceCenterY - FACE_FRAME_CONFIG.centerY) < QUALITY_THRESHOLDS.CENTER_TOLERANCE_Y;

                const faceSizeOk =
                    faceSizePercent >= QUALITY_THRESHOLDS.MIN_FACE_SIZE_PERCENT &&
                    faceSizePercent <= QUALITY_THRESHOLDS.MAX_FACE_SIZE_PERCENT;

                // Calculate image quality metrics on face region
                const brightness = calculateBrightness(imageData, faceBbox);
                const contrast = calculateContrast(imageData, faceBbox);
                const sharpness = calculateSharpness(imageData, faceBbox);

                const lightingOk =
                    brightness >= QUALITY_THRESHOLDS.MIN_BRIGHTNESS &&
                    brightness <= QUALITY_THRESHOLDS.MAX_BRIGHTNESS &&
                    contrast >= QUALITY_THRESHOLDS.MIN_CONTRAST;

                const sharpnessOk = sharpness >= QUALITY_THRESHOLDS.MIN_SHARPNESS;

                const faceFrontal =
                    Math.abs(headPose.pitch) <= QUALITY_THRESHOLDS.MAX_PITCH &&
                    Math.abs(headPose.yaw) <= QUALITY_THRESHOLDS.MAX_YAW &&
                    Math.abs(headPose.roll) <= QUALITY_THRESHOLDS.MAX_ROLL;

                const eyesOpen =
                    eyeState.left.isOpen &&
                    eyeState.right.isOpen;

                const eyesVisible =
                    eyeState.left.aspectRatio > 0 &&
                    eyeState.right.aspectRatio > 0;

                const partialMetrics = {
                    faceDetected: true,
                    faceCount: faces.length,
                    faceInFrame,
                    faceCentered,
                    faceSizeOk,
                    lightingOk,
                    sharpnessOk,
                    faceFrontal,
                    eyesVisible,
                    eyesOpen,
                    brightness,
                    headPose,
                };

                const qualityScore = calculateQualityScore(partialMetrics);
                const overallQuality = getQualityLevel(qualityScore);
                const suggestions = buildSuggestions(partialMetrics);
                const passesThreshold = qualityScore >= QUALITY_THRESHOLDS.MIN_QUALITY_SCORE;

                newMetrics = {
                    faceDetected: true,
                    faceCount: faces.length,
                    faceBoundingBox: faceBbox,
                    faceInFrame,
                    faceCentered,
                    faceSizeOk,
                    faceSizePercent,
                    lightingOk,
                    brightness,
                    contrast,
                    sharpnessOk,
                    sharpness,
                    faceFrontal,
                    headPose,
                    eyesVisible,
                    eyesOpen,
                    overallQuality,
                    qualityScore,
                    passesThreshold,
                    suggestions,
                };
            }

            setMetrics(newMetrics);

            // Draw overlays
            if (showDimmedOverlay) {
                drawDimmedOverlay(ctx, canvas.width, canvas.height);
            }

            if (showGuideFrame) {
                drawFaceGuideFrame(
                    ctx,
                    canvas.width,
                    canvas.height,
                    newMetrics.faceDetected ? newMetrics.overallQuality : 'none'
                );
            }

        } catch (err) {
            console.error('[FaceQuality] Analysis error:', err);
        } finally {
            setIsAnalyzing(false);
        }
    }, [enabled, isReady, videoRef, canvasRef, targetFPS, showGuideFrame, showDimmedOverlay]);

    // Start/stop analysis loop
    useEffect(() => {
        if (!enabled || !isReady) {
            if (analysisIntervalRef.current) {
                clearInterval(analysisIntervalRef.current);
                analysisIntervalRef.current = null;
            }
            return;
        }

        // Run analysis loop
        const intervalMs = 1000 / targetFPS;
        analysisIntervalRef.current = window.setInterval(analyzeFrame, intervalMs);

        return () => {
            if (analysisIntervalRef.current) {
                clearInterval(analysisIntervalRef.current);
                analysisIntervalRef.current = null;
            }
        };
    }, [enabled, isReady, targetFPS, analyzeFrame]);

    // Capture high-quality image
    const capture = useCallback(async (): Promise<Blob | null> => {
        if (!canvasRef.current || !videoRef.current) return null;

        const video = videoRef.current;
        const captureCanvas = document.createElement('canvas');
        captureCanvas.width = video.videoWidth || 640;
        captureCanvas.height = video.videoHeight || 480;

        const ctx = captureCanvas.getContext('2d');
        if (!ctx) return null;

        // Draw clean frame (no overlays)
        ctx.drawImage(video, 0, 0);

        return new Promise((resolve) => {
            captureCanvas.toBlob(
                (blob) => resolve(blob),
                'image/jpeg',
                0.92  // High quality for face recognition
            );
        });
    }, [canvasRef, videoRef]);

    // Reset state
    const reset = useCallback(() => {
        setMetrics(null);
        setError(null);
        lastAnalysisTimeRef.current = 0;
    }, []);

    // Computed values
    const isQualityOk = metrics?.passesThreshold ?? false;
    const qualityLevel = metrics?.overallQuality ?? 'none';
    const suggestions = metrics?.suggestions ?? [];

    return {
        metrics,
        isReady,
        isAnalyzing,
        error,
        isQualityOk,
        qualityLevel,
        suggestions,
        capture,
        reset,
    };
}

export default useFaceQuality;
