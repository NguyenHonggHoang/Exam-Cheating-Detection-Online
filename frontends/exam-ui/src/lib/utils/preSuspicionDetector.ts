/**
 * Pre-Suspicion Detector
 * 
 * Lightweight detection of "phone-prep" patterns using FaceMesh outputs.
 * Uses calibration-based delta logic to reduce false positives.
 * 
 * Signals monitored:
 * - Head pitch/yaw delta from baseline
 * - Eye gaze direction (iris landmarks)
 * - Blink rate changes
 * - Face bounding box stability
 */

import { HeadPose, FaceLandmark } from '../types/detection';
import { calculateIrisGaze, IrisGaze } from './faceAnalysis';

// ========== Types ==========

export interface BaselineData {
    avgPitch: number;
    avgYaw: number;
    avgGaze: { horizontal: number; vertical: number };
    avgBlinkRate: number;  // Blinks per minute
    faceBoxCenter: { x: number; y: number };
    faceBoxArea: number;
    avgBrightness: number;
    collectedAt: number;
    sampleCount: number;
}

export interface CalibrationIssue {
    type: 'HEAD_TOO_LOW' | 'HEAD_TOO_HIGH' | 'HEAD_TILTED_LEFT' | 'HEAD_TILTED_RIGHT' |
    'TOO_FAR' | 'TOO_CLOSE' | 'LOW_LIGHT' | 'FACE_NOT_DETECTED';
    message: string;
    direction?: 'up' | 'down' | 'left' | 'right' | 'forward' | 'backward';
}

export interface CalibrationValidation {
    valid: boolean;
    issues: CalibrationIssue[];
    guidance: string | null;  // Real-time guidance message
}

export interface PreSuspicionSignals {
    pitchDelta: number;
    yawDelta: number;
    gazeDelta: { horizontal: number; vertical: number };
    blinkRateDelta: number;
    faceBoxDrift: number;
    faceBoxStable: boolean;
    faceAreaRatio: number;  // > 1 = leaning forward (face getting bigger)
}

export interface PreSuspicionResult {
    isActive: boolean;
    confidence: number;  // 0-100
    signals: PreSuspicionSignals;
    pattern: 'phone_below' | 'phone_beside' | 'none' | `ESCALATED_phone_below` | `ESCALATED_phone_beside`;
    triggeredAt: number | null;
    // Escalation flags
    shouldEscalateToViolation?: boolean;
    isEscalated?: boolean;
}

// ========== Constants ==========

/**
 * Calibration thresholds - aligned with faceAnalysis.ts LOOK_AWAY_THRESHOLDS
 * These define acceptable ranges during calibration
 */
const CALIBRATION_THRESHOLDS = {
    MIN_PITCH: -15,        // Aligned: head not looking up too much (was -10)
    MAX_PITCH: 20,         // Aligned: head not looking down too much (was 15)
    MAX_YAW: 20,           // Aligned: not turned more than 20° (was 15)
    MIN_FACE_AREA: 8000,   // Not too far away (pixels²)
    MAX_FACE_AREA: 80000,  // Not too close
    MIN_BRIGHTNESS: 50,    // 0-255 scale
    CALIBRATION_DURATION: 30000,  // 30s
    MIN_SAMPLES: 60        // At least 60 samples (2fps x 30s)
};

/**
 * Phone-prep detection thresholds for suspicious behavior patterns
 * 
 * MULTI-CONDITION APPROACH: Require combination of signals to reduce false positives
 * 
 * Attack Scenarios to Catch:
 * 1. Phone camera snap: Look down 30° for 1-2s → snap → look back
 * 2. Document glance: Quick 2s look at notes beside keyboard
 * 3. Phone prep: Reach for phone in lap (head tilt + gaze down + lean forward)
 * 
 * Philosophy:
 * - Multi-condition checks reduce false positives
 * - 1.8s sustained duration filters thinking pauses
 * - Distance change detects leaning toward phone/notes
 * - Higher confidence threshold requires multiple signals
 */
