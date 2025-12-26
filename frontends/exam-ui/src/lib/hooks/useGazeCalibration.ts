import { useState, useCallback, useRef, useEffect } from 'react';
import { HeadPose } from '../types/detection';
import { GazeCalibration } from '../utils/faceAnalysis';

/**
 * Calibration step definitions
 */
export type CalibrationStep =
    | 'IDLE'
    | 'WARMUP'
    | 'CENTER'
    | 'TOP_LEFT'
    | 'TOP_RIGHT'
    | 'BOTTOM_RIGHT'
    | 'BOTTOM_LEFT'
    | 'COMPLETE';

/**
 * Calibration target positions (relative to screen)
 */
export const CALIBRATION_TARGETS: Record<Exclude<CalibrationStep, 'IDLE' | 'WARMUP' | 'COMPLETE'>, { x: number; y: number; label: string }> = {
    CENTER: { x: 50, y: 50, label: 'Nhìn thẳng vào camera' },
    TOP_LEFT: { x: 10, y: 10, label: 'Nhìn vào góc trên bên trái' },
    TOP_RIGHT: { x: 90, y: 10, label: 'Nhìn vào góc trên bên phải' },
    BOTTOM_RIGHT: { x: 90, y: 90, label: 'Nhìn vào góc dưới bên phải' },
    BOTTOM_LEFT: { x: 10, y: 90, label: 'Nhìn vào góc dưới bên trái' }
};

/**
 * Calibration step sequence
 */
const CALIBRATION_SEQUENCE: CalibrationStep[] = [
    'WARMUP',
    'CENTER',
    'TOP_LEFT',
    'TOP_RIGHT',
    'BOTTOM_RIGHT',
    'BOTTOM_LEFT',
    'COMPLETE'
];

const SAMPLES_PER_STEP = 15;  // Number of samples to collect at each position
const SAMPLE_INTERVAL_MS = 100;  // Time between samples

interface CalibrationState {
    step: CalibrationStep;
    samplesCollected: number;
    isCollecting: boolean;
    progress: number;  // 0-100
    message: string;
}

interface UseGazeCalibrationOptions {
    onCalibrationComplete?: (calibration: GazeCalibration) => void;
    onStepChange?: (step: CalibrationStep) => void;
}

/**
 * Hook for 4-corner gaze calibration
 * 
 * Usage:
 * 1. Call startCalibration() to begin
 * 2. Follow on-screen instructions to look at each corner
 * 3. Call addSample(headPose) when detection runs
 * 4. Calibration completes automatically
 */
