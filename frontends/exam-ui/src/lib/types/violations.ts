/**
 * Violation Types and State Management
 * 
 * Defines violation categories and state machine for evidence collection
 * ALIGNED with violationStateMachine.ts
 */

export type ViolationType =
    | 'MULTIPLE_FACES'      // More than 1 face detected
    | 'NO_FACE'             // No face detected  
    | 'LOOKING_AWAY'        // Head pose outside threshold
    | 'TAB_SWITCH'          // Browser visibility change
    | 'PASTE'               // Clipboard paste event
    | 'BLUR'                // Window lost focus
    | 'FOCUS'               // Window gained focus
    | 'PHONE_DETECTED'      // Phone/device detected
    | 'BROWSER_EXTENSION'   // Suspicious extension
    | 'SCREENSHOT_ATTEMPT'; // Screenshot hotkey detected (PrtScn, Win+Shift+S, etc.)

export type ViolationState =
    | 'OK'                  // No issues detected
    | 'WARN'                // Potential issue, monitoring
    | 'SUSPICIOUS'          // Clear violation, needs evidence
    | 'ESCALATED';          // Evidence collected and sent

export type EvidenceType = 'snapshot' | 'clip';

export interface ViolationTracker {
    type: ViolationType;
    state: ViolationState;
    count: number;                  // Consecutive detection count
    firstDetected: number;          // Timestamp of first detection
    lastDetected: number;           // Timestamp of last detection
    evidenceCollected: boolean;     // Whether evidence has been uploaded
    evidenceUrls: string[];         // URLs of uploaded evidence
}

export interface DetectionThresholds {
    // Debounce settings
    debounceWindow: number;         // Time window for counting (ms)
    debounceCount: number;          // Required detections in window

    // State transitions
    warnThreshold: number;          // OK → WARN
    suspiciousThreshold: number;    // WARN → SUSPICIOUS

    // Evidence collection
    snapshotDelay: number;          // Delay before snapshot (ms)
    clipPreBuffer: number;          // Pre-buffer for clips (seconds)
    clipPostBuffer: number;         // Post-buffer for clips (seconds)

    // Upload throttling
    maxSnapshotsPerMinute: number;
    maxClipsPerMinute: number;
    minUploadInterval: number;      // Min time between uploads (ms)
}

export const DEFAULT_THRESHOLDS: DetectionThresholds = {
    debounceWindow: 5000,           // 5 seconds
    debounceCount: 3,               // 3 detections

    warnThreshold: 2,
    suspiciousThreshold: 3,

    snapshotDelay: 1000,            // 1 second
    clipPreBuffer: 10,              // 10 seconds
    clipPostBuffer: 10,             // 10 seconds

    maxSnapshotsPerMinute: 5,
    maxClipsPerMinute: 2,
    minUploadInterval: 10000        // 10 seconds
};

export interface DetectionConfig {
    mode: 'lightweight' | 'balanced' | 'accurate';
    thresholds: DetectionThresholds;
    enabledViolations: ViolationType[];
}

export const DEFAULT_CONFIG: DetectionConfig = {
    mode: 'balanced',  // Optimized for Hybrid AI
    thresholds: DEFAULT_THRESHOLDS,
    enabledViolations: [
        'MULTIPLE_FACES',
        'NO_FACE',
        'LOOKING_AWAY',
        'TAB_SWITCH'
    ]
};

/**
 * Detection result from TensorFlow
 */
export interface DetectionResult {
    faceCount: number;
    confidence: number;
    headPose: {
        pitch: number;  // Up/down
        yaw: number;    // Left/right
        roll: number;   // Tilt
    } | null;
    eyeState: {
        leftEyeOpen: boolean;
        rightEyeOpen: boolean;
        aspectRatio: number;
    } | null;
    irisGaze: {
        horizontalGaze: number;  // -1 (left) to 1 (right)
        verticalGaze: number;    // -1 (up) to 1 (down)
    } | null;
    effectiveGaze: {
        pitch: number;  // Combined head + iris pitch
        yaw: number;    // Combined head + iris yaw
    } | null;
    faceDistance: {
        relative: number;     // Relative distance (1.0 = baseline, >1 = closer, <1 = farther)
        interocularPx: number; // Distance between eyes in pixels
        faceSizePx: number;    // Face bounding box diagonal in pixels
    } | null;
    screenMetrics: {
        width: number;        // Screen width in pixels
        height: number;       // Screen height in pixels
        ratio: string;        // Aspect ratio (e.g., "16:9", "16:10")
        devicePixelRatio: number; // DPR for high-res displays
    } | null;
    timestamp: number;
}

/**
 * Evidence metadata for upload
 */
export interface EvidenceMetadata {
    sessionId: string;
    objectKey: string;
    publicUrl: string;
    type: EvidenceType;
    violationType: ViolationType;
    violationState: ViolationState;
    timestamp: number;
    fileSize: number;

    // Detection context
    detectionResult?: DetectionResult;

    // Debounce info
    consecutiveCount?: number;
    firstDetectedAt?: number;
}