const PHONE_PREP_THRESHOLDS = {
    // Primary thresholds - RAISED to reduce false positives
    PITCH_DOWN_DELTA: 25,     // 25° down from baseline (lowered from 35 - >40° absolute)
    YAW_DELTA: 25,            // 25° turn (raised from 20°)

    // Gaze thresholds - tightened for multi-condition approach
    GAZE_V_DELTA: 0.25,       // 25% vertical eye shift (up from 0.15)
    GAZE_H_DELTA: 0.20,       // 20% horizontal (up from 0.15)

    // Distance/leaning detection (NEW)
    DISTANCE_DELTA_THRESHOLD: -0.08,  // Face getting closer = leaning forward
    DISTANCE_BONUS_CONFIDENCE: 15,     // Extra confidence if distance changed

    // Timing - RAISED to require longer sustained behavior
    BLINK_RATIO: 0.8,         // 20% reduction = focus/reading
    FACE_DRIFT_MAX: 20,       // 20px drift tolerance
    WINDOW_DURATION: 2500,    // 2.5s sustained (raised from 1.8s)

    // Confidence scoring - RAISED to require more signals
    CONFIDENCE_THRESHOLD: 35,  // 35/100 - requires pitch+stable+one more condition

    // ========================================
    // ESCALATION LOGIC (NEW)
    // ========================================
    ESCALATION: {
        // Pre-suspicion → Violation escalation
        COUNT_FOR_VIOLATION: 2,    // 2+ pre-suspicions in window = violation
        WINDOW_MS: 60000,          // 60s window
        SUSTAINED_FOR_VIOLATION: 3500, // 3.5s sustained = immediate violation
    },

    // Per-condition confidence weights
    WEIGHTS: {
        PITCH_DOWN: 30,           // Head tilted down (increased from 25)
        GAZE_DOWN: 20,            // Eyes looking down
        YAW_SIDE: 25,             // Head turned side
        GAZE_SIDE: 20,            // Eyes looking side
        DISTANCE_CHANGE: 15,      // Leaning forward
        BLINK_SUPPRESSED: 10,     // Reduced blinking (focused reading)
        FACE_STABLE: 5            // Face not moving (fixed attention)
    }
};

// ========== Calibration Collector ==========

export class CalibrationCollector {
    private samples: Array<{
        pitch: number;
        yaw: number;
        gaze: { horizontal: number; vertical: number };
        faceBox: { x: number; y: number; area: number };
        brightness: number;
        timestamp: number;
    }> = [];

    private blinkTimestamps: number[] = [];
    private startTime: number = 0;
    private isCollecting: boolean = false;

    start(): void {
        this.samples = [];
        this.blinkTimestamps = [];
        this.startTime = Date.now();
        this.isCollecting = true;
    }

    stop(): void {
        this.isCollecting = false;
    }

    addSample(
        headPose: HeadPose,
        irisGaze: IrisGaze | null,
        faceBox: { x: number; y: number; width: number; height: number },
        brightness: number,
        isBlinking: boolean
    ): void {
        if (!this.isCollecting) return;

        const now = Date.now();

        this.samples.push({
            pitch: headPose.pitch,
            yaw: headPose.yaw,
            gaze: irisGaze
                ? { horizontal: irisGaze.horizontalGaze, vertical: irisGaze.verticalGaze }
                : { horizontal: 0, vertical: 0 },
            faceBox: {
                x: faceBox.x + faceBox.width / 2,
                y: faceBox.y + faceBox.height / 2,
                area: faceBox.width * faceBox.height
            },
            brightness,
            timestamp: now
        });

        if (isBlinking) {
            this.blinkTimestamps.push(now);
        }
    }

