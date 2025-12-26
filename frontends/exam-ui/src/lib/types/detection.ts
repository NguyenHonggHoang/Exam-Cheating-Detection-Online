/**
 * Type definitions for TensorFlow.js face detection and proctoring
 */

export interface FaceLandmark {
    x: number;
    y: number;
    z?: number;
}

export interface HeadPose {
    pitch: number;  // Up/down rotation (degrees)
    yaw: number;    // Left/right rotation (degrees)
    roll: number;   // Tilt rotation (degrees)
}

export interface HeadPoseCalibration {
    basePitch: number;
    baseYaw: number;
    baseRoll: number;
    timestamp: number;
}

export interface EyeState {
    left: {
        isOpen: boolean;
        aspectRatio: number;
    };
    right: {
        isOpen: boolean;
        aspectRatio: number;
    };
}

export interface DetectionState {
    faceCount: number;
    confidence: number;
    headPose: HeadPose | null;
    eyeState: EyeState | null;
    landmarks: FaceLandmark[] | null;
    timestamp: number;
}

export type ViolationState = 'OK' | 'GRACE' | 'WARN' | 'SUSPICIOUS' | 'ESCALATE';

export interface ViolationEvent {
    type: 'MULTIPLE_FACES' | 'NO_FACE' | 'LOOKING_AWAY' | 'SUSPICIOUS_MOVEMENT';
    timestamp: number;
    severity: 'low' | 'medium' | 'high';
    metadata?: Record<string, any>;
}
