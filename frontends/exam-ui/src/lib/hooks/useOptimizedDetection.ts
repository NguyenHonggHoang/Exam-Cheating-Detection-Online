import { useRef, useEffect, useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as blazeface from '@tensorflow-models/blazeface';
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection';
import { initializeTFBackend, warmUpModels } from '../utils/tfBackend';
import { calculateEyeAspectRatio, calculateHeadPose, isLookingAway, calculateIrisGaze, analyzeFaceQuality, calculateFaceDistance, getScreenMetrics, calculateEffectiveGaze, type GazeCalibration, type FaceQuality, type EffectiveGazeResult, LOOK_AWAY_THRESHOLDS } from '../utils/faceAnalysis';
import { HeadPose } from '../types/detection';
import { ViolationStateMachine, ViolationType as SMViolationType } from '../utils/violationStateMachine';
import { compositeDetector, type CompositeViolation } from '../utils/compositeViolationDetector';
import { CircularVideoBuffer, useCircularBuffer } from '../utils/circularVideoBuffer';
import {
    uploadEvidence,
    captureCanvasAsBlob,
    uploadSnapshot,
    triggerEgressRecording,
    type IncidentType
} from '../utils/minioUpload';
import {
    ViolationType,
    DetectionResult,
    DetectionConfig,
    DEFAULT_CONFIG,
    DetectionThresholds
} from '../types/violations';
import { usePreSuspicionDetection } from './usePreSuspicionDetection';

export interface UseOptimizedDetectionOptions {
    sessionId: string;
    stream: MediaStream | null;
    roomName?: string;
    enabled?: boolean;
    config?: Partial<DetectionConfig>;
    onViolation?: (type: ViolationType, severity: string) => void;
    onEvidenceUploaded?: (type: ViolationType, url: string) => void;
    useEgress?: boolean;
    enablePreSuspicion?: boolean;
    onPreSuspicionTriggered?: (pattern: string, confidence: number) => void;
}

/**
 * Optimized Detection Hook - Production Ready
 * 
 * UPDATED: Now accepts external stream from useSharedStream
 * UPDATED: Uses hybrid evidence collection (snapshot client + video Egress)
 * 
 * Features:
 * - Dual canvas (320x240 inference, 640x480 display)
 * - Throttled detection (5 FPS)
 * - State machine for violations
 * - Hybrid evidence: Snapshots from client, Video clips from LiveKit Egress
 * - MinIO presigned upload
 * - Upload throttling
 */
export function useOptimizedDetection(options: UseOptimizedDetectionOptions) {
    const {
        sessionId,
        stream,
        roomName,
        enabled = true,
        config = {},
        onViolation,
        onEvidenceUploaded,
        useEgress = true,
        enablePreSuspicion = true,
        onPreSuspicionTriggered
    } = options;

    // Egress recording throttle: 30 seconds between triggers for same session
    const lastEgressTriggerRef = useRef<number>(0);
    const EGRESS_TRIGGER_COOLDOWN_MS = 30000;

    const preSuspicion = usePreSuspicionDetection({
        sessionId,
        stream,
        enabled: enabled && enablePreSuspicion,
        onPreSuspicionTriggered: async (result) => {
            if (onPreSuspicionTriggered) {
                onPreSuspicionTriggered(result.pattern, result.confidence);
            }

            // Use refs to get current values (avoid stale closure)
            const currentRoomName = roomNameRef.current;
            const currentSessionId = sessionIdRef.current;
            const now = Date.now();
            const timeSinceLastEgress = now - lastEgressTriggerRef.current;

            console.log(`[PreSuspicion] onPreSuspicionTriggered: pattern=${result.pattern}, confidence=${result.confidence.toFixed(1)}, useEgress=${useEgress}, roomName=${currentRoomName}, timeSinceLastEgress=${(timeSinceLastEgress / 1000).toFixed(1)}s`);

            // Check throttle: skip if egress was triggered recently
            if (useEgress && currentRoomName && result.confidence >= 35 && timeSinceLastEgress >= EGRESS_TRIGGER_COOLDOWN_MS) {
                console.log(`[PreSuspicion] Triggering early Egress recording: pattern=${result.pattern}, confidence=${result.confidence.toFixed(2)}`);
                try {
                    // Normalize pattern - strip ESCALATED_ prefix to avoid duplicate incident types
                    // (PRE_SUSPICIOUS_ESCALATED_phone_below would be redundant with PRE_SUSPICIOUS_phone_below)
                    const basePattern = result.pattern.replace('ESCALATED_', '');
                    const egressResult = await triggerEgressRecording({
                        sessionId: currentSessionId,
                        roomName: currentRoomName,
                        violationType: `PRE_SUSPICIOUS_${basePattern}` as any,
                        durationSeconds: 15
                    });
                    if (egressResult.success) {
                        console.log(`[PreSuspicion] ✅ Egress recording started: ${egressResult.egressId}`);
                        lastEgressTriggerRef.current = now; // Update throttle timestamp
                    } else {
                        console.warn(`[PreSuspicion] Egress failed: ${egressResult.error}`);
                    }
                } catch (err) {
                    console.error('[PreSuspicion] Failed to trigger Egress:', err);
                }
            } else if (timeSinceLastEgress < EGRESS_TRIGGER_COOLDOWN_MS) {
                console.log(`[PreSuspicion] Skipped Egress: throttled (${((EGRESS_TRIGGER_COOLDOWN_MS - timeSinceLastEgress) / 1000).toFixed(1)}s remaining)`);
            } else {
                console.log(`[PreSuspicion] Skipped Egress: useEgress=${useEgress}, roomName=${currentRoomName}, confidence=${result.confidence}`);
            }
        }
    });

    const fullConfig: DetectionConfig = {
        ...DEFAULT_CONFIG,
        ...config,
        thresholds: {
            ...DEFAULT_CONFIG.thresholds,
            ...(config.thresholds || {})
        }
    };

    const videoRef = useRef<HTMLVideoElement>(null);
    const displayCanvasRef = useRef<HTMLCanvasElement>(null);
    const inferenceCanvasRef = useRef<HTMLCanvasElement>(null);

    const blazeFaceModelRef = useRef<blazeface.BlazeFaceModel | null>(null);
    const faceLandmarksModelRef = useRef<faceLandmarksDetection.FaceLandmarksDetector | null>(null);

    const stateMachineRef = useRef<ViolationStateMachine | null>(null);

    const { createClip, status: bufferStatus } = useCircularBuffer({
        stream,
        options: {
            maxDurationMs: 10000,
            videoBitsPerSecond: 250000
        }
    });

    const [tfReady, setTfReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [detectionResult, setDetectionResult] = useState<DetectionResult | null>(null);
    const [uploading, setUploading] = useState(false);

    // REMOVED: Inline pre-suspicion state (now handled by usePreSuspicionDetection hook)
    // const [inlinePreSuspicionActive, setInlinePreSuspicionActive] = useState(false);
    // const [inlinePreSuspicionResult, setInlinePreSuspicionResult] = useState(null);

    const calibrationRef = useRef<GazeCalibration | null>(null);

    const lookAwayStartRef = useRef<number | null>(null);
    const lastLookAwayLogRef = useRef<number>(0);
    const lastPoseLogRef = useRef<number>(0);

    // REMOVED: Inline pre-suspicion refs (now handled by usePreSuspicionDetection hook)
    // const preSuspicionTriggeredRef = useRef<boolean>(false);
    // const preSuspicionStartTimeRef = useRef<number | null>(null);
    // const lastPreSuspicionLogRef = useRef<number>(0);

    const roomNameRef = useRef<string | undefined>(roomName);
    const sessionIdRef = useRef<string>(sessionId);

    const animationIdRef = useRef<number | null>(null);
    const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const collectEvidenceRef = useRef<((type: ViolationType, action: 'snapshot' | 'clip', result: DetectionResult) => Promise<void>) | null>(null);

    useEffect(() => {
        roomNameRef.current = roomName;
        sessionIdRef.current = sessionId;
    }, [roomName, sessionId]);

    useEffect(() => {
        let isMounted = true;

        const initModels = async () => {
            try {
                console.log('[Detection] Initializing TensorFlow.js...');

                await initializeTFBackend();

                let blazeFaceModel: blazeface.BlazeFaceModel | null = null;
                let faceLandmarksModel: faceLandmarksDetection.FaceLandmarksDetector | null = null;

                if (fullConfig.mode === 'lightweight' || fullConfig.mode === 'balanced') {
                    blazeFaceModel = await blazeface.load();
                    console.log('[Detection] ✅ BlazeFace loaded');
                }

                if (fullConfig.mode === 'balanced' || fullConfig.mode === 'accurate') {
                    faceLandmarksModel = await faceLandmarksDetection.createDetector(
                        faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh,
                        {
                            runtime: 'mediapipe',
                            solutionPath: 'https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh',
                            maxFaces: 3,
                            refineLandmarks: true
                        }
                    );
                    console.log('[Detection] ✅ MediaPipe FaceMesh loaded');
                }

                if (!isMounted) return;

                blazeFaceModelRef.current = blazeFaceModel;
                faceLandmarksModelRef.current = faceLandmarksModel;

                // Warm up models
                if (blazeFaceModel || faceLandmarksModel) {
                    await warmUpModels({
                        blazeFace: blazeFaceModel,
                        faceLandmarks: faceLandmarksModel
                    });
                }

                // Initialize state machine
                stateMachineRef.current = new ViolationStateMachine();

                setTfReady(true);
                console.log(`[Detection] ✅ Ready in ${fullConfig.mode} mode`);

            } catch (err) {
                console.error('[Detection] Initialization failed:', err);
                if (isMounted) {
                    setError('Failed to initialize AI models');
                }
            }
        };

        initModels();

        return () => {
            isMounted = false;
            stateMachineRef.current?.destroy();
        };
    }, [fullConfig.mode]);

    useEffect(() => {
        if (!stream || !videoRef.current) return;

        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => {
            console.error('[Detection] Failed to play video:', err);
        });

    }, [stream]);

    useEffect(() => {
        if (!enabled || !tfReady || !stream) return;

        let isMounted = true;

        const renderLoop = () => {
            if (!isMounted) return;

            const video = videoRef.current;
            const displayCanvas = displayCanvasRef.current;
            const inferenceCanvas = inferenceCanvasRef.current;

            if (!video || !displayCanvas || !inferenceCanvas) {
                animationIdRef.current = requestAnimationFrame(renderLoop);
                return;
            }

            if (video.readyState < video.HAVE_CURRENT_DATA) {
                animationIdRef.current = requestAnimationFrame(renderLoop);
                return;
            }

            // Configure canvases
            if (displayCanvas.width !== 640 || displayCanvas.height !== 480) {
                displayCanvas.width = 640;
                displayCanvas.height = 480;
            }

            if (inferenceCanvas.width !== 320 || inferenceCanvas.height !== 240) {
                inferenceCanvas.width = 320;
                inferenceCanvas.height = 240;
            }

            // Draw to both canvases
            const displayCtx = displayCanvas.getContext('2d');
            const inferenceCtx = inferenceCanvas.getContext('2d');

            if (displayCtx && inferenceCtx) {
                // Display canvas: high res for UI
                displayCtx.drawImage(video, 0, 0, 640, 480);

                // Inference canvas: low res for AI
                inferenceCtx.drawImage(video, 0, 0, 320, 240);
            }

            animationIdRef.current = requestAnimationFrame(renderLoop);
        };

        animationIdRef.current = requestAnimationFrame(renderLoop);

        return () => {
            isMounted = false;
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
            }
        };
    }, [enabled, tfReady, stream]);

    // Throttled detection (5 FPS)
    const runDetection = useCallback(async () => {
        if (!inferenceCanvasRef.current || !stateMachineRef.current) return;

        try {
            const startTime = performance.now();

            // Run detection on small canvas
            let faceCount = 0;
            let confidence = 0;
            let headPose = null;
            let eyeState = null;

            // BlazeFace for fast face counting
            let faces: any[] = []; // Keep track of faces
            if (blazeFaceModelRef.current) {
                faces = await blazeFaceModelRef.current.estimateFaces(
                    inferenceCanvasRef.current,
                    false
                );
                faceCount = faces.length;
                if (faces.length > 0) {
                    const prob = faces[0].probability;
                    confidence = Array.isArray(prob) ? prob[0] : (typeof prob === 'number' ? prob : 0);
                }
            }

            // MediaPipe for detailed analysis (only if 1 face)
            let landmarks: { x: number; y: number; z: number }[] | null = null;
            let irisGaze = null;
            let faceQuality: FaceQuality | null = null;

            if (faceCount === 1 && faceLandmarksModelRef.current) {
                const predictions = await faceLandmarksModelRef.current.estimateFaces(
                    inferenceCanvasRef.current
                );

                if (predictions.length > 0) {
                    landmarks = predictions[0].keypoints.map(kp => ({
                        x: kp.x,
                        y: kp.y,
                        z: (kp as any).z || 0
                    }));

                    headPose = calculateHeadPose(landmarks, null);
                    const rawEyeState = calculateEyeAspectRatio(landmarks);

                    // Calculate iris gaze for enhanced look-away detection
                    irisGaze = calculateIrisGaze(landmarks);

                    // Analyze face quality (brightness, distance, size)
                    faceQuality = analyzeFaceQuality(landmarks, displayCanvasRef.current);

                    // Log face quality warnings occasionally
                    if (faceQuality.warnings.length > 0 && Math.random() < 0.05) {
                        console.warn(`[Detection] Face quality warnings:`, faceQuality.warnings);
                    }

                    // Convert EyeState to DetectionResult format
                    eyeState = {
                        leftEyeOpen: rawEyeState.left.isOpen,
                        rightEyeOpen: rawEyeState.right.isOpen,
                        aspectRatio: (rawEyeState.left.aspectRatio + rawEyeState.right.aspectRatio) / 2
                    };
                }
            }

            // Calculate face distance (if we have landmarks)
            let faceDistance = null;
            if (landmarks && videoRef.current) {
                const video = videoRef.current;
                faceDistance = calculateFaceDistance(
                    landmarks,
                    video.videoWidth,
                    video.videoHeight,
                    calibrationRef.current?.baselineDistance
                );
            }

            // Get screen metrics (cache this since it doesn't change often)
            const screenMetrics = getScreenMetrics();

            // Calculate comprehensive effective gaze with all metrics
            // This uses dynamic iris compensation based on face distance and screen metrics
            const effectiveGazeResult = headPose ? calculateEffectiveGaze(headPose, {
                irisGaze,
                faceDistance: faceDistance?.relative,
                screenMetrics,
                calibration: calibrationRef.current
            }) : null;

            // Extract simple effectiveGaze for DetectionResult (for UI display)
            const effectiveGaze = effectiveGazeResult ? {
                pitch: effectiveGazeResult.effectivePitch,
                yaw: effectiveGazeResult.effectiveYaw
            } : null;

            const result: DetectionResult = {
                faceCount,
                confidence,
                headPose,
                eyeState,
                irisGaze: irisGaze ? {
                    horizontalGaze: irisGaze.horizontalGaze,
                    verticalGaze: irisGaze.verticalGaze
                } : null,
                effectiveGaze,
                faceDistance,
                screenMetrics,
                timestamp: Date.now()
            };

            setDetectionResult(result);

            await processViolations(result, irisGaze);

            // ========================================
            // PRE-SUSPICION DETECTION INTEGRATION
            // Feed Kappa-corrected gaze data to pre-suspicion detector
            // ========================================
            if (headPose && preSuspicion.processFrame) {
                // Construct face box from BlazeFace or landmarks
                let faceBox = null;
                if (faces && faces.length > 0) {
                    const face = faces[0];
                    const topLeft = face.topLeft as number[];
                    const bottomRight = face.bottomRight as number[];
                    faceBox = {
                        x: topLeft[0],
                        y: topLeft[1],
                        width: bottomRight[0] - topLeft[0],
                        height: bottomRight[1] - topLeft[1]
                    };
                } else if (landmarks && landmarks.length > 0) {
                    // Fallback: estimate from landmarks
                    const xs = landmarks.map(l => l.x);
                    const ys = landmarks.map(l => l.y);
                    const minX = Math.min(...xs);
                    const maxX = Math.max(...xs);
                    const minY = Math.min(...ys);
                    const maxY = Math.max(...ys);
                    faceBox = {
                        x: minX,
                        y: minY,
                        width: maxX - minX,
                        height: maxY - minY
                    };
                }

                if (faceBox) {
                    const isBlinking = eyeState
                        ? (!eyeState.leftEyeOpen || !eyeState.rightEyeOpen)
                        : false;
                    const brightness = faceQuality?.brightness || 128;

                    // Call processFrame with Kappa-corrected irisGaze
                    preSuspicion.processFrame(
                        headPose,
                        irisGaze,       // ← Now includes Kappa correction!
                        faceBox,
                        isBlinking,
                        brightness
                    );
                }
            }

            if (faceQuality && !faceQuality.isGoodQuality && Math.random() < 0.02) {
                console.log(`[Detection] Face quality warnings (detection still running):`, faceQuality.warnings);
            }

            const currentRoomName = roomNameRef.current;
            console.log(`[PreSuspicion CHECK] enablePreSuspicion=${enablePreSuspicion}, effectiveGaze=${!!effectiveGaze}, roomName=${currentRoomName}`);

            if (enablePreSuspicion && effectiveGaze && currentRoomName) {
                // NOTE: Pre-suspicion detection is now handled by usePreSuspicionDetection hook
                // which uses preSuspicionDetector.ts with improved multi-condition logic:
                // - Multi-condition weighted scoring (pitch, gaze, distance, blink)
                // - WINDOW_DURATION: 1.8s sustained
                // - CONFIDENCE_THRESHOLD: 35 (see preSuspicionDetector.ts:117)
                // - Escalation logic (2+ incidents → violation)
                //
                // The inline logic below was REMOVED to avoid duplication and conflicting thresholds.
                // See preSuspicion object from usePreSuspicionDetection for status.

                // Log effective gaze for debugging (throttled)
                if (Math.random() < 0.05) {
                    console.log(
                        `[PreSuspicion:EffectiveGaze] ` +
                        `pitch=${effectiveGaze.pitch.toFixed(1)}° yaw=${effectiveGaze.yaw.toFixed(1)}° ` +
                        `isViolation=${effectiveGazeResult?.isViolation ?? 'N/A'} ` +
                        `(handled by usePreSuspicionDetection hook)`
                    );
                }
            }

            const elapsed = performance.now() - startTime;
            if (elapsed > 100) {
                console.warn(`[Detection] Slow inference: ${elapsed.toFixed(1)}ms`);
            }

        } catch (error) {
            console.error('[Detection] Error:', error);
        }
    }, []);

    const processViolations = useCallback(async (
        result: DetectionResult,
        irisGaze?: ReturnType<typeof calculateIrisGaze>
    ) => {
        if (!stateMachineRef.current) return;

        const violations: ViolationType[] = [];

        if (result.faceCount > 1 && fullConfig.enabledViolations.includes('MULTIPLE_FACES')) {
            violations.push('MULTIPLE_FACES');
        } else if (result.faceCount === 0 && fullConfig.enabledViolations.includes('NO_FACE')) {
            violations.push('NO_FACE');
        }

        if (result.headPose && fullConfig.enabledViolations.includes('LOOKING_AWAY')) {
            const faceDistanceRelative = result.faceDistance?.relative;
            const screenMetrics = result.screenMetrics || undefined;
            const lookingAway = isLookingAway(
                result.headPose,
                irisGaze,
                calibrationRef.current,
                faceDistanceRelative,
                screenMetrics
            );

            const now = Date.now();

            if (now - lastPoseLogRef.current > 5000) {
                lastPoseLogRef.current = now;
                const irisInfo = irisGaze
                    ? ` iris_h=${irisGaze.horizontalGaze.toFixed(2)} iris_v=${irisGaze.verticalGaze.toFixed(2)}`
                    : ' (no iris)';
                const distInfo = faceDistanceRelative
                    ? ` dist=${faceDistanceRelative.toFixed(2)}x`
                    : '';
                const calibInfo = calibrationRef.current?.boundaries
                    ? ` [calibrated: pitch=${calibrationRef.current.boundaries.minPitch}/${calibrationRef.current.boundaries.maxPitch}, yaw=${calibrationRef.current.boundaries.minYaw}/${calibrationRef.current.boundaries.maxYaw}]`
                    : ' [default thresholds]';
                console.log(`[Detection] HeadPose: pitch=${result.headPose.pitch.toFixed(1)}° yaw=${result.headPose.yaw.toFixed(1)}°${irisInfo}${distInfo}${calibInfo} → lookingAway=${lookingAway}`);
            }

            if (lookingAway) {
                if (lookAwayStartRef.current === null) {
                    lookAwayStartRef.current = now;
                }

                const durationMs = now - lookAwayStartRef.current;
                const durationSeconds = durationMs / 1000;
                const sustainedThreshold = LOOK_AWAY_THRESHOLDS.SUSTAINED_SECONDS;

                if (durationSeconds >= sustainedThreshold) {
                    violations.push('LOOKING_AWAY');

                    if (now - lastLookAwayLogRef.current > 1000) {
                        const irisInfo = irisGaze
                            ? ` iris_h=${irisGaze.horizontalGaze.toFixed(2)} iris_v=${irisGaze.verticalGaze.toFixed(2)}`
                            : '';
                        console.warn(`[Detection] ⚠️ LOOK AWAY (${durationSeconds.toFixed(1)}s): pitch=${result.headPose.pitch.toFixed(1)}° yaw=${result.headPose.yaw.toFixed(1)}°${irisInfo}`);
                        lastLookAwayLogRef.current = now;
                    }
                }
            } else {
                if (lookAwayStartRef.current !== null) {
                    lookAwayStartRef.current = null;
                }
            }
        }

        for (const violationType of violations) {
            const { action, tracker, stateChanged } = stateMachineRef.current.onViolationDetected(
                violationType as SMViolationType,
                result.timestamp
            );

            // Only callback when state actually changed or first time
            if (stateChanged && onViolation) {
                onViolation(violationType, tracker.state);
            }

            // Collect evidence if needed
            if (action && !uploading && collectEvidenceRef.current) {
                console.log(`[Detection] Collecting evidence: ${action} for ${violationType}`);
                collectEvidenceRef.current(violationType, action, result);
            }
        }

        // Clear violations that are no longer detected
        for (const type of fullConfig.enabledViolations) {
            if (!violations.includes(type)) {
                stateMachineRef.current.onNoViolation(type as SMViolationType);
            }
        }


    }, [fullConfig.enabledViolations, onViolation, uploading]);

    const collectEvidence = useCallback(async (
        violationType: ViolationType,
        evidenceType: 'snapshot' | 'clip',
        result: DetectionResult
    ) => {
        if (!displayCanvasRef.current || !stateMachineRef.current) return;

        setUploading(true);

        try {
            console.log(`[Evidence] Collecting ${evidenceType} for ${violationType}`);

            if (evidenceType === 'snapshot') {
                const blob = await captureCanvasAsBlob(displayCanvasRef.current, 0.85);
                console.log(`[Evidence] Uploading snapshot: ${blob.size} bytes`);

                const uploadResult = await uploadSnapshot(
                    sessionId,
                    blob,
                    violationType as IncidentType
                );

                if (uploadResult.success && uploadResult.url) {
                    stateMachineRef.current.onEvidenceUploaded(
                        violationType as SMViolationType,
                        uploadResult.url,
                        'snapshot'
                    );
                    console.log(`[Evidence] ✅ Snapshot uploaded: ${uploadResult.url}`);
                    if (onEvidenceUploaded) {
                        onEvidenceUploaded(violationType, uploadResult.url);
                    }
                }

            } else if (evidenceType === 'clip') {
                if (useEgress && roomName) {
                    console.log(`[Evidence] Triggering Egress recording for ${violationType}`);

                    const requestedDuration = Math.ceil(
                        (fullConfig.thresholds.clipPreBuffer + fullConfig.thresholds.clipPostBuffer) / 1000
                    );
                    const egressDuration = Math.max(requestedDuration, 10);

                    const egressResult = await triggerEgressRecording({
                        sessionId,
                        roomName,
                        violationType,
                        durationSeconds: egressDuration
                    });

                    if (egressResult.success && egressResult.egressId) {
                        console.log(`[Evidence] ✅ Egress recording started: ${egressResult.egressId}`);
                        stateMachineRef.current.onEvidenceUploaded(
                            violationType as SMViolationType,
                            `egress:${egressResult.egressId}`,
                            'clip'
                        );

                        if (displayCanvasRef.current) {
                            try {
                                const snapshotBlob = await captureCanvasAsBlob(displayCanvasRef.current, 0.85);
                                const snapshotResult = await uploadSnapshot(
                                    sessionId,
                                    snapshotBlob,
                                    violationType as IncidentType
                                );
                                if (snapshotResult.success) {
                                    console.log(`[Evidence] ✅ Backup snapshot uploaded: ${snapshotResult.url}`);
                                }
                            } catch (snapshotErr) {
                                console.warn(`[Evidence] Backup snapshot failed:`, snapshotErr);
                            }
                        }
                    } else {
                        console.warn(`[Evidence] Egress failed, falling back to local recording: ${egressResult.error}`);
                        await collectLocalClip(violationType, result);
                    }
                } else {
                    await collectLocalClip(violationType, result);
                }
            }

        } catch (error) {
            console.error(`[Evidence] Failed to collect ${evidenceType}:`, error);
        } finally {
            setUploading(false);
        }
    }, [sessionId, roomName, useEgress, fullConfig.thresholds, onEvidenceUploaded]);

    const collectLocalClip = useCallback(async (
        violationType: ViolationType,
        result: DetectionResult
    ) => {
        if (!displayCanvasRef.current || !stateMachineRef.current) return;

        try {
            let blob: Blob;

            try {
                blob = await createClip(
                    fullConfig.thresholds.clipPreBuffer,
                    fullConfig.thresholds.clipPostBuffer
                );
            } catch (clipError) {
                console.warn(`[Evidence] Local clip failed, falling back to snapshot:`, clipError);
                blob = await captureCanvasAsBlob(displayCanvasRef.current, 0.85);
            }

            const tracker = stateMachineRef.current.getState(violationType as SMViolationType);

            const { url: publicUrl, objectKey } = await uploadEvidence(
                sessionId,
                blob,
                'clip',
                violationType,
                tracker.state,
                {
                    detectionResult: result,
                    consecutiveCount: tracker.count,
                    firstDetectedAt: tracker.firstDetected
                }
            );

            stateMachineRef.current.onEvidenceUploaded(
                violationType as SMViolationType,
                publicUrl,
                'clip'
            );

            console.log(`[Evidence] ✅ Local clip uploaded: ${publicUrl}`);

            if (onEvidenceUploaded) {
                onEvidenceUploaded(violationType, publicUrl);
            }

        } catch (error) {
            console.error(`[Evidence] Local clip upload failed:`, error);
        }
    }, [sessionId, createClip, fullConfig.thresholds, onEvidenceUploaded]);

    useEffect(() => {
        collectEvidenceRef.current = collectEvidence;
    }, [collectEvidence]);

    useEffect(() => {
        if (!enabled || !tfReady) return;

        const interval = setInterval(runDetection, 200);
        detectionIntervalRef.current = interval;

        return () => {
            if (detectionIntervalRef.current) {
                clearInterval(detectionIntervalRef.current);
            }
        };
    }, [enabled, tfReady, runDetection]);

    const getStats = useCallback(() => {
        return stateMachineRef.current?.getStats() || null;
    }, []);

    return {
        // Refs
        videoRef,
        displayCanvasRef,
        inferenceCanvasRef,

        // State
        tfReady,
        error,
        detectionResult,
        uploading,

        bufferStatus,

        preSuspicion: {
            isCalibrating: preSuspicion.isCalibrating,
            calibrationProgress: preSuspicion.calibrationProgress,
            calibrationValidation: preSuspicion.calibrationValidation,
            hasBaseline: preSuspicion.hasBaseline,
            // Using hook's detection result (correct property names)
            isActive: preSuspicion.preSuspicionActive,
            result: preSuspicion.preSuspicionResult,
            microBufferStatus: preSuspicion.microBufferStatus,
            startCalibration: preSuspicion.startCalibration,
            finishCalibration: preSuspicion.finishCalibration,
            temporal: preSuspicion.temporal
        },

        getStats,

        captureSnapshot: async () => {
            console.log('[captureSnapshot] Attempting to capture snapshot...');
            console.log('[captureSnapshot] displayCanvasRef.current:', !!displayCanvasRef.current);
            console.log('[captureSnapshot] detectionResult:', !!detectionResult);

            // Retry logic: wait for canvas to be available (max 3 attempts, 100ms apart)
            let canvas = displayCanvasRef.current;
            let attempts = 0;
            const maxAttempts = 3;

            while (!canvas && attempts < maxAttempts) {
                attempts++;
                console.log(`[captureSnapshot] Canvas not ready, retry ${attempts}/${maxAttempts}...`);
                await new Promise(resolve => setTimeout(resolve, 100));
                canvas = displayCanvasRef.current;
            }

            if (!canvas) {
                console.error('[captureSnapshot] No display canvas available after retries');
                throw new Error('Display canvas not available for screenshot capture');
            }

            try {
                const blob = await captureCanvasAsBlob(canvas);
                console.log('[captureSnapshot] Blob captured, size:', blob.size);

                if (blob.size === 0) {
                    throw new Error('Captured blob is empty');
                }

                const result = await uploadEvidence(
                    sessionId,
                    blob,
                    'snapshot',
                    'PRE_SUSPICIOUS_phone_below', // Changed from phone_beside - phone_beside is now disabled
                    'SUSPICIOUS',
                    { detectionResult: detectionResult || { timestamp: Date.now() } }
                );
                console.log('[captureSnapshot] Upload result:', result);

                if (!result) {
                    throw new Error('Upload returned empty result');
                }

                return result;
            } catch (err) {
                console.error('[captureSnapshot] Failed to capture/upload:', err);
                throw err;
            }
        }
    };
}

