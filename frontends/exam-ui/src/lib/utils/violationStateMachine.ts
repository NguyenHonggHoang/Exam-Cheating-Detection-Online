/**
 * Violation Types Definition
 * 
 * Aligned with backend Incident types
 */

export type ViolationType =
    | 'MULTIPLE_FACES'
    | 'NO_FACE'
    | 'LOOKING_AWAY'
    | 'TAB_SWITCH'
    | 'PASTE'
    | 'BLUR'
    | 'FOCUS'
    | 'PHONE_DETECTED'
    | 'BROWSER_EXTENSION'
    | 'SCREENSHOT_ATTEMPT';  // Screenshot hotkey detected

export type ViolationSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export type ViolationState = 'OK' | 'WARN' | 'SUSPICIOUS' | 'ESCALATED';

/**
 * Violation configuration
 */
export const VIOLATION_CONFIG: Record<ViolationType, {
    severity: ViolationSeverity;
    debounceMs: number;
    warningThreshold: number;
    suspiciousThreshold: number;
    escalatedThreshold: number;
    message: string;
}> = {
    MULTIPLE_FACES: {
        severity: 'HIGH',
        debounceMs: 3000,  // 3s cooldown to avoid rapid-fire incidents
        warningThreshold: 1,  // Still trigger on first (high severity)
        suspiciousThreshold: 2,
        escalatedThreshold: 3,
        message: 'Multiple people detected in frame'
    },
    NO_FACE: {
        severity: 'MEDIUM',
        debounceMs: 4000,  // 4s cooldown - students may adjust camera
        warningThreshold: 2,  // Need 2 incidents before warning
        suspiciousThreshold: 4,
        escalatedThreshold: 6,
        message: 'Face not visible in camera'
    },
    LOOKING_AWAY: {
        severity: 'LOW',
        debounceMs: 3000,  // 3s cooldown between detections to reduce noise
        warningThreshold: 2,  // Need 2 sustained look-aways (10s total) for warning
        suspiciousThreshold: 4,  // 4 incidents = 20s total looking away
        escalatedThreshold: 6,  // 6 incidents = 30s total
        message: 'Looking away from screen'
    },
    TAB_SWITCH: {
        severity: 'HIGH',
        debounceMs: 0,     // No debounce - catch EVERY switch
        warningThreshold: 1,  // First switch = warning (user might have another tab for notes)
        suspiciousThreshold: 2, // 2 switches = suspicious
        escalatedThreshold: 3,  // 3+ switches = definite cheating pattern
        message: 'Switched to another tab or application'
    },
    PASTE: {
        severity: 'HIGH',
        debounceMs: 0,     // No debounce - every paste is suspicious
        warningThreshold: 1,  // First paste = immediate warning
        suspiciousThreshold: 1,  // Even 1 paste is highly suspicious (why paste in exam?)
        escalatedThreshold: 2,   // 2+ pastes = definite cheating
        message: 'Paste action detected - potentially copying answers'
    },
    BLUR: {
        severity: 'MEDIUM',   // Upgraded from LOW - blur is suspicious in exam
        debounceMs: 1000,     // 1s debounce (catch frequent switching)
        warningThreshold: 2,  // 2 blurs = warning (might be checking other window)
        suspiciousThreshold: 4,  // 4 blurs = pattern of switching
        escalatedThreshold: 6,   // 6+ blurs = definitely using another window
        message: 'Window lost focus - potential second monitor or app usage'
    },
    FOCUS: {
        severity: 'LOW',
        debounceMs: 0,
        warningThreshold: 5,
        suspiciousThreshold: 10,
        escalatedThreshold: 15,
        message: 'Window regained focus'
    },
    PHONE_DETECTED: {
        severity: 'HIGH',
        debounceMs: 5000,
        warningThreshold: 1,
        suspiciousThreshold: 2,
        escalatedThreshold: 3,
        message: 'Phone or device detected'
    },
    BROWSER_EXTENSION: {
        severity: 'MEDIUM',
        debounceMs: 0,
        warningThreshold: 1,
        suspiciousThreshold: 1,
        escalatedThreshold: 1,
        message: 'Suspicious browser extension detected'
    },
    SCREENSHOT_ATTEMPT: {
        severity: 'HIGH',        // HIGH severity - clear intent to capture exam
        debounceMs: 2000,        // 2s debounce to avoid spam from holding key
        warningThreshold: 1,     // First attempt = immediate warning
        suspiciousThreshold: 1,  // Even 1 screenshot is highly suspicious
        escalatedThreshold: 2,   // 2 attempts = definite cheating
        message: 'Screenshot hotkey detected - attempting to capture exam questions'
    }
};