    /**
     * Real-time validation with directional guidance
     */
    validateRealtime(
        headPose: HeadPose,
        faceBox: { x: number; y: number; width: number; height: number } | null,
        brightness: number
    ): CalibrationValidation {
        const issues: CalibrationIssue[] = [];

        if (!faceBox) {
            return {
                valid: false,
                issues: [{
                    type: 'FACE_NOT_DETECTED',
                    message: 'Không phát hiện khuôn mặt'
                }],
                guidance: 'Đảm bảo khuôn mặt nằm trong khung hình'
            };
        }

        const faceArea = faceBox.width * faceBox.height;

        // Check pitch (up/down)
        if (headPose.pitch < CALIBRATION_THRESHOLDS.MIN_PITCH) {
            issues.push({
                type: 'HEAD_TOO_LOW',
                message: 'Đầu cúi quá thấp',
                direction: 'up'
            });
        } else if (headPose.pitch > CALIBRATION_THRESHOLDS.MAX_PITCH) {
            issues.push({
                type: 'HEAD_TOO_HIGH',
                message: 'Đầu ngửa quá cao',
                direction: 'down'
            });
        }

        // Check yaw (left/right)
        if (headPose.yaw < -CALIBRATION_THRESHOLDS.MAX_YAW) {
            issues.push({
                type: 'HEAD_TILTED_LEFT',
                message: 'Đang quay trái',
                direction: 'right'
            });
        } else if (headPose.yaw > CALIBRATION_THRESHOLDS.MAX_YAW) {
            issues.push({
                type: 'HEAD_TILTED_RIGHT',
                message: 'Đang quay phải',
                direction: 'left'
            });
        }

        // Check distance
        if (faceArea < CALIBRATION_THRESHOLDS.MIN_FACE_AREA) {
            issues.push({
                type: 'TOO_FAR',
                message: 'Ngồi quá xa',
                direction: 'forward'
            });
        } else if (faceArea > CALIBRATION_THRESHOLDS.MAX_FACE_AREA) {
            issues.push({
                type: 'TOO_CLOSE',
                message: 'Ngồi quá gần',
                direction: 'backward'
            });
        }

        // Check lighting
        if (brightness < CALIBRATION_THRESHOLDS.MIN_BRIGHTNESS) {
            issues.push({
                type: 'LOW_LIGHT',
                message: 'Ánh sáng không đủ'
            });
        }

        // Generate guidance message (prioritize most important issue)
        let guidance: string | null = null;
        if (issues.length > 0) {
            const priorityIssue = issues[0];
            switch (priorityIssue.direction) {
                case 'up':
                    guidance = '⬆️ Ngẩng đầu lên';
                    break;
                case 'down':
                    guidance = '⬇️ Cúi đầu xuống';
                    break;
                case 'left':
                    guidance = '⬅️ Quay sang trái';
                    break;
                case 'right':
                    guidance = '➡️ Quay sang phải';
                    break;
                case 'forward':
                    guidance = '📷 Ngồi gần camera hơn';
                    break;
                case 'backward':
                    guidance = '📷 Ngồi xa camera hơn';
                    break;
                default:
                    guidance = priorityIssue.message;
            }
        }

        return {
            valid: issues.length === 0,
            issues,
            guidance
        };
    }

    /**
     * Calculate final baseline from collected samples
     */
    calculateBaseline(): BaselineData | null {
        if (this.samples.length < CALIBRATION_THRESHOLDS.MIN_SAMPLES) {
            console.warn(`[Calibration] Not enough samples: ${this.samples.length}/${CALIBRATION_THRESHOLDS.MIN_SAMPLES}`);
            return null;
        }

        // Use median for robustness
        const sortedPitch = [...this.samples].sort((a, b) => a.pitch - b.pitch);
        const sortedYaw = [...this.samples].sort((a, b) => a.yaw - b.yaw);
        const sortedGazeH = [...this.samples].sort((a, b) => a.gaze.horizontal - b.gaze.horizontal);
        const sortedGazeV = [...this.samples].sort((a, b) => a.gaze.vertical - b.gaze.vertical);

        const mid = Math.floor(this.samples.length / 2);

        // Calculate blink rate (blinks per minute)
        const duration = Date.now() - this.startTime;
        const blinkRate = (this.blinkTimestamps.length / duration) * 60000;

        // Face box center (median)
        const sortedFaceX = [...this.samples].sort((a, b) => a.faceBox.x - b.faceBox.x);
        const sortedFaceY = [...this.samples].sort((a, b) => a.faceBox.y - b.faceBox.y);
        const sortedFaceArea = [...this.samples].sort((a, b) => a.faceBox.area - b.faceBox.area);

        return {
            avgPitch: sortedPitch[mid].pitch,
            avgYaw: sortedYaw[mid].yaw,
            avgGaze: {
                horizontal: sortedGazeH[mid].gaze.horizontal,
                vertical: sortedGazeV[mid].gaze.vertical
            },
            avgBlinkRate: blinkRate,
            faceBoxCenter: {
                x: sortedFaceX[mid].faceBox.x,
                y: sortedFaceY[mid].faceBox.y
            },
            faceBoxArea: sortedFaceArea[mid].faceBox.area,
            avgBrightness: this.samples.reduce((sum, s) => sum + s.brightness, 0) / this.samples.length,
            collectedAt: Date.now(),
            sampleCount: this.samples.length
        };
    }

