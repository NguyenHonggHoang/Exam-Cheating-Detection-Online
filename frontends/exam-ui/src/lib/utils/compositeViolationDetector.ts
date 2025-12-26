/**
 * Composite Violation Detector
 * 
 * Detects multi-event attack patterns that indicate sophisticated cheating:
 * - Tab switch + Paste (lookup attack)
 * - Blur + Paste (alt-tab to ChatGPT)
 * - Multiple events in short window (coordinated cheating)
 * 
 * Single events may be innocent, but COMBINATIONS are highly suspicious.
 */

import { ViolationType } from '../types/violations';

// ========== Types ==========

export interface CompositeEvent {
    type: 'TAB_SWITCH' | 'PASTE' | 'BLUR' | 'FOCUS' | 'WINDOW_RESIZE' | 'PRE_SUSPICION' | 'SCREENSHOT_ATTEMPT' | 'FULLSCREEN_EXIT';
    timestamp: number;
    metadata?: Record<string, unknown>;
}

export interface CompositeViolation {
    pattern: CompositePatternType;
    severity: 'MEDIUM' | 'HIGH' | 'CRITICAL';
    events: CompositeEvent[];
    confidence: number;  // 0-100
    description: string;
    detectedAt: number;
}

export type CompositePatternType =
    | 'TAB_PASTE'          // Tab switch followed by paste
    | 'BLUR_PASTE'         // Window blur followed by paste
    | 'MULTI_EVENT_BURST'  // Many events in short window
    | 'LOOKUP_PATTERN'     // Pre-suspicion + tab + paste (full lookup cycle)
    | 'SPLIT_SCREEN'       // Window resize + frequent blur/focus
    | 'SPLIT_SCREEN_CAPTURE' // Window resize + screenshot (reading notes + capture)
    | 'SCREEN_CAPTURE';    // Screenshot hotkey detected

// ========== Constants ==========

const COMPOSITE_THRESHOLDS = {
    // Time windows for pattern detection (ms)
    TAB_PASTE_WINDOW: 15000,      // 15s: Tab switch then paste
    BLUR_PASTE_WINDOW: 10000,     // 10s: Blur then paste
    LOOKUP_WINDOW: 30000,         // 30s: Full lookup cycle
    BURST_WINDOW: 20000,          // 20s: Multi-event burst
    SPLIT_SCREEN_WINDOW: 60000,   // 60s: Split screen behavior

    // Burst thresholds
    BURST_MIN_EVENTS: 4,          // 4+ events = burst

    // Split screen detection
    BLUR_FOCUS_MIN_PAIRS: 3,      // 3+ blur/focus pairs

    // Cooldown to prevent spam
    PATTERN_COOLDOWN: 30000,      // 30s between same pattern reports
};

// ========== Composite Violation Detector ==========

export class CompositeViolationDetector {
    private events: CompositeEvent[] = [];
    private lastDetectedPatterns: Map<CompositePatternType, number> = new Map();
    private onViolation: ((violation: CompositeViolation) => void) | null = null;

    constructor() {
        this.reset();
    }

    /**
     * Set callback for when composite violation is detected
     */
    setViolationCallback(callback: (violation: CompositeViolation) => void): void {
        this.onViolation = callback;
    }

    /**
     * Reset detector state
     */
    reset(): void {
        this.events = [];
        this.lastDetectedPatterns.clear();
    }

    /**
     * Record an event and check for composite patterns
     */
    recordEvent(type: CompositeEvent['type'], metadata?: Record<string, unknown>): CompositeViolation | null {
        const event: CompositeEvent = {
            type,
            timestamp: Date.now(),
            metadata
        };

        this.events.push(event);

        // Keep last 2 minutes of events
        const cutoff = Date.now() - 120000;
        this.events = this.events.filter(e => e.timestamp > cutoff);

        console.log(`[CompositeDetector] Recorded: ${type}, total events: ${this.events.length}`);

        // Check for patterns after recording event
        return this.detectPatterns();
    }

    /**
     * Check all composite patterns
     */
    private detectPatterns(): CompositeViolation | null {
        // Priority order: most severe first
        const patterns = [
            () => this.detectScreenCapture(),   // Highest priority - clear intent
            () => this.detectSplitScreen(),     // HIGH: includes CRITICAL SPLIT_SCREEN_CAPTURE
            () => this.detectLookupPattern(),
            () => this.detectTabPaste(),
            () => this.detectBlurPaste(),
            () => this.detectMultiEventBurst(),
        ];

        for (const detect of patterns) {
            const violation = detect();
            if (violation && this.shouldReport(violation.pattern)) {
                this.lastDetectedPatterns.set(violation.pattern, Date.now());
                console.log(`[CompositeDetector] 🚨 DETECTED: ${violation.pattern} (${violation.severity})`);

                if (this.onViolation) {
                    this.onViolation(violation);
                }

                return violation;
            }
        }

        return null;
    }