/**
 * Evidence metadata
 */
export interface EvidenceMetadata {
    sessionId: string;
    violationType: ViolationType;
    detectedAt: number;
    consecutiveCount: number;
    state: ViolationState;
    detectionResult?: {
        faceCount: number;
        confidence: number;
        headPose?: { pitch: number; yaw: number; roll: number };
    };
}

/**
 * Violation State Machine
 * 
 * Manages violation detection with debouncing and state transitions
 */
export class ViolationStateMachine {
    private violationCounts: Map<ViolationType, number> = new Map();
    private lastDetection: Map<ViolationType, number> = new Map();
    private firstDetection: Map<ViolationType, number> = new Map();
    private currentStates: Map<ViolationType, ViolationState> = new Map();
    private evidenceUploaded: Map<ViolationType, string[]> = new Map();
    private listeners: Set<(violation: ViolationType, state: ViolationState, count: number) => void> = new Set();
    private lastEvidenceCapture: Map<ViolationType, number> = new Map(); // ADDED: Cooldown for evidence

    /**
     * Process a violation detection
     */
    processViolation(type: ViolationType): boolean {
        const config = VIOLATION_CONFIG[type];
        const now = Date.now();
        const lastTime = this.lastDetection.get(type) || 0;
        const timeSinceLast = now - lastTime;

        // Check debounce
        if (timeSinceLast < config.debounceMs) {
            // Only log occasionally to avoid spam
            if (timeSinceLast < 500) {
                console.log(`[StateMachine] ${type} debounced (${timeSinceLast}ms < ${config.debounceMs}ms)`);
            }
            return false; // Debounced
        }

        // Increment count
        const currentCount = (this.violationCounts.get(type) || 0) + 1;
        this.violationCounts.set(type, currentCount);
        this.lastDetection.set(type, now);

        // Track first detection time
        if (!this.firstDetection.has(type)) {
            this.firstDetection.set(type, now);
        }

        // Determine new state
        let newState: ViolationState = 'OK';
        if (currentCount >= config.escalatedThreshold) {
            newState = 'ESCALATED';
        } else if (currentCount >= config.suspiciousThreshold) {
            newState = 'SUSPICIOUS';
        } else if (currentCount >= config.warningThreshold) {
            newState = 'WARN';
        }

        const oldState = this.currentStates.get(type) || 'OK';
        this.currentStates.set(type, newState);

        console.log(`[StateMachine] ${type}: count=${currentCount} state=${oldState}→${newState} (threshold: warn=${config.warningThreshold})`);

        // Notify listeners
        if (newState !== oldState || newState !== 'OK') {
            this.listeners.forEach(listener => listener(type, newState, currentCount));
        }

        return true; // Violation processed
    }

    /**
     * Get current state for a violation type (full tracker info)
     */
    getState(type: ViolationType): { state: ViolationState; count: number; firstDetected: number } {
        return {
            state: this.currentStates.get(type) || 'OK',
            count: this.violationCounts.get(type) || 0,
            firstDetected: this.firstDetection.get(type) || 0
        };
    }

    /**
     * Get just the state string
     */
    getStateOnly(type: ViolationType): ViolationState {
        return this.currentStates.get(type) || 'OK';
    }

    /**
     * Get count for a violation type
     */
    getCount(type: ViolationType): number {
        return this.violationCounts.get(type) || 0;
    }