    getProgress(): number {
        const elapsed = Date.now() - this.startTime;
        return Math.min(100, (elapsed / CALIBRATION_THRESHOLDS.CALIBRATION_DURATION) * 100);
    }

    isComplete(): boolean {
        const elapsed = Date.now() - this.startTime;
        return elapsed >= CALIBRATION_THRESHOLDS.CALIBRATION_DURATION &&
            this.samples.length >= CALIBRATION_THRESHOLDS.MIN_SAMPLES;
    }
}

// ========== Pre-Suspicion Detector ==========

export class PreSuspicionDetector {
    private baseline: BaselineData | null = null;
    private history: Array<{
        signals: PreSuspicionSignals;
        timestamp: number;
    }> = [];

    private suspicionStartTime: number | null = null;
    private blinkTimestamps: number[] = [];
    private lastFaceBox: { x: number; y: number } | null = null;
    private lastFaceArea: number | null = null;  // For detecting leaning forward

    // Track pre-suspicion events for escalation
    private preSuspicionHistory: Array<{ timestamp: number; pattern: string }> = [];

    // Track when user returned to normal state (for history reset)
    private lastNormalStateStart: number | null = null;
    private static readonly NORMAL_STATE_RESET_DURATION = 5000; // Reset history after 5s of normal

    private baselineFaceArea: number | null = null;
    private normalStateFrames = 0;

    setBaseline(baseline: BaselineData): void {
        this.baseline = baseline;
        this.history = [];
        this.suspicionStartTime = null;
        console.log('[PreSuspicion] Baseline set:', baseline);
    }

    getBaseline(): BaselineData | null {
        return this.baseline;
    }

    /**
     * Analyze current frame for pre-suspicion signals
     * NOW WORKS WITHOUT CALIBRATION - uses fixed absolute thresholds
     */
    analyze(
        headPose: HeadPose,
        irisGaze: IrisGaze | null,
        faceBox: { x: number; y: number; width: number; height: number },
        isBlinking: boolean
    ): PreSuspicionResult {
        // No longer requires baseline - use fixed thresholds
        const now = Date.now();

        // Track blinks for rate calculation
        if (isBlinking) {
            this.blinkTimestamps.push(now);
        }
        // Keep only last 60s of blinks
        this.blinkTimestamps = this.blinkTimestamps.filter(t => now - t < 60000);

        // Calculate signals using fixed thresholds (no baseline needed)
        const signals = this.calculateSignalsWithoutBaseline(headPose, irisGaze, faceBox, now);

        // Add to history
        this.history.push({ signals, timestamp: now });

        // Keep only last 5s of history
        this.history = this.history.filter(h => now - h.timestamp < 5000);

        // Update last face box
        this.lastFaceBox = {
            x: faceBox.x + faceBox.width / 2,
            y: faceBox.y + faceBox.height / 2
        };

        // Detect pattern
        const result = this.detectPattern(signals, now);

        // Update baselineFaceArea if user is in "Normal" state (low confidence)
        // This makes leaning detection robust against drift and stops "flapping"
        // (Flapping occurred because we compared frame-t-frame, so stopping movement reset ratio to 1)
        const currentFaceArea = faceBox.width * faceBox.height;

        if (result.pattern === 'none' && result.confidence < 20) {
            this.normalStateFrames++;

            // Only update baseline after 1 second (5 frames) of stability
            if (this.normalStateFrames > 5) {
                if (this.baselineFaceArea === null) {
                    this.baselineFaceArea = currentFaceArea;
                } else {
                    // Slow Exponential Moving Average (EMA) to adapt to small shifts
                    // Alpha = 0.02 (very slow update)
                    this.baselineFaceArea = this.baselineFaceArea * 0.98 + currentFaceArea * 0.02;
                }
            }
        } else {
            this.normalStateFrames = 0;
            // Initialize if null even if bad state (better than nothing)
            if (this.baselineFaceArea === null) {
                this.baselineFaceArea = currentFaceArea;
            }
        }

        return result;
    }