    /**
     * Check cooldown to prevent spam
     */
    private shouldReport(pattern: CompositePatternType): boolean {
        const lastTime = this.lastDetectedPatterns.get(pattern);
        if (!lastTime) return true;
        return Date.now() - lastTime > COMPOSITE_THRESHOLDS.PATTERN_COOLDOWN;
    }

    /**
     * Get recent events within time window
     */
    private getRecentEvents(windowMs: number): CompositeEvent[] {
        const cutoff = Date.now() - windowMs;
        return this.events.filter(e => e.timestamp > cutoff);
    }

    /**
     * Pattern 0: Screenshot Hotkey Detection
     * Scenario: User presses PrtScn/Win+Shift+S to capture exam questions
     * This is the strongest signal - clear intent to capture content
     */
    private detectScreenCapture(): CompositeViolation | null {
        const recent = this.getRecentEvents(COMPOSITE_THRESHOLDS.TAB_PASTE_WINDOW);

        const screenshots = recent.filter(e => e.type === 'SCREENSHOT_ATTEMPT');
        const tabSwitches = recent.filter(e => e.type === 'TAB_SWITCH');
        const pastes = recent.filter(e => e.type === 'PASTE');

        if (screenshots.length > 0) {
            let confidence = 90; // Base confidence for screenshot attempt
            let severity: 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'HIGH';

            // Increase confidence if followed by suspicious behavior
            if (tabSwitches.length > 0 || pastes.length > 0) {
                confidence = 98;
                severity = 'CRITICAL';
            }

            return {
                pattern: 'SCREEN_CAPTURE',
                severity,
                events: [...screenshots, ...tabSwitches, ...pastes],
                confidence,
                description: `Screenshot hotkey detected${tabSwitches.length > 0 || pastes.length > 0 ? ' followed by tab/paste - complete capture attack' : ' - attempting to capture exam content'}`,
                detectedAt: Date.now()
            };
        }

        return null;
    }

    /**
     * Pattern 1: Tab Switch + Paste
     * Scenario: User tabs to ChatGPT, pastes question, tabs back
     */
    private detectTabPaste(): CompositeViolation | null {
        const recent = this.getRecentEvents(COMPOSITE_THRESHOLDS.TAB_PASTE_WINDOW);

        const tabSwitches = recent.filter(e => e.type === 'TAB_SWITCH');
        const pastes = recent.filter(e => e.type === 'PASTE');

        if (tabSwitches.length > 0 && pastes.length > 0) {
            // Find tab switches that happened shortly before a paste (within 5s)
            // This is more accurate than just checking the first tab
            const relevantTabs = tabSwitches.filter(t =>
                pastes.some(p => p.timestamp > t.timestamp && p.timestamp - t.timestamp < 5000)
            );

            if (relevantTabs.length > 0) {
                // Calculate confidence based on time proximity
                const closestPair = relevantTabs.reduce((best, tab) => {
                    const paste = pastes.find(p => p.timestamp > tab.timestamp);
                    if (!paste) return best;
                    const gap = paste.timestamp - tab.timestamp;
                    if (!best || gap < best.gap) {
                        return { tab, paste, gap };
                    }
                    return best;
                }, null as { tab: CompositeEvent; paste: CompositeEvent; gap: number } | null);

                // Confidence increases as time gap decreases
                const baseConfidence = 85;
                const timeBonus = closestPair ? Math.max(0, 10 - (closestPair.gap / 500)) : 0;

                return {
                    pattern: 'TAB_PASTE',
                    severity: 'HIGH',
                    events: [...relevantTabs, ...pastes],
                    confidence: Math.min(95, baseConfidence + timeBonus),
                    description: `Tab switch followed by paste detected (${relevantTabs.length} relevant tabs) - possible lookup attack`,
                    detectedAt: Date.now()
                };
            }
        }

        return null;
    }

    /**
     * Pattern 2: Window Blur + Paste
     * Scenario: Alt-tab to another app, paste content
     */
    private detectBlurPaste(): CompositeViolation | null {
        const recent = this.getRecentEvents(COMPOSITE_THRESHOLDS.BLUR_PASTE_WINDOW);

        const blurs = recent.filter(e => e.type === 'BLUR');
        const pastes = recent.filter(e => e.type === 'PASTE');

        if (blurs.length > 0 && pastes.length > 0) {
            const firstBlur = blurs[0];
            const hasPasteAfterBlur = pastes.some(p => p.timestamp > firstBlur.timestamp);

            if (hasPasteAfterBlur) {
                return {
                    pattern: 'BLUR_PASTE',
                    severity: 'HIGH',
                    events: [...blurs, ...pastes],
                    confidence: 80,
                    description: 'Window blur followed by paste - possible external lookup',
                    detectedAt: Date.now()
                };
            }
        }

        return null;
    }

