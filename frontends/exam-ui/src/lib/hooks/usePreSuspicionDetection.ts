/**
 * Pre-Suspicion Detection Hook
 * 
 * Integrates pre-suspicion detection with the main detection flow.
 * Monitors for phone-prep patterns and triggers micro-buffer recording.
 * Now includes temporal pattern analysis for repeated behaviors.
 * 
 * Usage:
 * const { preSuspicionResult, microBufferStatus, calibrationProgress, temporalRiskScore } = usePreSuspicionDetection({
 *   sessionId,
 *   stream,
 *   enabled,
 *   headPose,
 *   irisGaze,
 *   faceBox,
 *   isBlinking
 * });
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { HeadPose } from '../types/detection';
import { IrisGaze } from '../utils/faceAnalysis';
import {
    CalibrationCollector,
    PreSuspicionDetector,
    PreSuspicionResult,
    BaselineData,
    CalibrationValidation
} from '../utils/preSuspicionDetector';
import {
    MicroBuffer,
    MicroBufferStatus,
    SuspicionType
} from '../utils/microBuffer';
import { uploadClip } from '../utils/minioUpload';
import { useTemporalAnalysis } from './useTemporalAnalysis';

// ========== Types ==========

export interface UsePreSuspicionOptions {
    sessionId: string;
    stream: MediaStream | null;
    enabled?: boolean;
    onPreSuspicionTriggered?: (result: PreSuspicionResult) => void;
    onMicroBufferUploaded?: (url: string) => void;
}

export interface PreSuspicionState {
    isCalibrating: boolean;
    calibrationProgress: number;
    calibrationValidation: CalibrationValidation | null;
    hasBaseline: boolean;
    preSuspicionActive: boolean;
    preSuspicionResult: PreSuspicionResult | null;
    microBufferStatus: MicroBufferStatus;
}

// ========== Hook ==========

export function usePreSuspicionDetection(options: UsePreSuspicionOptions) {
    const {
        sessionId,
        stream,
        enabled = true,
        onPreSuspicionTriggered,
        onMicroBufferUploaded
    } = options;

    // Temporal pattern analysis
    const temporalAnalysis = useTemporalAnalysis({
        sessionId,
        enabled,
        analysisInterval: 30000,  // Analyze every 30s
        onRiskScoreChange: (score, redFlags) => {
            console.log(`[TemporalAnalysis] Risk score: ${score}, flags: ${redFlags.join(', ')}`);
        }
    });

    // Refs
    const calibrationCollectorRef = useRef<CalibrationCollector | null>(null);
    const preSuspicionDetectorRef = useRef<PreSuspicionDetector | null>(null);
    const microBufferRef = useRef<MicroBuffer | null>(null);
    const uploadingRef = useRef(false);
    const preSuspicionStartTimeRef = useRef<number | null>(null);

    // Throttle callback to prevent firing every detection frame
    const lastCallbackTriggerRef = useRef<number>(0);
    const CALLBACK_THROTTLE_MS = 30000; // 30 seconds between callback triggers

    // Use ref to track enabled state to avoid stale closure issues
    const enabledRef = useRef(enabled);
    useEffect(() => {
        enabledRef.current = enabled;
    }, [enabled]);

    // State
    const [state, setState] = useState<PreSuspicionState>({
        isCalibrating: false,
        calibrationProgress: 0,
        calibrationValidation: null,
        hasBaseline: false,
        preSuspicionActive: false,
        preSuspicionResult: null,
        microBufferStatus: {
            isActive: false,
            isRecording: false,
            chunkCount: 0,
            bytesRecorded: 0,
            currentQuality: 'default'
        }
    });

    // Initialize components
    useEffect(() => {
        calibrationCollectorRef.current = new CalibrationCollector();
        preSuspicionDetectorRef.current = new PreSuspicionDetector();
        microBufferRef.current = new MicroBuffer({
            maxDurationMs: 5000,
            chunkDurationMs: 500
        });

        // Check for existing baseline in sessionStorage
        const savedBaseline = sessionStorage.getItem(`pre_suspicion_baseline_${sessionId}`);
        if (savedBaseline) {
            try {
                const baseline = JSON.parse(savedBaseline) as BaselineData;
                preSuspicionDetectorRef.current.setBaseline(baseline);
                setState(s => ({ ...s, hasBaseline: true }));
                console.log('[PreSuspicion] Loaded saved baseline');
            } catch (e) {
                console.warn('[PreSuspicion] Failed to load saved baseline');
            }
        }

        return () => {
            microBufferRef.current?.stop();
        };
    }, [sessionId]);


    // Use Ref to track state for processFrame (avoids stale closures without re-creating function)
    const stateRef = useRef(state);

    // Update ref whenever state changes
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // Custom setState wrapper to keep ref in sync immediately for synchronous logic if needed
    // (Though useEffect handling above is usually sufficient, explicit sync is safer for rapid updates)
    const updateState = useCallback((update: (prev: PreSuspicionState) => PreSuspicionState) => {
        setState(prev => {
            const next = update(prev);
            stateRef.current = next;
            return next;
        });
    }, []);

    /**
     * Start calibration
     */
    const startCalibration = useCallback(() => {
        calibrationCollectorRef.current = new CalibrationCollector();
        preSuspicionDetectorRef.current = new PreSuspicionDetector();
        microBufferRef.current = new MicroBuffer();

        updateState(s => ({
            ...s,
            isCalibrating: true,
            calibrationProgress: 0,
            hasBaseline: false
        }));

        console.log('[PreSuspicion] Calibration started');
    }, []); // Removed updateState dependency as it's stable

    /**
     * Stop calibration and calculate baseline
     */
    const finishCalibration = useCallback(() => {
        if (!calibrationCollectorRef.current || !preSuspicionDetectorRef.current) return false;

        calibrationCollectorRef.current.stop();
        const baseline = calibrationCollectorRef.current.calculateBaseline();

        if (baseline) {
            preSuspicionDetectorRef.current.setBaseline(baseline);

            // Save to sessionStorage
            sessionStorage.setItem(
                `pre_suspicion_baseline_${sessionId}`,
                JSON.stringify(baseline)
            );

            updateState(s => ({
                ...s,
                isCalibrating: false,
                hasBaseline: true,
                calibrationProgress: 100
            }));

            console.log('[PreSuspicion] Calibration complete:', baseline);
            return true;
        }

        updateState(s => ({ ...s, isCalibrating: false }));
        console.warn('[PreSuspicion] Calibration failed - not enough samples');
        return false;
    }, [sessionId]); // Removed updateState

    /**
     * Upload micro-buffer video to backend for analysis
     */
    const uploadMicroBuffer = useCallback(async () => {
        const microBuffer = microBufferRef.current;
        if (!microBuffer || uploadingRef.current) return;

        const blob = microBuffer.stop();
        if (!blob || blob.size < 1000) {
            console.log('[PreSuspicion] Micro-buffer too small, skipping upload');
            return;
        }

        uploadingRef.current = true;

        try {
            console.log(`[PreSuspicion] Uploading micro-buffer: ${(blob.size / 1024).toFixed(1)}KB`);

            const result = await uploadClip(sessionId, blob, 'PHONE_USAGE' as any);

            if (result.success && result.url && result.objectKey) {
                console.log(`[PreSuspicion] Micro-buffer uploaded: ${result.url}`);
                onMicroBufferUploaded?.(result.url);

                // Queue for pre-suspicion analysis worker (screen glow detection)
                try {
                    const { sessionsApi } = await import('@/api/sessions');
                    // Use ref for latest state
                    const currentState = stateRef.current;
                    await sessionsApi.queuePreSuspicionAnalysis({
                        sessionId,
                        objectKey: result.objectKey,
                        publicUrl: result.url,
                        pattern: (currentState.preSuspicionResult?.pattern?.replace('ESCALATED_', '') || 'none') as 'phone_below' | 'phone_beside' | 'none',
                        confidence: currentState.preSuspicionResult?.confidence || 0,
                        timestamp: Date.now(),
                        durationMs: 5000,
                        fileSize: blob.size
                    });
                    console.log(`[PreSuspicion] Queued for screen glow analysis`);
                } catch (queueError) {
                    console.warn('[PreSuspicion] Failed to queue for analysis:', queueError);
                }
            }

        } catch (error) {
            console.error('[PreSuspicion] Micro-buffer upload failed:', error);
        } finally {
            uploadingRef.current = false;
            const currentMB = microBufferRef.current;
            setState(s => ({
                ...s,
                microBufferStatus: currentMB?.getStatus() ?? s.microBufferStatus
            }));
        }
    }, [sessionId, onMicroBufferUploaded]);

    /**
     * Process a detection frame for pre-suspicion signals
     * Call this from the main detection loop
     */
    const processFrame = useCallback((
        headPose: HeadPose | null,
        irisGaze: IrisGaze | null,
        faceBox: { x: number; y: number; width: number; height: number } | null,
        isBlinking: boolean,
        brightness: number = 128
    ) => {
        // Use ref value to get current enabled state (avoid stale closure)
        const isEnabled = enabledRef.current;
        const currentState = stateRef.current; // Access latest state via ref

        // Debug: Log every 20th frame to trace input values
        if (Math.random() < 0.05) {
            console.log(`[PreSuspicion:processFrame] INPUT: enabled=${isEnabled}, headPose=${headPose ? `pitch=${headPose.pitch.toFixed(1)}, yaw=${headPose.yaw.toFixed(1)}` : 'null'}, faceBox=${faceBox ? 'ok' : 'null'}, active=${currentState.preSuspicionActive}`);
        }

        if (!isEnabled || !headPose || !faceBox) {
            return;
        }

        const collector = calibrationCollectorRef.current;
        const detector = preSuspicionDetectorRef.current;
        const microBuffer = microBufferRef.current;

        // During calibration: collect samples and validate
        if (currentState.isCalibrating && collector) {
            // Real-time validation
            const validation = collector.validateRealtime(headPose, faceBox, brightness);

            // Only add sample if validation passes
            if (validation.valid) {
                collector.addSample(headPose, irisGaze, faceBox, brightness, isBlinking);
            }

            const progress = collector.getProgress();

            updateState(s => ({
                ...s,
                calibrationProgress: progress,
                calibrationValidation: validation
            }));

            // Auto-complete calibration when done
            if (collector.isComplete()) {
                finishCalibration();
            }

            return;
        }

        // After calibration: detect pre-suspicion patterns
        if (detector) {
            const result = detector.analyze(headPose, irisGaze, faceBox, isBlinking);

            // Debug: Log analyze result (throttled)
            if (Math.random() < 0.05) {
                console.log(`[PreSuspicion:analyze] RESULT: isActive=${result.isActive}, confidence=${result.confidence.toFixed(1)}, pattern=${result.pattern}, stateActive=${currentState.preSuspicionActive}`);
            }

            // Track state transitions for temporal analysis
            if (result.isActive !== currentState.preSuspicionActive) {
                if (result.isActive) {
                    // Pre-suspicion started
                    console.log(`[PreSuspicion] ⚠️ TRIGGERED: pattern=${result.pattern}, confidence=${result.confidence.toFixed(1)}`);
                    preSuspicionStartTimeRef.current = Date.now();
                    temporalAnalysis.recordPreSuspicion(result.confidence);
                } else {
                    // Pre-suspicion ended - record duration
                    if (preSuspicionStartTimeRef.current) {
                        const duration = Date.now() - preSuspicionStartTimeRef.current;
                        console.log(`[PreSuspicion] Ended: duration=${(duration / 1000).toFixed(1)}s`);

                        // Record as head-down event based on pattern
                        if (currentState.preSuspicionResult?.pattern === 'phone_below') {
                            temporalAnalysis.recordHeadDown(duration, currentState.preSuspicionResult.confidence);
                        }

                        preSuspicionStartTimeRef.current = null;
                    }
                }

                updateState(s => ({
                    ...s,
                    // FORCE UPDATE: Ensure isActive matches detector result exactly
                    preSuspicionActive: result.isActive,
                    preSuspicionResult: result
                }));

                // Handle escalation to violation - ONLY fire escalated callback, not normal
                const shouldEscalate = (result as any).shouldEscalateToViolation;

                // THROTTLE: Only fire callback if 30s has passed since last trigger
                const now = Date.now();
                const timeSinceLastCallback = now - lastCallbackTriggerRef.current;
                const shouldFireCallback = timeSinceLastCallback >= CALLBACK_THROTTLE_MS;

                if (result.isActive && onPreSuspicionTriggered && shouldFireCallback) {
                    lastCallbackTriggerRef.current = now; // Update throttle timestamp BEFORE firing

                    if (shouldEscalate) {
                        // ESCALATION: Only fire escalated callback to avoid duplicate incidents
                        console.warn(
                            `[PreSuspicion:ESCALATION] 🚨 ĐÃ LEO THANG THÀNH VI PHẠM! ` +
                            `pattern=${result.pattern} confidence=${result.confidence.toFixed(0)}`
                        );
                        onPreSuspicionTriggered({
                            ...result,
                            isEscalated: true,
                            pattern: `ESCALATED_${result.pattern}` as any
                        });
                    } else {
                        // Normal pre-suspicion (not escalated)
                        console.log(`[PreSuspicion] Triggering callback: pattern=${result.pattern}, confidence=${result.confidence.toFixed(1)}`);
                        onPreSuspicionTriggered(result);
                    }
                } else if (result.isActive && !shouldFireCallback) {
                    console.log(`[PreSuspicion] ⏳ Callback throttled: ${((CALLBACK_THROTTLE_MS - timeSinceLastCallback) / 1000).toFixed(1)}s remaining`);
                }
            } else if (result.isActive && result.confidence !== currentState.preSuspicionResult?.confidence) {
                // If still active but confidence changed, update result (without logging trigger)
                updateState(s => ({
                    ...s,
                    preSuspicionResult: result
                }));
            }

            // Handle micro-buffer based on pre-suspicion state
            if (result.isActive && stream && microBuffer) {
                // Determine quality based on pattern
                // Only phone_below pattern is active now
                const quality: SuspicionType = result.pattern === 'phone_below'
                    ? 'illumination_spike'
                    : 'default';

                // Activate micro-buffer
                if (!microBuffer.getStatus().isActive) {
                    microBuffer.activate(stream, quality);
                    console.log(`[PreSuspicion] Micro-buffer activated: ${quality}`);
                }

                updateState(s => ({
                    ...s,
                    microBufferStatus: microBuffer.getStatus()
                }));

            } else if (!result.isActive && microBuffer?.getStatus().isActive) {
                // Pre-suspicion ended - upload micro-buffer
                uploadMicroBuffer();
            }
        }
    }, [
        enabled,
        // Removed state.* deps to ensure stable function identity
        // Only depend on refs and stable callbacks
        stream,
        finishCalibration,
        onPreSuspicionTriggered,
        uploadMicroBuffer // uploadMicroBuffer is stable-ish (depends on uploadingRef)
    ]);



    /**
     * Reset pre-suspicion state
     */
    const reset = useCallback(() => {
        preSuspicionDetectorRef.current?.reset();
        microBufferRef.current?.stop();

        setState(s => ({
            ...s,
            preSuspicionActive: false,
            preSuspicionResult: null,
            microBufferStatus: {
                isActive: false,
                isRecording: false,
                chunkCount: 0,
                bytesRecorded: 0,
                currentQuality: 'default'
            }
        }));
    }, []);

    return {
        // State
        ...state,

        // Temporal analysis
        temporal: {
            riskScore: temporalAnalysis.riskScore,
            redFlags: temporalAnalysis.redFlags,
            eventCount: temporalAnalysis.eventCount,
            answerCount: temporalAnalysis.answerCount,
            recordAnswer: temporalAnalysis.recordAnswer,
            recordMicroPause: temporalAnalysis.recordMicroPause,
            recordTypingSpeed: temporalAnalysis.recordTypingSpeed,
            getAnalysis: temporalAnalysis.getAnalysis,
            getAverageTypingSpeed: temporalAnalysis.getAverageTypingSpeed
        },

        // Actions
        startCalibration,
        finishCalibration,
        processFrame,
        uploadMicroBuffer,
        reset,

        // Utilities
        getBaseline: () => preSuspicionDetectorRef.current?.getBaseline() ?? null
    };
}



export default usePreSuspicionDetection;