    private calculateSignals(
        headPose: HeadPose,
        irisGaze: IrisGaze | null,
        faceBox: { x: number; y: number; width: number; height: number },
        now: number
    ): PreSuspicionSignals {
        const baseline = this.baseline!;

        // Pitch delta (negative = looking down relative to baseline)
        // Example: baseline=5°, current=-10° → pitchDelta=-15 (looking down more)
        const pitchDelta = headPose.pitch - baseline.avgPitch;

        // Yaw delta (absolute value for either direction)
        const yawDelta = Math.abs(headPose.yaw - baseline.avgYaw);

        // Gaze delta
        const gazeDelta = irisGaze ? {
            horizontal: Math.abs(irisGaze.horizontalGaze - baseline.avgGaze.horizontal),
            vertical: irisGaze.verticalGaze - baseline.avgGaze.vertical  // Positive = looking down
        } : { horizontal: 0, vertical: 0 };

        // Blink rate delta (ratio compared to baseline)
        const currentBlinkRate = (this.blinkTimestamps.length / 60) * 60;  // Extrapolate to per-minute
        const blinkRateDelta = baseline.avgBlinkRate > 0
            ? currentBlinkRate / baseline.avgBlinkRate
            : 1;

        // Face box drift
        const currentCenter = {
            x: faceBox.x + faceBox.width / 2,
            y: faceBox.y + faceBox.height / 2
        };
        const faceBoxDrift = this.lastFaceBox
            ? Math.sqrt(
                Math.pow(currentCenter.x - this.lastFaceBox.x, 2) +
                Math.pow(currentCenter.y - this.lastFaceBox.y, 2)
            )
            : 0;

        // Face area ratio for leaning detection
        const currentFaceArea = faceBox.width * faceBox.height;
        const faceAreaRatio = this.lastFaceArea && this.lastFaceArea > 0
            ? currentFaceArea / this.lastFaceArea
            : 1.0;

        return {
            pitchDelta,
            yawDelta,
            gazeDelta,
            blinkRateDelta,
            faceBoxDrift,
            faceBoxStable: faceBoxDrift < PHONE_PREP_THRESHOLDS.FACE_DRIFT_MAX,
            faceAreaRatio
        };
    }

    /**
     * Calculate signals WITHOUT requiring calibration baseline.
     * Uses absolute thresholds on raw head pose values.
     * 
     * Assumes "normal" viewing position:
     * - pitch ~= 0-10° (slight downward to screen)
     * - yaw ~= 0° (facing camera)
     */
    private calculateSignalsWithoutBaseline(
        headPose: HeadPose,
        irisGaze: IrisGaze | null,
        faceBox: { x: number; y: number; width: number; height: number },
        now: number
    ): PreSuspicionSignals {
        // Use raw pitch as "delta from neutral"
        // In this system: POSITIVE pitch = looking DOWN
        // Normal screen viewing: ~5-15° down
        // Suspicious: > 25° down (looking at phone in lap)
        const NEUTRAL_PITCH = 15; // Assume normal viewing is ~15° down (laptop screen)
        const pitchDelta = headPose.pitch - NEUTRAL_PITCH;

        // Yaw: any significant turn from center is suspicious
        const yawDelta = Math.abs(headPose.yaw);

        // Gaze: use raw iris values (positive vertical = looking down)
        const gazeDelta = irisGaze ? {
            horizontal: Math.abs(irisGaze.horizontalGaze),
            vertical: irisGaze.verticalGaze  // Positive = looking down
        } : { horizontal: 0, vertical: 0 };

        // Blink rate - use simplified calculation
        const currentBlinkRate = (this.blinkTimestamps.length / 60) * 60;
        const blinkRateDelta = currentBlinkRate > 0 ? 15 / currentBlinkRate : 1; // Assume normal is ~15 bpm

        // Face box drift
        const currentCenter = {
            x: faceBox.x + faceBox.width / 2,
            y: faceBox.y + faceBox.height / 2
        };
        const faceBoxDrift = this.lastFaceBox
            ? Math.sqrt(
                Math.pow(currentCenter.x - this.lastFaceBox.x, 2) +
                Math.pow(currentCenter.y - this.lastFaceBox.y, 2)
            )
            : 0;

        // Face area ratio for leaning detection (> 1 = face getting bigger = leaning forward)
        const currentFaceArea = faceBox.width * faceBox.height;

        // Use rolling baseline if available (PREFERRED) to detect static leaning, otherwise frame-to-frame (fallback)
        const referenceArea = this.baselineFaceArea || this.lastFaceArea;

        const faceAreaRatio = referenceArea && referenceArea > 0
            ? currentFaceArea / referenceArea
            : 1.0;

        // Update lastFaceArea for next frame
        this.lastFaceArea = currentFaceArea;

        return {
            pitchDelta,
            yawDelta,
            gazeDelta,
            blinkRateDelta,
            faceBoxDrift,
            faceBoxStable: faceBoxDrift < PHONE_PREP_THRESHOLDS.FACE_DRIFT_MAX,
            faceAreaRatio
        };
    }