    /**
     * Pattern 3: Full Lookup Cycle
     * Scenario: Look down at phone + tab away + paste answer
     */
    private detectLookupPattern(): CompositeViolation | null {
        const recent = this.getRecentEvents(COMPOSITE_THRESHOLDS.LOOKUP_WINDOW);

        const preSuspicion = recent.filter(e => e.type === 'PRE_SUSPICION');
        const tabOrBlur = recent.filter(e => e.type === 'TAB_SWITCH' || e.type === 'BLUR');
        const pastes = recent.filter(e => e.type === 'PASTE');

        // Full lookup: pre-suspicion (phone) + tab/blur + paste
        if (preSuspicion.length > 0 && tabOrBlur.length > 0 && pastes.length > 0) {
            return {
                pattern: 'LOOKUP_PATTERN',
                severity: 'CRITICAL',
                events: [...preSuspicion, ...tabOrBlur, ...pastes],
                confidence: 95,
                description: 'CRITICAL: Phone check + tab switch + paste detected - full lookup attack',
                detectedAt: Date.now()
            };
        }

        return null;
    }

    /**
     * Pattern 4: Multi-Event Burst
     * Scenario: Many suspicious events in short time
     */
    private detectMultiEventBurst(): CompositeViolation | null {
        const recent = this.getRecentEvents(COMPOSITE_THRESHOLDS.BURST_WINDOW);

        // Count suspicious events (exclude FOCUS which is normal)
        const suspiciousEvents = recent.filter(e =>
            e.type !== 'FOCUS'
        );

        if (suspiciousEvents.length >= COMPOSITE_THRESHOLDS.BURST_MIN_EVENTS) {
            const severity = suspiciousEvents.length >= 6 ? 'CRITICAL' : 'HIGH';

            return {
                pattern: 'MULTI_EVENT_BURST',
                severity,
                events: suspiciousEvents,
                confidence: Math.min(95, 50 + suspiciousEvents.length * 10),
                description: `${suspiciousEvents.length} suspicious events in ${COMPOSITE_THRESHOLDS.BURST_WINDOW / 1000}s - abnormal activity burst`,
                detectedAt: Date.now()
            };
        }

        return null;
    }

    /**
     * Pattern 5: Split Screen Behavior
     * Scenario: Window resized + frequent blur/focus (reading alongside)
     * Also detects: Resize + Screenshot (capture notes while reading)
     */
    private detectSplitScreen(): CompositeViolation | null {
        const recent = this.getRecentEvents(COMPOSITE_THRESHOLDS.SPLIT_SCREEN_WINDOW);

        const windowResizes = recent.filter(e => e.type === 'WINDOW_RESIZE');
        const blurs = recent.filter(e => e.type === 'BLUR');
        const focuses = recent.filter(e => e.type === 'FOCUS');
        const screenshots = recent.filter(e => e.type === 'SCREENSHOT_ATTEMPT');

        // Check for Resize + Screenshot first (higher priority)
        if (windowResizes.length > 0 && screenshots.length > 0) {
            return {
                pattern: 'SPLIT_SCREEN_CAPTURE',
                severity: 'CRITICAL',
                events: [...windowResizes, ...screenshots, ...blurs, ...focuses],
                confidence: 95,
                description: 'Split screen with screenshot - capturing notes or materials',
                detectedAt: Date.now()
            };
        }

        // Split screen: window resize + multiple blur/focus pairs
        const blurFocusPairs = Math.min(blurs.length, focuses.length);

        if (windowResizes.length > 0 && blurFocusPairs >= COMPOSITE_THRESHOLDS.BLUR_FOCUS_MIN_PAIRS) {
            return {
                pattern: 'SPLIT_SCREEN',
                severity: 'HIGH', // Upgraded from MEDIUM
                events: [...windowResizes, ...blurs, ...focuses],
                confidence: 80, // Higher confidence with resize
                description: 'Window resize with frequent blur/focus - possible split screen usage',
                detectedAt: Date.now()
            };
        }

        return null;
    }

    /**
     * Get current event history for debugging
     */
    getEventHistory(): CompositeEvent[] {
        return [...this.events];
    }

    /**
     * Get statistics
     */
    getStats(): {
        eventCount: number;
        oldestEventAge: number;
        detectedPatternsCount: number;
    } {
        return {
            eventCount: this.events.length,
            oldestEventAge: this.events.length > 0
                ? Date.now() - this.events[0].timestamp
                : 0,
            detectedPatternsCount: this.lastDetectedPatterns.size
        };
    }
}

// Singleton instance
export const compositeDetector = new CompositeViolationDetector();