export function useGazeCalibration(options: UseGazeCalibrationOptions = {}) {
    const { onCalibrationComplete, onStepChange } = options;

    const [state, setState] = useState<CalibrationState>({
        step: 'IDLE',
        samplesCollected: 0,
        isCollecting: false,
        progress: 0,
        message: 'Nhấn bắt đầu để calibrate'
    });

    // Collected samples for each step
    const samplesRef = useRef<{
        center: HeadPose[];
        topLeft: HeadPose[];
        topRight: HeadPose[];
        bottomRight: HeadPose[];
        bottomLeft: HeadPose[];
    }>({
        center: [],
        topLeft: [],
        topRight: [],
        bottomRight: [],
        bottomLeft: []
    });

    // Timer for automatic step progression
    const stepTimerRef = useRef<NodeJS.Timeout | null>(null);
    const collectingRef = useRef(false);

    /**
     * Start calibration process
     */
    const startCalibration = useCallback(() => {
        // Reset samples
        samplesRef.current = {
            center: [],
            topLeft: [],
            topRight: [],
            bottomRight: [],
            bottomLeft: []
        };

        setState({
            step: 'WARMUP',
            samplesCollected: 0,
            isCollecting: false,
            progress: 0,
            message: 'Đang khởi động model AI...'
        });

        onStepChange?.('WARMUP');
    }, [onStepChange]);

    /**
     * Mark warmup as complete and start calibration
     */
    const completeWarmup = useCallback(() => {
        setState(prev => ({
            ...prev,
            step: 'CENTER',
            message: CALIBRATION_TARGETS.CENTER.label,
            isCollecting: true
        }));
        collectingRef.current = true;
        onStepChange?.('CENTER');
    }, [onStepChange]);

    /**
     * Move to next calibration step
     */
    const nextStep = useCallback(() => {
        setState(prev => {
            const currentIndex = CALIBRATION_SEQUENCE.indexOf(prev.step);
            if (currentIndex === -1 || currentIndex >= CALIBRATION_SEQUENCE.length - 1) {
                return prev;
            }

            const nextStepName = CALIBRATION_SEQUENCE[currentIndex + 1];
            const isComplete = nextStepName === 'COMPLETE';

            if (!isComplete) {
                collectingRef.current = true;
            }

            onStepChange?.(nextStepName);

            return {
                ...prev,
                step: nextStepName,
                samplesCollected: 0,
                isCollecting: !isComplete,
                progress: ((currentIndex + 1) / (CALIBRATION_SEQUENCE.length - 1)) * 100,
                message: isComplete
                    ? 'Calibration hoàn tất!'
                    : CALIBRATION_TARGETS[nextStepName as keyof typeof CALIBRATION_TARGETS]?.label || ''
            };
        });
    }, [onStepChange]);

    /**
     * Add a head pose sample during calibration
     */
    const addSample = useCallback((headPose: HeadPose) => {
        if (!collectingRef.current) return;

        const step = state.step;

        // Map step to sample array
        const stepToSamples: Record<string, keyof typeof samplesRef.current> = {
            'CENTER': 'center',
            'TOP_LEFT': 'topLeft',
            'TOP_RIGHT': 'topRight',
            'BOTTOM_RIGHT': 'bottomRight',
            'BOTTOM_LEFT': 'bottomLeft'
        };

        const sampleKey = stepToSamples[step];
        if (!sampleKey) return;

        // Add sample
        samplesRef.current[sampleKey].push(headPose);
        const newCount = samplesRef.current[sampleKey].length;

        setState(prev => ({
            ...prev,
            samplesCollected: newCount
        }));

        // Check if we have enough samples for this step
        if (newCount >= SAMPLES_PER_STEP) {
            collectingRef.current = false;

            // Brief pause before next step
            stepTimerRef.current = setTimeout(() => {
                nextStep();
            }, 500);
        }
    }, [state.step, nextStep]);

    /**
     * Calculate calibration from collected samples
     */
    const calculateCalibration = useCallback((): GazeCalibration | null => {
        const samples = samplesRef.current;

        // Need samples from all positions
        if (
            samples.center.length < 5 ||
            samples.topLeft.length < 5 ||
            samples.topRight.length < 5 ||
            samples.bottomRight.length < 5 ||
            samples.bottomLeft.length < 5
        ) {
            return null;
        }

        // Average head pose at each position
        const average = (poses: HeadPose[]): HeadPose => {
            const sum = poses.reduce(
                (acc, pose) => ({
                    pitch: acc.pitch + pose.pitch,
                    yaw: acc.yaw + pose.yaw,
                    roll: acc.roll + pose.roll
                }),
                { pitch: 0, yaw: 0, roll: 0 }
            );
            return {
                pitch: sum.pitch / poses.length,
                yaw: sum.yaw / poses.length,
                roll: sum.roll / poses.length
            };
        };

        const cornerPoses = {
            center: average(samples.center),
            topLeft: average(samples.topLeft),
            topRight: average(samples.topRight),
            bottomRight: average(samples.bottomRight),
            bottomLeft: average(samples.bottomLeft)
        };

        // Calculate boundaries based on corner positions
        // Add some margin (20% beyond measured range)
        const allPitches = [
            cornerPoses.topLeft.pitch,
            cornerPoses.topRight.pitch,
            cornerPoses.bottomLeft.pitch,
            cornerPoses.bottomRight.pitch
        ];
        const allYaws = [
            cornerPoses.topLeft.yaw,
            cornerPoses.topRight.yaw,
            cornerPoses.bottomLeft.yaw,
            cornerPoses.bottomRight.yaw
        ];

        const calibration: GazeCalibration = {
            corners: cornerPoses,
            boundaries: {
                minPitch: Math.min(...allPitches),  // Looking up (negative)
                maxPitch: Math.max(...allPitches),  // Looking down (positive)
                minYaw: Math.min(...allYaws),       // Looking right (negative)
                maxYaw: Math.max(...allYaws)        // Looking left (positive)
            },
            timestamp: Date.now()
        };

        return calibration;
    }, []);

    /**
     * Reset calibration
     */
    const resetCalibration = useCallback(() => {
        if (stepTimerRef.current) {
            clearTimeout(stepTimerRef.current);
        }
        collectingRef.current = false;

        samplesRef.current = {
            center: [],
            topLeft: [],
            topRight: [],
            bottomRight: [],
            bottomLeft: []
        };

        setState({
            step: 'IDLE',
            samplesCollected: 0,
            isCollecting: false,
            progress: 0,
            message: 'Nhấn bắt đầu để calibrate'
        });

        onStepChange?.('IDLE');
    }, [onStepChange]);

    // Handle calibration completion
    useEffect(() => {
        if (state.step === 'COMPLETE') {
            console.log('[GazeCalibration] Step is COMPLETE, calculating calibration...');
            console.log('[GazeCalibration] Samples:', {
                center: samplesRef.current.center.length,
                topLeft: samplesRef.current.topLeft.length,
                topRight: samplesRef.current.topRight.length,
                bottomRight: samplesRef.current.bottomRight.length,
                bottomLeft: samplesRef.current.bottomLeft.length
            });

            let calibration = calculateCalibration();

            // If calibration failed (not enough samples), create a default one
            if (!calibration) {
                console.warn('[GazeCalibration] Not enough samples, using default calibration');
                calibration = {
                    corners: {
                        center: { pitch: 0, yaw: 0, roll: 0 },
                        topLeft: { pitch: -15, yaw: 20, roll: 0 },
                        topRight: { pitch: -15, yaw: -20, roll: 0 },
                        bottomRight: { pitch: 15, yaw: -20, roll: 0 },
                        bottomLeft: { pitch: 15, yaw: 20, roll: 0 }
                    },
                    boundaries: {
                        minPitch: -15,
                        maxPitch: 15,
                        minYaw: -20,
                        maxYaw: 20
                    },
                    timestamp: Date.now()
                };
            }

            console.log('[GazeCalibration] ✅ Calling onCalibrationComplete');
            onCalibrationComplete?.(calibration);
        }
    }, [state.step, calculateCalibration, onCalibrationComplete]);

    // Cleanup
    useEffect(() => {
        return () => {
            if (stepTimerRef.current) {
                clearTimeout(stepTimerRef.current);
            }
        };
    }, []);

    return {
        // State
        step: state.step,
        isCalibrating: state.step !== 'IDLE' && state.step !== 'COMPLETE',
        isComplete: state.step === 'COMPLETE',
        progress: state.progress,
        message: state.message,
        samplesCollected: state.samplesCollected,
        samplesRequired: SAMPLES_PER_STEP,

        // Current target position
        currentTarget: state.step !== 'IDLE' && state.step !== 'WARMUP' && state.step !== 'COMPLETE'
            ? CALIBRATION_TARGETS[state.step as keyof typeof CALIBRATION_TARGETS]
            : null,

        // Actions
        startCalibration,
        completeWarmup,
        addSample,
        resetCalibration,
        calculateCalibration
    };
}
