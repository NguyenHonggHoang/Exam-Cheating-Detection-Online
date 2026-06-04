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
    // ESCALATION LOGIC
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

// ========== Pre-Suspicion Detector ==========

export class PreSuspicionDetector {
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
        const signals = this.calculateSignals(headPose, irisGaze, faceBox, now);

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

    /**
     * Calculate signals WITHOUT requiring calibration baseline.
     * Uses absolute thresholds on raw head pose values.
     * 
     * Assumes "normal" viewing position:
     * - pitch ~= 0-10° (slight downward to screen)
     * - yaw ~= 0° (facing camera)
     */
    private calculateSignals(
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
        // DETAILED LOGGING FOR TRACING
        // ========================================

        // Log confidence breakdown (throttled to ~5% of frames)
        if (Math.random() < 0.05) {
            const breakdown = [];
            if (isLookingDown && isFaceStable) breakdown.push(`pitch↓:${W.PITCH_DOWN}`);
            if (isGazingDown) breakdown.push(`gaze↓:${W.GAZE_DOWN}`);
            if (isBlinkSuppressed) breakdown.push(`blink:${W.BLINK_SUPPRESSED}`);
            if (isLeaningForward && pattern === 'phone_below') breakdown.push(`lean:${W.DISTANCE_CHANGE}`);

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

    reset(): void {
        this.history = [];
        this.suspicionStartTime = null;
        this.preSuspicionHistory = [];
        this.lastNormalStateStart = null;
    }
}