    private detectPattern(signals: PreSuspicionSignals, now: number): PreSuspicionResult {
        let confidence = 0;
        let pattern: 'phone_below' | 'phone_beside' | 'none' = 'none';
        const W = PHONE_PREP_THRESHOLDS.WEIGHTS;

        // ========================================
        // Pattern 1: Phone below (looking down)
        // Multi-condition: pitch + gaze + optional distance
        // ========================================
        const isLookingDown = signals.pitchDelta > PHONE_PREP_THRESHOLDS.PITCH_DOWN_DELTA;
        const isGazingDown = signals.gazeDelta.vertical > PHONE_PREP_THRESHOLDS.GAZE_V_DELTA;
        const isBlinkSuppressed = signals.blinkRateDelta < PHONE_PREP_THRESHOLDS.BLINK_RATIO;
        const isFaceStable = signals.faceBoxStable;

        // Detect leaning forward (face getting bigger = closer to camera)
        // faceAreaRatio > 1.08 = face is 8% bigger than previous frame
        const isLeaningForward = signals.faceAreaRatio > 1.08;

        if (isLookingDown && isFaceStable) {
            confidence += W.PITCH_DOWN;
            pattern = 'phone_below';
        }
        if (isGazingDown) {
            confidence += W.GAZE_DOWN;
        }
        if (isBlinkSuppressed) {
            confidence += W.BLINK_SUPPRESSED;
        }
        if (isFaceStable && pattern === 'phone_below') {
            confidence += W.FACE_STABLE;
        }
        if (isLeaningForward && pattern === 'phone_below') {
            confidence += W.DISTANCE_CHANGE;
        }

        // ========================================
        // Pattern 2: Phone beside (looking sideways)
        // DISABLED - Looking sideways is handled by Look Away Detection (faceAnalysis.ts)
        // Pre-suspicion should only detect looking DOWN (phone below pattern)
        // ========================================
        // const isLookingSide = Math.abs(signals.yawDelta) > PHONE_PREP_THRESHOLDS.YAW_DELTA;
        // const isGazingSide = Math.abs(signals.gazeDelta.horizontal) > PHONE_PREP_THRESHOLDS.GAZE_H_DELTA;
        //
        // if (isLookingSide && isFaceStable) {
        //     confidence += W.YAW_SIDE;
        //     pattern = 'phone_beside';
        // }
        // if (isGazingSide) {
        //     confidence += W.GAZE_SIDE;
        // }

        // ========================================
        // DETAILED LOGGING FOR TRACING
        // ========================================

        // Log confidence breakdown (throttled to ~5% of frames)
        if (Math.random() < 0.05) {
            const breakdown = [];
            if (isLookingDown && isFaceStable) breakdown.push(`pitch↓:${W.PITCH_DOWN}`);
            if (isGazingDown) breakdown.push(`gaze↓:${W.GAZE_DOWN}`);
            if (isBlinkSuppressed) breakdown.push(`blink:${W.BLINK_SUPPRESSED}`);
            if (isLeaningForward && pattern === 'phone_below') breakdown.push(`lean:${W.DISTANCE_CHANGE}`);
            // YAW/horizontal gaze now handled by Look Away Detection

            console.log(
                `[PreSuspicion:Signals] ` +
                `pitch=${signals.pitchDelta.toFixed(1)}° yaw=${signals.yawDelta.toFixed(1)}° ` +
                `gazeV=${signals.gazeDelta.vertical.toFixed(2)} gazeH=${signals.gazeDelta.horizontal.toFixed(2)} ` +
                `drift=${signals.faceBoxDrift.toFixed(1)}px areaRatio=${signals.faceAreaRatio.toFixed(2)} stable=${isFaceStable}`
            );

            if (breakdown.length > 0) {
                console.log(
                    `[PreSuspicion:Confidence] ` +
                    `Total=${confidence}/${PHONE_PREP_THRESHOLDS.CONFIDENCE_THRESHOLD} ` +
                    `[${breakdown.join(' + ')}] ` +
                    `pattern=${pattern}`
                );
            }
        }

        // Check if confidence meets threshold
        const isPatternDetected = confidence >= PHONE_PREP_THRESHOLDS.CONFIDENCE_THRESHOLD;

        // Log state transitions
        if (isPatternDetected) {
            if (!this.suspicionStartTime) {
                this.suspicionStartTime = now;
                console.log(`[PreSuspicion:Start] Pattern detected: ${pattern}, confidence=${confidence}, starting sustained timer...`);
            }
            // Reset normal state tracking when pattern detected
            this.lastNormalStateStart = null;
        } else {
            if (this.suspicionStartTime !== null) {
                const elapsed = now - this.suspicionStartTime;
                console.log(`[PreSuspicion:Reset] Confidence dropped below threshold after ${(elapsed / 1000).toFixed(1)}s`);
            }
            this.suspicionStartTime = null;

            // Track normal state for history reset
            if (this.lastNormalStateStart === null) {
                this.lastNormalStateStart = now;
            } else {
                const normalDuration = now - this.lastNormalStateStart;
                // Reset escalation history after 5s of normal viewing
                if (normalDuration >= PreSuspicionDetector.NORMAL_STATE_RESET_DURATION && this.preSuspicionHistory.length > 0) {
                    console.log(`[PreSuspicion:HistoryReset] 🔄 User normal for ${(normalDuration / 1000).toFixed(1)}s - clearing ${this.preSuspicionHistory.length} history entries`);
                    this.preSuspicionHistory = [];
                }
            }
        }

        // Activate after sustained duration (1.8s)
        const sustainedDuration = this.suspicionStartTime
            ? now - this.suspicionStartTime
            : 0;
        const isActive = this.suspicionStartTime !== null &&
            sustainedDuration >= PHONE_PREP_THRESHOLDS.WINDOW_DURATION;

        // Log when active
        if (isActive && Math.random() < 0.1) {
            console.log(
                `[PreSuspicion:Active] ` +
                `pattern=${pattern} conf=${confidence} ` +
                `sustained=${(sustainedDuration / 1000).toFixed(1)}s/${(PHONE_PREP_THRESHOLDS.WINDOW_DURATION / 1000).toFixed(1)}s ` +
                `history=${this.preSuspicionHistory.length}`
            );
        }

        // Record pre-suspicion for escalation tracking
        if (isActive && pattern !== 'none') {
            this.recordPreSuspicion(now, pattern);
        }

        // Check for escalation to violation
        const shouldEscalate = this.checkEscalation(now, sustainedDuration);

        return {
            isActive,
            confidence,
            signals,
            pattern: isActive ? pattern : 'none',
            triggeredAt: isActive ? this.suspicionStartTime : null,
            // Add escalation info (consumer can use this to upgrade to violation)
            ...(shouldEscalate && { shouldEscalateToViolation: true })
        };
    }

