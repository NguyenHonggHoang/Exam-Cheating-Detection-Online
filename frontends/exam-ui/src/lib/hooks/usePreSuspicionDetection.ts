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

    /**
     * Start calibration phase (30s baseline collection)
     */
    const startCalibration = useCallback(() => {
        if (!calibrationCollectorRef.current) return;

        calibrationCollectorRef.current.start();
        setState(s => ({
            ...s,
            isCalibrating: true,
            calibrationProgress: 0,
            hasBaseline: false
        }));

        console.log('[PreSuspicion] Calibration started');
    }, []);

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

            setState(s => ({
                ...s,
                isCalibrating: false,
                hasBaseline: true,
                calibrationProgress: 100
            }));

            console.log('[PreSuspicion] Calibration complete:', baseline);
            return true;
        }

        setState(s => ({ ...s, isCalibrating: false }));
        console.warn('[PreSuspicion] Calibration failed - not enough samples');
        return false;
    }, [sessionId]);

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
        if (!enabled || !headPose || !faceBox) return;

        const collector = calibrationCollectorRef.current;
        const detector = preSuspicionDetectorRef.current;
        const microBuffer = microBufferRef.current;

        // During calibration: collect samples and validate
        if (state.isCalibrating && collector) {
            // Real-time validation
            const validation = collector.validateRealtime(headPose, faceBox, brightness);

            // Only add sample if validation passes
            if (validation.valid) {
                collector.addSample(headPose, irisGaze, faceBox, brightness, isBlinking);
            }

            const progress = collector.getProgress();

            setState(s => ({
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
        // NOTE: Now works WITHOUT calibration - uses fixed absolute thresholds
        if (detector) {
            const result = detector.analyze(headPose, irisGaze, faceBox, isBlinking);

            // Track state transitions for temporal analysis
            if (result.isActive !== state.preSuspicionActive) {
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
                        if (state.preSuspicionResult?.pattern === 'phone_below') {
                            temporalAnalysis.recordHeadDown(duration, state.preSuspicionResult.confidence);
                        }

                        preSuspicionStartTimeRef.current = null;
                    }
                }

                setState(s => ({
                    ...s,
                    preSuspicionActive: result.isActive,
                    preSuspicionResult: result
                }));

                // Trigger callback
                if (result.isActive && onPreSuspicionTriggered) {
                    onPreSuspicionTriggered(result);
                }

                // Handle escalation to violation
                if ((result as any).shouldEscalateToViolation) {
                    console.warn(
                        `[PreSuspicion:ESCALATION] 🚨 ĐÃ LEO THANG THÀNH VI PHẠM! ` +
                        `pattern=${result.pattern} confidence=${result.confidence.toFixed(0)}`
                    );
                    // Trigger as full violation - can be passed to violation handler
                    if (onPreSuspicionTriggered) {
                        onPreSuspicionTriggered({
                            ...result,
                            isEscalated: true,
                            pattern: `ESCALATED_${result.pattern}` as any
                        });
                    }
                }
            }

            // Handle micro-buffer based on pre-suspicion state
            if (result.isActive && stream && microBuffer) {
                // Determine quality based on pattern
                let quality: SuspicionType = 'default';
                if (result.pattern === 'phone_below') {
                    quality = 'illumination_spike'; // Need clarity for glow detection
                } else if (result.pattern === 'phone_beside') {
                    quality = 'motion_detected'; // Need FPS for motion
                }

                // Activate micro-buffer
                if (!microBuffer.getStatus().isActive) {
                    microBuffer.activate(stream, quality);
                    console.log(`[PreSuspicion] Micro-buffer activated: ${quality}`);
                }

                setState(s => ({
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
        state.isCalibrating,
        state.hasBaseline,
        state.preSuspicionActive,
        stream,
        finishCalibration,
        onPreSuspicionTriggered
    ]);

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
                    await sessionsApi.queuePreSuspicionAnalysis({
                        sessionId,
                        objectKey: result.objectKey,
                        publicUrl: result.url,
                        pattern: (state.preSuspicionResult?.pattern?.replace('ESCALATED_', '') || 'none') as 'phone_below' | 'phone_beside' | 'none',
                        confidence: state.preSuspicionResult?.confidence || 0,
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
            setState(s => ({
                ...s,
                microBufferStatus: microBuffer?.getStatus() ?? s.microBufferStatus
            }));
        }
    }, [sessionId, onMicroBufferUploaded]);

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