    /**
     * Get overall severity (highest across all violations)
     */
    getOverallState(): ViolationState {
        let highest: ViolationState = 'OK';
        const priority = { 'OK': 0, 'WARN': 1, 'SUSPICIOUS': 2, 'ESCALATED': 3 };

        this.currentStates.forEach(state => {
            if (priority[state] > priority[highest]) {
                highest = state;
            }
        });

        return highest;
    }

    /**
     * Get all violation statistics
     */
    getStats(): Record<ViolationType, { count: number; state: ViolationState }> {
        const stats: Partial<Record<ViolationType, { count: number; state: ViolationState }>> = {};

        for (const type of Object.keys(VIOLATION_CONFIG) as ViolationType[]) {
            stats[type] = {
                count: this.violationCounts.get(type) || 0,
                state: this.currentStates.get(type) || 'OK'
            };
        }

        return stats as Record<ViolationType, { count: number; state: ViolationState }>;
    }

    /**
     * Add state change listener
     */
    addListener(listener: (violation: ViolationType, state: ViolationState, count: number) => void) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Process a violation detection and return action + tracker info
     * This is the main method called by useOptimizedDetection
     */
    onViolationDetected(type: ViolationType, timestamp: number): {
        action: 'snapshot' | 'clip' | null;
        tracker: { state: ViolationState; count: number; message: string };
        stateChanged: boolean;
    } {
        const oldState = this.currentStates.get(type) || 'OK';
        const processed = this.processViolation(type);
        const config = VIOLATION_CONFIG[type];
        const stateInfo = this.getState(type);
        const count = this.getCount(type);
        const newState = stateInfo.state;

        // Determine what evidence to capture
        let action: 'snapshot' | 'clip' | null = null;
        if (processed) {
            action = this.shouldCaptureEvidence(type);
        }

        // State changed if:
        // Any violation is detected after debounce
        // This ensures onViolation callback fires EVERY time a violation is detected
        // so the UI can show warning overlays consistently
        const stateTransitioned = oldState !== newState;

        // FIXED: stateChanged should be true whenever a violation is processed
        // This fixes the bug where warnings only showed for first 2 detections
        const stateChanged = processed && newState !== 'OK';

        if (stateChanged) {
            console.log(`[StateMachine] onViolation callback will fire: ${type} state=${newState} count=${count} stateTransitioned=${stateTransitioned}`);
        }

        return {
            action,
            tracker: {
                state: newState,
                count,
                message: config.message
            },
            stateChanged
        };
    }

    /**
     * Reset all states
     */
    reset() {
        this.violationCounts.clear();
        this.lastDetection.clear();
        this.firstDetection.clear();
        this.currentStates.clear();
        this.evidenceUploaded.clear();
        this.lastEvidenceCapture.clear(); // ADDED: Clear evidence cooldown
    }

    /**
     * Called when a violation type is no longer detected
     * Implements decay logic to gradually reduce violation count
     * This allows state to naturally recover to OK
     */
    onNoViolation(type: ViolationType): void {
        const config = VIOLATION_CONFIG[type];
        const currentCount = this.violationCounts.get(type) || 0;
        const lastTime = this.lastDetection.get(type) || 0;
        const now = Date.now();

        // Only decay if enough time has passed since last detection
        // Use debounceMs as the decay interval
        const timeSinceLastViolation = now - lastTime;

        if (currentCount > 0 && timeSinceLastViolation > config.debounceMs * 2) {
            // Decay count by 1
            const newCount = Math.max(0, currentCount - 1);
            this.violationCounts.set(type, newCount);

            // Update state based on new count
            let newState: ViolationState = 'OK';
            if (newCount >= config.escalatedThreshold) {
                newState = 'ESCALATED';
            } else if (newCount >= config.suspiciousThreshold) {
                newState = 'SUSPICIOUS';
            } else if (newCount >= config.warningThreshold) {
                newState = 'WARN';
            }

            const oldState = this.currentStates.get(type) || 'OK';
            if (oldState !== newState) {
                this.currentStates.set(type, newState);
                console.log(`[StateMachine] ${type} decayed: count=${newCount} state=${oldState}→${newState}`);

                // Notify listeners of state recovery
                this.listeners.forEach(listener => listener(type, newState, newCount));
            }
        }
    }