    /**
     * Record pre-suspicion for escalation tracking
     */
    private recordPreSuspicion(timestamp: number, pattern: string): void {
        // Avoid duplicate entries within 1s
        const lastEntry = this.preSuspicionHistory[this.preSuspicionHistory.length - 1];
        if (lastEntry && timestamp - lastEntry.timestamp < 1000) {
            return; // Skip duplicate
        }

        this.preSuspicionHistory.push({ timestamp, pattern });

        // Clean old entries outside window
        const windowMs = PHONE_PREP_THRESHOLDS.ESCALATION.WINDOW_MS;
        const beforeCount = this.preSuspicionHistory.length;
        this.preSuspicionHistory = this.preSuspicionHistory.filter(
            h => timestamp - h.timestamp < windowMs
        );

        // Log history update
        console.log(
            `[PreSuspicion:History] ` +
            `📝 Added: ${pattern} | ` +
            `Count: ${this.preSuspicionHistory.length}/${PHONE_PREP_THRESHOLDS.ESCALATION.COUNT_FOR_VIOLATION} trong 60s | ` +
            `Cleaned: ${beforeCount - this.preSuspicionHistory.length} old entries`
        );

        // Log all entries in history
        if (this.preSuspicionHistory.length > 1) {
            const historyStr = this.preSuspicionHistory.map((h, i) => {
                const ageS = ((timestamp - h.timestamp) / 1000).toFixed(1);
                return `#${i + 1}: ${h.pattern} (${ageS}s ago)`;
            }).join(', ');
            console.log(`[PreSuspicion:History] Timeline: ${historyStr}`);
        }
    }