    /**
     * Destroy the state machine (cleanup)
     */
    destroy(): void {
        this.listeners.clear();
        this.reset();
    }

    /**
     * REMOVED: detectCompositePattern() - now handled by compositeViolationDetector.ts
     * This eliminates duplicate logic and centralizes pattern detection
     */

    /**
     * Mark that evidence was uploaded for a violation
     */
    onEvidenceUploaded(type: ViolationType, url: string, evidenceType: 'snapshot' | 'clip'): void {
        const urls = this.evidenceUploaded.get(type) || [];
        urls.push(url);
        this.evidenceUploaded.set(type, urls);
        console.log(`[StateMachine] Evidence ${evidenceType} uploaded for ${type}: ${url}`);
    }

    /**
     * Get uploaded evidence URLs for a violation type
     */
    getEvidenceUrls(type: ViolationType): string[] {
        return this.evidenceUploaded.get(type) || [];
    }

    /**
     * Check if should capture evidence (snapshot or clip)
     * IMPROVED: 
     * 1. Capture evidence for violations with cooldown to prevent spam
     * 2. Longer cooldown for LOW severity, shorter for HIGH
     */
    shouldCaptureEvidence(type: ViolationType): 'snapshot' | 'clip' | null {
        const config = VIOLATION_CONFIG[type];
        const count = this.getCount(type);
        const stateInfo = this.getState(type);
        const state = stateInfo.state;
        const now = Date.now();
        const lastCapture = this.lastEvidenceCapture.get(type) || 0;

        // Cooldown periods based on severity (reduce evidence spam)
        const EVIDENCE_COOLDOWN = {
            'LOW': 30000,      // 30s between captures for low severity
            'MEDIUM': 20000,   // 20s for medium
            'HIGH': 10000      // 10s for high
        };

        const cooldown = EVIDENCE_COOLDOWN[config.severity];
        const timeSinceLastCapture = now - lastCapture;

        console.log(`[StateMachine] shouldCaptureEvidence: ${type} state=${state} count=${count} lastCapture=${(timeSinceLastCapture / 1000).toFixed(1)}s ago cooldown=${cooldown / 1000}s`);

        // Check cooldown first
        if (lastCapture > 0 && timeSinceLastCapture < cooldown) {
            console.log(`[StateMachine] → Evidence capture on cooldown (${((cooldown - timeSinceLastCapture) / 1000).toFixed(1)}s remaining)`);
            return null;
        }

        // Capture evidence based on state
        if (state === 'ESCALATED' || state === 'SUSPICIOUS') {
            // Prefer clip for serious violations
            this.lastEvidenceCapture.set(type, now);
            console.log(`[StateMachine] → Capture CLIP for ${type}`);
            return 'clip';
        }

        if (state === 'WARN') {
            // For HIGH severity warnings, still capture clip (not just snapshot)
            // This ensures TAB_SWITCH, PASTE, MULTIPLE_FACES get video evidence
            if (config.severity === 'HIGH') {
                this.lastEvidenceCapture.set(type, now);
                console.log(`[StateMachine] → Capture CLIP for HIGH severity ${type} at WARN`);
                return 'clip';
            }
            // Snapshot for other warnings
            this.lastEvidenceCapture.set(type, now);
            console.log(`[StateMachine] → Capture SNAPSHOT for ${type}`);
            return 'snapshot';
        }

        console.log(`[StateMachine] → No capture needed for ${type}`);
        return null;
    }
}

// Singleton instance
let machineInstance: ViolationStateMachine | null = null;

export function getViolationStateMachine(): ViolationStateMachine {
    if (!machineInstance) {
        machineInstance = new ViolationStateMachine();
    }
    return machineInstance;
}

export function resetViolationStateMachine(): void {
    if (machineInstance) {
        machineInstance.reset();
    }
    machineInstance = null;
}