    /**
     * Check if pre-suspicion should escalate to violation
     * Conditions:
     * 1. 2+ pre-suspicions within 60s window
     * 2. Single pre-suspicion sustained for 3.5s+
     */
    private checkEscalation(now: number, sustainedDuration: number): boolean {
        const esc = PHONE_PREP_THRESHOLDS.ESCALATION;
        const historyCount = this.preSuspicionHistory.length;
        const sustainedS = (sustainedDuration / 1000).toFixed(1);
        const thresholdS = (esc.SUSTAINED_FOR_VIOLATION / 1000).toFixed(1);

        // Log escalation check status (throttled)
        if (Math.random() < 0.1 && (historyCount > 0 || sustainedDuration > 1000)) {
            console.log(
                `[PreSuspicion:Escalation] ` +
                `🔍 Check: ${historyCount}/${esc.COUNT_FOR_VIOLATION} lần | ` +
                `${sustainedS}s/${thresholdS}s duy trì | ` +
                `Status: ${historyCount >= esc.COUNT_FOR_VIOLATION || sustainedDuration >= esc.SUSTAINED_FOR_VIOLATION ? '⚠️ CẦN LEO THANG' : '✓ Bình thường'}`
            );
        }

        // Check repeated incidents
        if (historyCount >= esc.COUNT_FOR_VIOLATION) {
            console.warn(
                `[PreSuspicion:Escalation] ⚠️ LEO THANG - LÝ DO: ${historyCount} lần nghi vấn trong 60s ` +
                `(ngưỡng: ${esc.COUNT_FOR_VIOLATION})`
            );
            return true;
        }

        // Check sustained duration
        if (sustainedDuration >= esc.SUSTAINED_FOR_VIOLATION) {
            console.warn(
                `[PreSuspicion:Escalation] ⚠️ LEO THANG - LÝ DO: duy trì ${sustainedS}s ` +
                `(ngưỡng: ${thresholdS}s)`
            );
            return true;
        }

        return false;
    }

    private getEmptySignals(): PreSuspicionSignals {
        return {
            pitchDelta: 0,
            yawDelta: 0,
            gazeDelta: { horizontal: 0, vertical: 0 },
            blinkRateDelta: 1,
            faceBoxDrift: 0,
            faceBoxStable: true,
            faceAreaRatio: 1.0
        };
    }

    reset(): void {
        this.history = [];
        this.suspicionStartTime = null;
        this.blinkTimestamps = [];
        this.lastFaceBox = null;
        this.preSuspicionHistory = [];
    }
}

// ========== Singleton Instance ==========

export const calibrationCollector = new CalibrationCollector();
export const preSuspicionDetector = new PreSuspicionDetector();
