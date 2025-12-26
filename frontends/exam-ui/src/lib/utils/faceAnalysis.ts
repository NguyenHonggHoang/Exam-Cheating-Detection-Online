import { FaceLandmark, HeadPose, EyeState, HeadPoseCalibration } from '../types/detection';
import { getLeftIrisFilter, getRightIrisFilter, resetIrisFilters } from './oneEuroFilter';

/**
 * MediaPipe Face Mesh landmark indices
 * Reference: https://github.com/tensorflow/tfjs-models/tree/master/face-landmarks-detection
 */
const LANDMARK_INDICES = {
    LEFT_EYE: {
        TOP: 159,
        BOTTOM: 145,
        LEFT_CORNER: 33,
        RIGHT_CORNER: 133,
        TOP_INNER: 158,
        BOTTOM_INNER: 153
    },
    RIGHT_EYE: {
        TOP: 386,
        BOTTOM: 374,
        LEFT_CORNER: 362,
        RIGHT_CORNER: 263,
        TOP_INNER: 385,
        BOTTOM_INNER: 380
    },
    // Iris landmarks (available with refineLandmarks: true)
    LEFT_IRIS: {
        CENTER: 468,
        LEFT: 469,
        TOP: 470,
        RIGHT: 471,
        BOTTOM: 472
    },
    RIGHT_IRIS: {
        CENTER: 473,
        LEFT: 474,
        TOP: 475,
        RIGHT: 476,
        BOTTOM: 477
    },
    POSE: {
        NOSE_TIP: 1,
        NOSE_BRIDGE: 168,
        CHIN: 152,
        LEFT_EYE_OUTER: 33,
        RIGHT_EYE_OUTER: 263,
        LEFT_EYE_INNER: 133,
        RIGHT_EYE_INNER: 362,
        FOREHEAD: 10
    }
};

/**
 * Gaze Calibration data from 4-corner calibration
 */
export interface GazeCalibration {
    corners: {
        topLeft: HeadPose;
        topRight: HeadPose;
        bottomLeft: HeadPose;
        bottomRight: HeadPose;
        center: HeadPose;
    };
    boundaries: {
        minPitch: number;  // Looking up limit
        maxPitch: number;  // Looking down limit
        minYaw: number;    // Looking right limit (negative)
        maxYaw: number;    // Looking left limit (positive)
    };
    irisRange?: {
        horizontalRange: number;  // Max left/right iris deviation
        verticalRange: number;    // Max up/down iris deviation
    };
    baselineDistance?: number;  // Baseline interocular distance for face distance calibration
    timestamp: number;
}

/**
 * Kappa angle constants
 * The visual axis (where we actually look) differs from the optical axis by ~5°
 * This asymmetry needs per-eye correction for accurate gaze estimation
 */
export const KAPPA_ANGLE = {
    // Horizontal offset: visual axis points more nasally than optical axis
    LEFT_EYE_HORIZONTAL: 0.05,   // Left eye looks slightly to the right
    RIGHT_EYE_HORIZONTAL: -0.05, // Right eye looks slightly to the left
    // Vertical offset: visual axis points slightly upward
    VERTICAL: 0.02               // Both eyes look slightly up from optical axis
};

/**
 * Iris depth estimation constants
 * Based on average human iris diameter of 11.7mm
 * Used to estimate Z-depth from apparent iris size
 */
export const IRIS_CONSTANTS = {
    AVERAGE_DIAMETER_MM: 11.7,
    // Assumed focal length for typical webcam at 640px width
    // f = (640/2) / tan(fov/2), assuming ~60° horizontal fov
    ASSUMED_FOCAL_LENGTH: 550
};

/**
 * Iris gaze direction with Kappa correction
 */
export interface IrisGaze {
    leftIris: { x: number; y: number };
    rightIris: { x: number; y: number };
    horizontalGaze: number;  // -1 (right) to 1 (left) - Kappa corrected average
    verticalGaze: number;    // -1 (up) to 1 (down) - Kappa corrected average
    // Per-eye corrected gaze (new)
    leftGaze: { horizontal: number; vertical: number };
    rightGaze: { horizontal: number; vertical: number };
    // Raw (uncorrected) values for debugging
    rawHorizontalGaze: number;
    rawVerticalGaze: number;
    // Estimated depth/distance (optional)
    estimatedDepthRatio?: number; // Ratio compared to baseline iris size
}

/**
 * Face quality metrics for detection reliability
 */
export interface FaceQuality {
    brightness: number;        // 0-1, average brightness of face region
    contrast: number;          // 0-1, contrast level
    faceSize: number;          // Relative size of face to frame (0-1)
    faceDistance: number;      // Estimated distance from camera
    isGoodQuality: boolean;    // Overall quality assessment
    warnings: string[];        // Quality warnings
}

/**
 * Analyze face quality from landmarks and canvas
 */
export function analyzeFaceQuality(
    landmarks: FaceLandmark[],
    canvas?: HTMLCanvasElement | null
): FaceQuality {
    const warnings: string[] = [];

    // Calculate face bounding box from landmarks
    const leftEye = landmarks[LANDMARK_INDICES.POSE.LEFT_EYE_OUTER];
    const rightEye = landmarks[LANDMARK_INDICES.POSE.RIGHT_EYE_OUTER];
    const chin = landmarks[LANDMARK_INDICES.POSE.CHIN];
    const forehead = landmarks[LANDMARK_INDICES.POSE.FOREHEAD];

    // Face size relative to normalized coordinates (0-1)
    const faceWidth = Math.abs(rightEye.x - leftEye.x);
    const faceHeight = Math.abs(chin.y - forehead.y);
    const faceSize = faceWidth * faceHeight * 4; // Scale up since face is typically 25% of frame

    // Estimate distance based on inter-eye distance
    // Typical inter-pupillary distance is ~63mm
    // At 50cm distance, this should appear as ~15% of frame width
    const expectedEyeDistance = 0.15; // Expected at optimal distance
    const faceDistance = expectedEyeDistance / Math.max(faceWidth, 0.01);

    // Quality checks
    if (faceSize < 0.05) {
        warnings.push('Face too small - move closer to camera');
    } else if (faceSize > 0.5) {
        warnings.push('Face too large - move back from camera');
    }

    if (faceDistance > 1.5) {
        warnings.push('Too far from camera');
    } else if (faceDistance < 0.5) {
        warnings.push('Too close to camera');
    }

    // Analyze brightness if canvas available
    let brightness = 0.5;
    let contrast = 0.5;

    if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            try {
                // Sample center of face region
                const centerX = (leftEye.x + rightEye.x) / 2 * canvas.width;
                const centerY = ((forehead.y + chin.y) / 2) * canvas.height;
                const sampleSize = Math.min(faceWidth * canvas.width * 0.5, 50);

                const imageData = ctx.getImageData(
                    Math.max(0, centerX - sampleSize / 2),
                    Math.max(0, centerY - sampleSize / 2),
                    Math.min(sampleSize, canvas.width),
                    Math.min(sampleSize, canvas.height)
                );

                // Calculate brightness and contrast
                let sum = 0;
                let sumSq = 0;
                const pixels = imageData.data;
                const numPixels = pixels.length / 4;

                for (let i = 0; i < pixels.length; i += 4) {
                    const luminance = (pixels[i] * 0.299 + pixels[i + 1] * 0.587 + pixels[i + 2] * 0.114) / 255;
                    sum += luminance;
                    sumSq += luminance * luminance;
                }

                brightness = sum / numPixels;
                const variance = (sumSq / numPixels) - (brightness * brightness);
                contrast = Math.sqrt(Math.max(0, variance)) * 2; // Scale to 0-1

                if (brightness < 0.2) {
                    warnings.push('Low lighting - increase room brightness');
                } else if (brightness > 0.8) {
                    warnings.push('Overexposed - reduce lighting or glare');
                }

                if (contrast < 0.1) {
                    warnings.push('Low contrast - check camera or lighting');
                }
            } catch (e) {
                // Ignore canvas read errors
            }
        }
    }

    const isGoodQuality = warnings.length === 0 &&
        faceSize >= 0.05 && faceSize <= 0.5 &&
        brightness >= 0.2 && brightness <= 0.8;

    return {
        brightness,
        contrast,
        faceSize,
        faceDistance,
        isGoodQuality,
        warnings
    };
}

/**
 * Calculate Euclidean distance between two 3D points
 */
function distance(p1: FaceLandmark, p2: FaceLandmark): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = (p2.z || 0) - (p1.z || 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

/**
 * Calculate face distance metrics
 * Uses interocular distance (distance between eyes) as proxy for depth
 * Larger distance = closer to camera
 * 
 * @param landmarks Face landmarks
 * @param videoWidth Video width for normalization
 * @param videoHeight Video height for normalization
 * @param baselineDistance Optional baseline distance for calibration (from calibration phase)
 * @returns Face distance metrics
 */
export function calculateFaceDistance(
    landmarks: FaceLandmark[],
    videoWidth: number,
    videoHeight: number,
    baselineDistance?: number
): {
    relative: number;
    interocularPx: number;
    faceSizePx: number;
} {
    // Calculate interocular distance (distance between outer eye corners)
    const leftEyeOuter = landmarks[LANDMARK_INDICES.POSE.LEFT_EYE_OUTER];
    const rightEyeOuter = landmarks[LANDMARK_INDICES.POSE.RIGHT_EYE_OUTER];

    // Convert normalized coordinates to pixels
    const leftEyePx = { x: leftEyeOuter.x * videoWidth, y: leftEyeOuter.y * videoHeight };
    const rightEyePx = { x: rightEyeOuter.x * videoWidth, y: rightEyeOuter.y * videoHeight };

    const interocularPx = Math.sqrt(
        Math.pow(rightEyePx.x - leftEyePx.x, 2) +
        Math.pow(rightEyePx.y - leftEyePx.y, 2)
    );

    // Calculate face bounding box size (diagonal from forehead to chin)
    const forehead = landmarks[LANDMARK_INDICES.POSE.FOREHEAD];
    const chin = landmarks[LANDMARK_INDICES.POSE.CHIN];
    const foreheadPx = { x: forehead.x * videoWidth, y: forehead.y * videoHeight };
    const chinPx = { x: chin.x * videoWidth, y: chin.y * videoHeight };

    const faceSizePx = Math.sqrt(
        Math.pow(chinPx.x - foreheadPx.x, 2) +
        Math.pow(chinPx.y - foreheadPx.y, 2)
    );

    // Calculate relative distance (1.0 = baseline)
    // If no baseline, use typical interocular distance (~60-70px at 640x480)
    const baseline = baselineDistance || 65;
    const relative = interocularPx / baseline;

    return {
        relative: Number(relative.toFixed(2)),
        interocularPx: Number(interocularPx.toFixed(1)),
        faceSizePx: Number(faceSizePx.toFixed(1))
    };
}

/**
 * Get screen metrics for detection context
 * Different screen sizes and ratios affect detection accuracy
 */
export function getScreenMetrics(): {
    width: number;
    height: number;
    ratio: string;
    devicePixelRatio: number;
} {
    const width = window.screen.width;
    const height = window.screen.height;
    const dpr = window.devicePixelRatio || 1;

    // Calculate aspect ratio
    const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
    const divisor = gcd(width, height);
    const ratioW = width / divisor;
    const ratioH = height / divisor;

    // Common ratios
    const ratio = `${ratioW}:${ratioH}`;

    return {
        width,
        height,
        ratio,
        devicePixelRatio: dpr
    };
}

/**
 * Calculate Eye Aspect Ratio (EAR) for blink detection
 * 
 * Formula: EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
 * 
 * Typical values:
 * - EAR ≈ 0.3-0.4 when eye is open
 * - EAR < 0.25 indicates closed eye (blink)
 */
export function calculateEyeAspectRatio(landmarks: FaceLandmark[]): EyeState {
    // Left eye EAR
    const leftVertical1 = distance(
        landmarks[LANDMARK_INDICES.LEFT_EYE.TOP],
        landmarks[LANDMARK_INDICES.LEFT_EYE.BOTTOM]
    );
    const leftVertical2 = distance(
        landmarks[LANDMARK_INDICES.LEFT_EYE.TOP_INNER],
        landmarks[LANDMARK_INDICES.LEFT_EYE.BOTTOM_INNER]
    );
    const leftHorizontal = distance(
        landmarks[LANDMARK_INDICES.LEFT_EYE.LEFT_CORNER],
        landmarks[LANDMARK_INDICES.LEFT_EYE.RIGHT_CORNER]
    );
    const leftEAR = (leftVertical1 + leftVertical2) / (2.0 * leftHorizontal);

    // Right eye EAR
    const rightVertical1 = distance(
        landmarks[LANDMARK_INDICES.RIGHT_EYE.TOP],
        landmarks[LANDMARK_INDICES.RIGHT_EYE.BOTTOM]
    );
    const rightVertical2 = distance(
        landmarks[LANDMARK_INDICES.RIGHT_EYE.TOP_INNER],
        landmarks[LANDMARK_INDICES.RIGHT_EYE.BOTTOM_INNER]
    );
    const rightHorizontal = distance(
        landmarks[LANDMARK_INDICES.RIGHT_EYE.LEFT_CORNER],
        landmarks[LANDMARK_INDICES.RIGHT_EYE.RIGHT_CORNER]
    );
    const rightEAR = (rightVertical1 + rightVertical2) / (2.0 * rightHorizontal);

    const BLINK_THRESHOLD = 0.25;

    return {
        left: {
            aspectRatio: leftEAR,
            isOpen: leftEAR > BLINK_THRESHOLD
        },
        right: {
            aspectRatio: rightEAR,
            isOpen: rightEAR > BLINK_THRESHOLD
        }
    };
}

/**
 * Calculate iris gaze direction with Kappa correction and signal smoothing
 * 
 * Enhanced features:
 * - One Euro Filter for jitter reduction
 * - Kappa angle correction for per-eye asymmetry
 * - Depth estimation from iris diameter (optional)
 * 
 * Returns horizontal (-1 to 1) and vertical (-1 to 1) gaze direction
 */
export function calculateIrisGaze(landmarks: FaceLandmark[], timestamp?: number): IrisGaze | null {
    // Check if iris landmarks are available (indices 468-477)
    if (landmarks.length < 478) {
        return null;
    }

    const now = timestamp ?? Date.now();

    // Get iris centers
    const leftIrisCenter = landmarks[LANDMARK_INDICES.LEFT_IRIS.CENTER];
    const rightIrisCenter = landmarks[LANDMARK_INDICES.RIGHT_IRIS.CENTER];

    // Get iris boundary points for diameter estimation
    const leftIrisLeft = landmarks[LANDMARK_INDICES.LEFT_IRIS.LEFT];
    const leftIrisRight = landmarks[LANDMARK_INDICES.LEFT_IRIS.RIGHT];
    const rightIrisLeft = landmarks[LANDMARK_INDICES.RIGHT_IRIS.LEFT];
    const rightIrisRight = landmarks[LANDMARK_INDICES.RIGHT_IRIS.RIGHT];

    // Left eye boundaries
    const leftEyeLeft = landmarks[LANDMARK_INDICES.LEFT_EYE.LEFT_CORNER];
    const leftEyeRight = landmarks[LANDMARK_INDICES.LEFT_EYE.RIGHT_CORNER];
    const leftEyeTop = landmarks[LANDMARK_INDICES.LEFT_EYE.TOP];
    const leftEyeBottom = landmarks[LANDMARK_INDICES.LEFT_EYE.BOTTOM];

    // Right eye boundaries
    const rightEyeLeft = landmarks[LANDMARK_INDICES.RIGHT_EYE.LEFT_CORNER];
    const rightEyeRight = landmarks[LANDMARK_INDICES.RIGHT_EYE.RIGHT_CORNER];
    const rightEyeTop = landmarks[LANDMARK_INDICES.RIGHT_EYE.TOP];
    const rightEyeBottom = landmarks[LANDMARK_INDICES.RIGHT_EYE.BOTTOM];

    // Calculate raw iris positions relative to eye boundaries (0-1)
    const leftEyeWidth = Math.abs(leftEyeRight.x - leftEyeLeft.x);
    const leftEyeHeight = Math.abs(leftEyeBottom.y - leftEyeTop.y);
    let leftIrisRelX = leftEyeWidth > 0.001 ? (leftIrisCenter.x - leftEyeLeft.x) / leftEyeWidth : 0.5;
    let leftIrisRelY = leftEyeHeight > 0.001 ? (leftIrisCenter.y - leftEyeTop.y) / leftEyeHeight : 0.5;

    const rightEyeWidth = Math.abs(rightEyeRight.x - rightEyeLeft.x);
    const rightEyeHeight = Math.abs(rightEyeBottom.y - rightEyeTop.y);
    let rightIrisRelX = rightEyeWidth > 0.001 ? (rightIrisCenter.x - rightEyeLeft.x) / rightEyeWidth : 0.5;
    let rightIrisRelY = rightEyeHeight > 0.001 ? (rightIrisCenter.y - rightEyeTop.y) / rightEyeHeight : 0.5;

    // Apply One Euro Filter for signal smoothing (reduces jitter)
    const leftFilter = getLeftIrisFilter();
    const rightFilter = getRightIrisFilter();

    const filteredLeft = leftFilter.filter(leftIrisRelX, leftIrisRelY, now);
    const filteredRight = rightFilter.filter(rightIrisRelX, rightIrisRelY, now);

    leftIrisRelX = filteredLeft.x;
    leftIrisRelY = filteredLeft.y;
    rightIrisRelX = filteredRight.x;
    rightIrisRelY = filteredRight.y;

    // Convert 0-1 range to -1 to 1 (center = 0)
    const leftRawHorizontal = (leftIrisRelX - 0.5) * 2;
    const leftRawVertical = (leftIrisRelY - 0.5) * 2;
    const rightRawHorizontal = (rightIrisRelX - 0.5) * 2;
    const rightRawVertical = (rightIrisRelY - 0.5) * 2;

    // Raw (uncorrected) average gaze
    const rawHorizontalGaze = (leftRawHorizontal + rightRawHorizontal) / 2;
    const rawVerticalGaze = (leftRawVertical + rightRawVertical) / 2;

    // Apply Kappa angle correction per eye
    // The visual axis points more nasally than the optical axis
    const leftCorrectedHorizontal = leftRawHorizontal + KAPPA_ANGLE.LEFT_EYE_HORIZONTAL;
    const leftCorrectedVertical = leftRawVertical + KAPPA_ANGLE.VERTICAL;
    const rightCorrectedHorizontal = rightRawHorizontal + KAPPA_ANGLE.RIGHT_EYE_HORIZONTAL;
    const rightCorrectedVertical = rightRawVertical + KAPPA_ANGLE.VERTICAL;

    // Kappa-corrected average gaze
    const horizontalGaze = (leftCorrectedHorizontal + rightCorrectedHorizontal) / 2;
    const verticalGaze = (leftCorrectedVertical + rightCorrectedVertical) / 2;

    // Estimate depth ratio from iris diameter
    // Larger apparent iris = closer to camera
    const leftIrisDiameter = Math.abs(leftIrisRight.x - leftIrisLeft.x);
    const rightIrisDiameter = Math.abs(rightIrisRight.x - rightIrisLeft.x);
    const avgIrisDiameter = (leftIrisDiameter + rightIrisDiameter) / 2;
    // Baseline: typical iris takes ~0.07 of frame width at comfortable distance
    const BASELINE_IRIS_RATIO = 0.07;
    const estimatedDepthRatio = avgIrisDiameter > 0.001 ? avgIrisDiameter / BASELINE_IRIS_RATIO : 1.0;

    // Detailed logging for tracing (throttled to ~5% of frames)
    if (Math.random() < 0.05) {
        console.log(
            `[IrisGaze] ` +
            `Raw: h=${rawHorizontalGaze.toFixed(3)} v=${rawVerticalGaze.toFixed(3)} | ` +
            `Kappa: h=${horizontalGaze.toFixed(3)} v=${verticalGaze.toFixed(3)} | ` +
            `L[h=${leftCorrectedHorizontal.toFixed(2)} v=${leftCorrectedVertical.toFixed(2)}] ` +
            `R[h=${rightCorrectedHorizontal.toFixed(2)} v=${rightCorrectedVertical.toFixed(2)}] | ` +
            `Depth: ${estimatedDepthRatio.toFixed(2)}x`
        );
    }

    return {
        leftIris: { x: leftIrisRelX, y: leftIrisRelY },
        rightIris: { x: rightIrisRelX, y: rightIrisRelY },
        horizontalGaze: clamp(horizontalGaze, -1, 1),
        verticalGaze: clamp(verticalGaze, -1, 1),
        // Per-eye corrected gaze
        leftGaze: {
            horizontal: clamp(leftCorrectedHorizontal, -1, 1),
            vertical: clamp(leftCorrectedVertical, -1, 1)
        },
        rightGaze: {
            horizontal: clamp(rightCorrectedHorizontal, -1, 1),
            vertical: clamp(rightCorrectedVertical, -1, 1)
        },
        // Raw values for debugging/logging
        rawHorizontalGaze: clamp(rawHorizontalGaze, -1, 1),
        rawVerticalGaze: clamp(rawVerticalGaze, -1, 1),
        // Depth estimation
        estimatedDepthRatio: Number(estimatedDepthRatio.toFixed(3))
    };
}

/**
 * Reset iris filters (call when session ends or face lost)
 */
export { resetIrisFilters };

/**
 * Calculate head pose (Pitch, Yaw, Roll) with calibration offset
 * 
 * IMPROVED FORMULA for better sensitivity
 * - Uses Z-depth from landmarks for more accurate pitch calculation
 * - Raw values are already relative to "looking straight at camera"
 */
export function calculateHeadPose(
    landmarks: FaceLandmark[],
    calibration?: HeadPoseCalibration | null
): HeadPose {
    const leftEye = landmarks[LANDMARK_INDICES.POSE.LEFT_EYE_OUTER];
    const rightEye = landmarks[LANDMARK_INDICES.POSE.RIGHT_EYE_OUTER];
    const leftEyeInner = landmarks[LANDMARK_INDICES.POSE.LEFT_EYE_INNER];
    const rightEyeInner = landmarks[LANDMARK_INDICES.POSE.RIGHT_EYE_INNER];
    const noseTip = landmarks[LANDMARK_INDICES.POSE.NOSE_TIP];
    const noseBridge = landmarks[LANDMARK_INDICES.POSE.NOSE_BRIDGE];
    const chin = landmarks[LANDMARK_INDICES.POSE.CHIN];
    const forehead = landmarks[LANDMARK_INDICES.POSE.FOREHEAD];

    // YAW (left/right head turn): -90° to +90°
    // Using nose position relative to eye center
    const leftEyeToNose = Math.abs(noseTip.x - leftEyeInner.x);
    const rightEyeToNose = Math.abs(noseTip.x - rightEyeInner.x);
    const eyeDistance = distance(leftEye, rightEye);
    const asymmetry = (leftEyeToNose - rightEyeToNose) / eyeDistance;
    // Amplify yaw detection
    const rawYaw = asymmetry * 120; // Was 90, now more sensitive

    // PITCH (up/down head tilt): -90° to +90°
    // Use nose-to-chin and forehead-to-nose ratios for better accuracy
    const faceHeight = distance(forehead, chin);
    const noseToForeheadRatio = (noseTip.y - forehead.y) / faceHeight;
    const noseToChinRatio = (chin.y - noseTip.y) / faceHeight;

    // When looking down: noseToForeheadRatio increases, noseToChinRatio decreases
    // When looking up: noseToForeheadRatio decreases, noseToChinRatio increases
    const pitchRatio = noseToForeheadRatio - noseToChinRatio;
    const rawPitch = pitchRatio * 180; // Scale to degrees

    // ROLL (head tilt): -45° to +45°
    const eyeDeltaX = rightEye.x - leftEye.x;
    const eyeDeltaY = rightEye.y - leftEye.y;
    const rawRoll = Math.atan2(eyeDeltaY, eyeDeltaX) * (180 / Math.PI);

    // Apply calibration offset if available
    const pitch = clamp(rawPitch - (calibration?.basePitch || 0), -90, 90);
    const yaw = clamp(rawYaw - (calibration?.baseYaw || 0), -90, 90);
    const roll = clamp(rawRoll - (calibration?.baseRoll || 0), -45, 45);

    return { pitch, yaw, roll };
}

/**
 * Default thresholds for look-away detection
 * BALANCED: Detect look-away effectively while allowing normal exam reading posture
 * 
 * P (Pitch): + = looking down, - = looking up
 * Y (Yaw): + = turn left, - = turn right
 */
export const LOOK_AWAY_THRESHOLDS = {
    // Head pose thresholds (degrees)
    MAX_PITCH_UP: 20,      // Looking up (e.g., ceiling, other screen)
    MAX_PITCH_DOWN: 30,    // Looking down - BALANCED: strict enough to detect but allows some head tilt
    MAX_YAW: 25,           // Looking left/right (clearly not centered on screen)

    // Iris gaze thresholds (-1 to 1 scale)
    MAX_IRIS_HORIZONTAL: 0.35,  // Looking left/right with eyes only
    MAX_IRIS_VERTICAL: 0.35,    // Looking up/down with eyes only

    // Combined detection - ENABLED for better accuracy
    // Uses BOTH head pose AND iris gaze for more reliable detection
    USE_COMBINED_DETECTION: true,

    // SUSTAINED DURATION: Only trigger after X seconds of CONTINUOUS look-away
    // Reduced from 5s to 3s for better detection sensitivity
    SUSTAINED_SECONDS: 3.0,

    // ========================================
    // 2-TIER LOOK AWAY DETECTION (NEW)
    // ========================================

    // Tier 1: Suspicious Side Glance (soft detection - counting only)
    // Quick glances that are counted but don't immediately trigger violation
    SUSPICIOUS_GLANCE: {
        YAW_THRESHOLD: 15,          // degrees - lower than MAX_YAW for quick glances
        GAZE_THRESHOLD: 0.35,       // iris gaze for combined check
        MIN_DURATION_MS: 1200,      // 1.2s - minimum to count as suspicious (not accidental)
        MAX_DURATION_MS: 2500,      // below hard violation threshold
        WINDOW_MS: 60000,           // 60s window for counting glances
        COUNT_FOR_VIOLATION: 3      // 3+ suspicious glances = hard violation
    },

    // Tier 2: Hard Violation
    // Immediate violation trigger, either by duration or repeated glances
    HARD_VIOLATION: {
        DURATION_MS: 2500,          // 2.5s continuous = immediate violation (reduced from 5s)
        // OR triggered by SUSPICIOUS_GLANCE.COUNT_FOR_VIOLATION
    },

    // Calibration margin multiplier
    CALIBRATION_MARGIN: 1.3,  // 30% margin beyond calibrated range

    // Face distance adjustment
    // When user is closer/farther from camera, detection sensitivity changes
    // Closer (>1.2x) = stricter thresholds (smaller movements are more visible)
    // Farther (<0.8x) = looser thresholds (larger movements needed)
    DISTANCE_ADJUSTMENT: {
        CLOSE_THRESHOLD: 1.2,    // >1.2x = very close to camera
        FAR_THRESHOLD: 0.8,      // <0.8x = far from camera
        CLOSE_MULTIPLIER: 0.8,   // Stricter (reduce thresholds by 20%)
        FAR_MULTIPLIER: 1.3,     // Looser (increase thresholds by 30%)
        // Dynamic threshold: arctan(200/D) + 5° where D = distance in mm (virtual)
        USE_DYNAMIC_FORMULA: true,
        ARCTAN_CONSTANT: 200,    // Used in arctan(CONSTANT/D) formula
        ARCTAN_OFFSET: 5         // Base offset in degrees
    }
};

/**
 * Adjust detection thresholds based on face distance
 * 
 * Uses dynamic formula from research: θ = arctan(CONSTANT/D) + OFFSET
 * This provides more accurate thresholds based on actual viewing geometry.
 * 
 * Closer faces = stricter thresholds (small movements more visible)
 * Farther faces = looser thresholds (need larger movements)
 */
export function adjustThresholdsForDistance(
    baseThresholds: { maxPitchUp: number; maxPitchDown: number; maxYaw: number },
    faceDistance: number
): { maxPitchUp: number; maxPitchDown: number; maxYaw: number } {
    const distConfig = LOOK_AWAY_THRESHOLDS.DISTANCE_ADJUSTMENT;

    // Use dynamic arctan formula if enabled
    if (distConfig.USE_DYNAMIC_FORMULA && faceDistance > 0) {
        // Convert relative distance to virtual mm (assuming 1.0 = 500mm)
        const virtualDistanceMm = faceDistance * 500;

        // Dynamic threshold: arctan(CONSTANT/D) + OFFSET
        // At 500mm: arctan(200/500) + 5 ≈ 21.8° + 5° = 26.8°
        // At 800mm: arctan(200/800) + 5 ≈ 14.0° + 5° = 19.0° (farther = larger threshold)
        // At 300mm: arctan(200/300) + 5 ≈ 33.7° + 5° = 38.7° (closer = smaller threshold)
        const dynamicAngle = Math.atan(distConfig.ARCTAN_CONSTANT / virtualDistanceMm) * (180 / Math.PI) + distConfig.ARCTAN_OFFSET;

        // Use dynamic angle as a multiplier ratio compared to base (use 25° as reference)
        const baseReference = 25; // degrees
        const multiplier = dynamicAngle / baseReference;

        return {
            maxPitchUp: baseThresholds.maxPitchUp * multiplier,
            maxPitchDown: baseThresholds.maxPitchDown * multiplier,
            maxYaw: baseThresholds.maxYaw * multiplier
        };
    }

    // Fallback to simple multiplier logic
    let multiplier = 1.0;

    if (faceDistance > distConfig.CLOSE_THRESHOLD) {
        // Very close - stricter thresholds
        multiplier = distConfig.CLOSE_MULTIPLIER;
    } else if (faceDistance < distConfig.FAR_THRESHOLD) {
        // Far away - looser thresholds
        multiplier = distConfig.FAR_MULTIPLIER;
    }

    return {
        maxPitchUp: baseThresholds.maxPitchUp * multiplier,
        maxPitchDown: baseThresholds.maxPitchDown * multiplier,
        maxYaw: baseThresholds.maxYaw * multiplier
    };
}

/**
 * Detect suspicious side glance (Tier 1)
 * Returns true if the glance is suspicious but not yet a hard violation
 */
export function isSuspiciousGlance(
    headPose: HeadPose,
    irisGaze: IrisGaze | null,
    durationMs: number
): boolean {
    const config = LOOK_AWAY_THRESHOLDS.SUSPICIOUS_GLANCE;

    // Check if within suspicious duration range (1.2s - 2.5s)
    if (durationMs < config.MIN_DURATION_MS || durationMs >= config.MAX_DURATION_MS) {
        return false;
    }

    // Log glance detection analysis (when in suspicious range)
    const yaw = Math.abs(headPose.yaw);
    const gazeH = irisGaze ? Math.abs(irisGaze.horizontalGaze) : 0;
    console.log(
        `[SuspiciousGlance] Checking: ` +
        `yaw=${yaw.toFixed(1)}°/${config.YAW_THRESHOLD}° ` +
        `gaze=${gazeH.toFixed(2)}/${config.GAZE_THRESHOLD} ` +
        `duration=${(durationMs / 1000).toFixed(1)}s ` +
        `range=[${(config.MIN_DURATION_MS / 1000).toFixed(1)}-${(config.MAX_DURATION_MS / 1000).toFixed(1)}s]`
    );

    // Check yaw threshold (lower than MAX_YAW for quicker detection)
    const isYawSuspicious = Math.abs(headPose.yaw) > config.YAW_THRESHOLD;

    // Check iris gaze (if available)
    const isIrisGazeSuspicious = irisGaze
        ? Math.abs(irisGaze.horizontalGaze) > config.GAZE_THRESHOLD
        : false;

    // Combined check: yaw OR (yaw near threshold AND iris confirms)
    if (isYawSuspicious) {
        return true;
    }

    // Lower yaw + strong iris = still suspicious
    if (Math.abs(headPose.yaw) > config.YAW_THRESHOLD * 0.7 && isIrisGazeSuspicious) {
        return true;
    }

    return false;
}

/**
 * Result of comprehensive effective gaze calculation
 */
export interface EffectiveGazeResult {
    // Final effective gaze angles (after all adjustments)
    effectivePitch: number;
    effectiveYaw: number;

    // Raw components
    headPose: { pitch: number; yaw: number };
    irisContribution: { pitch: number; yaw: number };

    // Adjustment factors applied
    adjustments: {
        distanceMultiplier: number;      // From face distance
        screenScaleFactor: number;       // From screen metrics
        calibrationApplied: boolean;     // Whether calibration was used
    };

    // Final thresholds (after all adjustments)
    thresholds: {
        maxPitchUp: number;
        maxPitchDown: number;
        maxYaw: number;
    };

    // Violation detection
    isViolation: boolean;
    violationDirection: 'up' | 'down' | 'left' | 'right' | 'none';
    violationSeverity: number;  // 0-1 scale, how far beyond threshold

    // Confidence score (0-1) based on data quality
    confidence: number;
}

/**
 * Screen-based adjustment factors
 * Larger screens may need different sensitivity
 */
export const SCREEN_ADJUSTMENT = {
    // Reference screen (1080p at 100% DPR)
    REFERENCE_WIDTH: 1920,
    REFERENCE_HEIGHT: 1080,
    REFERENCE_DPR: 1.0,

    // Adjustment factors
    // Larger screens: user may move head more naturally
    // Higher DPR (4K/Retina): may need finer detection
    LARGE_SCREEN_THRESHOLD: 2560,    // > 2560px = large screen
    LARGE_SCREEN_MULTIPLIER: 1.15,   // 15% looser thresholds
    SMALL_SCREEN_THRESHOLD: 1366,    // < 1366px = small screen
    SMALL_SCREEN_MULTIPLIER: 0.9,    // 10% stricter thresholds

    // High DPR adjustment
    HIGH_DPR_THRESHOLD: 2.0,         // DPR >= 2 (Retina/4K)
    HIGH_DPR_MULTIPLIER: 0.95        // 5% stricter (more precision needed)
};

/**
 * Calculate screen-based threshold adjustment
 */
export function calculateScreenAdjustment(screenMetrics?: ReturnType<typeof getScreenMetrics>): number {
    if (!screenMetrics) return 1.0;

    let multiplier = 1.0;

    // Screen size adjustment
    if (screenMetrics.width >= SCREEN_ADJUSTMENT.LARGE_SCREEN_THRESHOLD) {
        multiplier *= SCREEN_ADJUSTMENT.LARGE_SCREEN_MULTIPLIER;
    } else if (screenMetrics.width <= SCREEN_ADJUSTMENT.SMALL_SCREEN_THRESHOLD) {
        multiplier *= SCREEN_ADJUSTMENT.SMALL_SCREEN_MULTIPLIER;
    }

    // High DPR adjustment (Retina/4K displays)
    if (screenMetrics.devicePixelRatio >= SCREEN_ADJUSTMENT.HIGH_DPR_THRESHOLD) {
        multiplier *= SCREEN_ADJUSTMENT.HIGH_DPR_MULTIPLIER;
    }

    return multiplier;
}

/**
 * Calculate comprehensive effective gaze using all available metrics
 * 
 * This function combines:
 * 1. Head pose (primary signal)
 * 2. Iris gaze (eye tracking for compensation)
 * 3. Face distance (depth-based threshold adjustment)
 * 4. Screen metrics (screen size/DPR-based adjustment)
 * 5. Calibration data (personalized thresholds)
 * 
 * @returns Complete effective gaze result with all metrics
 */
export function calculateEffectiveGaze(
    headPose: HeadPose,
    options: {
        irisGaze?: IrisGaze | null;
        faceDistance?: number;
        screenMetrics?: ReturnType<typeof getScreenMetrics>;
        calibration?: GazeCalibration | null;
    } = {}
): EffectiveGazeResult {
    const { irisGaze, faceDistance, screenMetrics, calibration } = options;

    // Step 1: Get base thresholds (from calibration or defaults)
    const margin = LOOK_AWAY_THRESHOLDS.CALIBRATION_MARGIN;
    const calibrationApplied = !!calibration?.boundaries;

    let baseThresholds = calibration?.boundaries
        ? {
            maxPitchUp: Math.abs(calibration.boundaries.minPitch) * margin,
            maxPitchDown: calibration.boundaries.maxPitch * margin,
            maxYaw: Math.max(
                Math.abs(calibration.boundaries.minYaw),
                calibration.boundaries.maxYaw
            ) * margin
        }
        : {
            maxPitchUp: LOOK_AWAY_THRESHOLDS.MAX_PITCH_UP,
            maxPitchDown: LOOK_AWAY_THRESHOLDS.MAX_PITCH_DOWN,
            maxYaw: LOOK_AWAY_THRESHOLDS.MAX_YAW
        };

    // Step 2: Apply face distance adjustment
    let distanceMultiplier = 1.0;
    if (faceDistance) {
        if (faceDistance > LOOK_AWAY_THRESHOLDS.DISTANCE_ADJUSTMENT.CLOSE_THRESHOLD) {
            distanceMultiplier = LOOK_AWAY_THRESHOLDS.DISTANCE_ADJUSTMENT.CLOSE_MULTIPLIER;
        } else if (faceDistance < LOOK_AWAY_THRESHOLDS.DISTANCE_ADJUSTMENT.FAR_THRESHOLD) {
            distanceMultiplier = LOOK_AWAY_THRESHOLDS.DISTANCE_ADJUSTMENT.FAR_MULTIPLIER;
        }
    }

    // Step 3: Apply screen metrics adjustment
    const screenScaleFactor = calculateScreenAdjustment(screenMetrics);

    // Step 4: Combine all adjustments into final thresholds
    const combinedMultiplier = distanceMultiplier * screenScaleFactor;
    const finalThresholds = {
        maxPitchUp: baseThresholds.maxPitchUp * combinedMultiplier,
        maxPitchDown: baseThresholds.maxPitchDown * combinedMultiplier,
        maxYaw: baseThresholds.maxYaw * combinedMultiplier
    };

    // Step 5: Calculate iris contribution to effective gaze
    // Iris gaze range: -1 to +1 maps to approximately ±30° eye movement
    // This value is scaled by face distance (closer = more precise iris tracking)
    let irisCompensationDegrees = 30;
    if (faceDistance) {
        // Closer faces have more reliable iris tracking
        irisCompensationDegrees *= Math.min(1.2, Math.max(0.8, faceDistance));
    }

    const irisContribution = irisGaze
        ? {
            pitch: irisGaze.verticalGaze * irisCompensationDegrees,
            yaw: irisGaze.horizontalGaze * irisCompensationDegrees
        }
        : { pitch: 0, yaw: 0 };

    // Step 6: Calculate effective gaze (head + iris)
    const effectivePitch = headPose.pitch + irisContribution.pitch;
    const effectiveYaw = headPose.yaw + irisContribution.yaw;

    // Step 7: Check for violations
    const lookingUp = effectivePitch < -finalThresholds.maxPitchUp;
    const lookingDown = effectivePitch > finalThresholds.maxPitchDown;
    const lookingLeft = effectiveYaw > finalThresholds.maxYaw;
    const lookingRight = effectiveYaw < -finalThresholds.maxYaw;

    const isViolation = lookingUp || lookingDown || lookingLeft || lookingRight;

    // Determine violation direction
    let violationDirection: 'up' | 'down' | 'left' | 'right' | 'none' = 'none';
    if (lookingUp) violationDirection = 'up';
    else if (lookingDown) violationDirection = 'down';
    else if (lookingLeft) violationDirection = 'left';
    else if (lookingRight) violationDirection = 'right';

    // Calculate violation severity (how far beyond threshold)
    let violationSeverity = 0;
    if (isViolation) {
        const pitchExcess = lookingUp
            ? (-effectivePitch - finalThresholds.maxPitchUp) / finalThresholds.maxPitchUp
            : lookingDown
                ? (effectivePitch - finalThresholds.maxPitchDown) / finalThresholds.maxPitchDown
                : 0;
        const yawExcess = (lookingLeft || lookingRight)
            ? (Math.abs(effectiveYaw) - finalThresholds.maxYaw) / finalThresholds.maxYaw
            : 0;
        violationSeverity = Math.min(1, Math.max(pitchExcess, yawExcess));
    }

    // Step 8: Calculate confidence score based on data quality
    let confidence = 0.5; // Base confidence

    // Has iris data → higher confidence
    if (irisGaze) confidence += 0.2;

    // Has face distance → higher confidence
    if (faceDistance && faceDistance > 0.5 && faceDistance < 2.0) confidence += 0.15;

    // Has calibration → higher confidence
    if (calibrationApplied) confidence += 0.15;

    // Clamp to 0-1
    confidence = Math.min(1, confidence);

    return {
        effectivePitch: Number(effectivePitch.toFixed(1)),
        effectiveYaw: Number(effectiveYaw.toFixed(1)),
        headPose: {
            pitch: Number(headPose.pitch.toFixed(1)),
            yaw: Number(headPose.yaw.toFixed(1))
        },
        irisContribution: {
            pitch: Number(irisContribution.pitch.toFixed(1)),
            yaw: Number(irisContribution.yaw.toFixed(1))
        },
        adjustments: {
            distanceMultiplier: Number(distanceMultiplier.toFixed(2)),
            screenScaleFactor: Number(screenScaleFactor.toFixed(2)),
            calibrationApplied
        },
        thresholds: {
            maxPitchUp: Number(finalThresholds.maxPitchUp.toFixed(1)),
            maxPitchDown: Number(finalThresholds.maxPitchDown.toFixed(1)),
            maxYaw: Number(finalThresholds.maxYaw.toFixed(1))
        },
        isViolation,
        violationDirection,
        violationSeverity: Number(violationSeverity.toFixed(2)),
        confidence: Number(confidence.toFixed(2))
    };
}

/**
 * Detect if user is looking away based on head pose and iris gaze
 * 
 * COMPREHENSIVE DETECTION using calculateEffectiveGaze():
 * 1. Head pose (primary signal)
 * 2. Iris gaze (eye tracking for compensation)
 * 3. Face distance (depth-based threshold adjustment)
 * 4. Screen metrics (screen size/DPR-based adjustment)
 * 5. Calibration data (personalized thresholds)
 * 
 * @param headPose - Current head pose
 * @param irisGaze - Optional iris gaze data for more accuracy
 * @param calibration - Optional gaze calibration from 4-corner calibration
 * @param faceDistance - Optional face distance relative to baseline (1.0 = baseline)
 * @param screenMetrics - Optional screen metrics for size-based adjustment
 */
export function isLookingAway(
    headPose: HeadPose,
    irisGaze?: IrisGaze | null,
    calibration?: GazeCalibration | null,
    faceDistance?: number,
    screenMetrics?: ReturnType<typeof getScreenMetrics>
): boolean {
    // Use the comprehensive effective gaze calculation
    const effectiveGaze = calculateEffectiveGaze(headPose, {
        irisGaze,
        faceDistance,
        screenMetrics,
        calibration
    });

    // Debug logging (throttled to every 2 seconds)
    const now = Date.now();
    if (!isLookingAway._lastLog || now - isLookingAway._lastLog > 2000) {
        isLookingAway._lastLog = now;
        const irisInfo = irisGaze
            ? ` | Iris: h=${irisGaze.horizontalGaze.toFixed(2)} v=${irisGaze.verticalGaze.toFixed(2)}`
            : '';
        const distInfo = faceDistance ? ` | Dist: ${faceDistance.toFixed(2)}x` : '';
        const screenInfo = screenMetrics ? ` | Screen: ${screenMetrics.width}x${screenMetrics.height}` : '';

        console.log(`[LookAway] Effective: pitch=${effectiveGaze.effectivePitch}° yaw=${effectiveGaze.effectiveYaw}° | ` +
            `Raw: P=${effectiveGaze.headPose.pitch}° Y=${effectiveGaze.headPose.yaw}° | ` +
            `Thresholds: up=${effectiveGaze.thresholds.maxPitchUp}° down=${effectiveGaze.thresholds.maxPitchDown}° yaw=${effectiveGaze.thresholds.maxYaw}°${irisInfo}${distInfo}${screenInfo} | ` +
            `Violation=${effectiveGaze.isViolation} (${effectiveGaze.violationDirection}) conf=${effectiveGaze.confidence}`);
    }

    // Additional compensation check for COMBINED DETECTION MODE
    // Only apply when we have iris data
    if (LOOK_AWAY_THRESHOLDS.USE_COMBINED_DETECTION && irisGaze) {
        // Strong iris deviation in OPPOSITE direction means compensation
        // Example: Head down 40° + iris up -0.8 = looking at screen, not violation
        // Made STRICTER: only compensate for very extreme cases
        const irisCompensatingPitch = (headPose.pitch > 35 && irisGaze.verticalGaze < -0.6) ||
            (headPose.pitch < -25 && irisGaze.verticalGaze > 0.6);
        const irisCompensatingYaw = (headPose.yaw > 20 && irisGaze.horizontalGaze < -0.5) ||
            (headPose.yaw < -20 && irisGaze.horizontalGaze > 0.5);

        // If iris is compensating for head pose, likely still looking at screen
        if (irisCompensatingPitch || irisCompensatingYaw) {
            if (now - isLookingAway._lastLog > 3000) {
                console.log(`[LookAway] Iris compensation detected - NOT violation`);
            }
            return false; // Not looking away, eyes compensating
        }
    }

    return effectiveGaze.isViolation;
}

// Static variables for throttling
isLookingAway._lastLog = 0;
isLookingAway._lastEffectiveLog = 0;


/**
 * Get detailed look-away information for debugging/UI
 */
export function getLookAwayDetails(
    headPose: HeadPose,
    irisGaze?: IrisGaze | null,
    calibration?: GazeCalibration | null
): {
    isLooking: boolean;
    direction: 'up' | 'down' | 'left' | 'right' | 'center';
    confidence: number;
    details: string;
} {
    const thresholds = calibration?.boundaries
        ? {
            maxPitchUp: Math.abs(calibration.boundaries.minPitch) * 1.2,
            maxPitchDown: calibration.boundaries.maxPitch * 1.2,
            maxYaw: Math.max(
                Math.abs(calibration.boundaries.minYaw),
                calibration.boundaries.maxYaw
            ) * 1.2
        }
        : {
            maxPitchUp: LOOK_AWAY_THRESHOLDS.MAX_PITCH_UP,
            maxPitchDown: LOOK_AWAY_THRESHOLDS.MAX_PITCH_DOWN,
            maxYaw: LOOK_AWAY_THRESHOLDS.MAX_YAW
        };

    // Determine primary direction
    let direction: 'up' | 'down' | 'left' | 'right' | 'center' = 'center';
    let confidence = 0;
    let details = '';

    if (headPose.pitch < -thresholds.maxPitchUp) {
        direction = 'up';
        confidence = Math.min(1, Math.abs(headPose.pitch) / 45);
        details = `Looking up (pitch: ${headPose.pitch.toFixed(1)}°)`;
    } else if (headPose.pitch > thresholds.maxPitchDown) {
        direction = 'down';
        confidence = Math.min(1, headPose.pitch / 45);
        details = `Looking down at documents (pitch: ${headPose.pitch.toFixed(1)}°)`;
    } else if (headPose.yaw < -thresholds.maxYaw) {
        direction = 'right';
        confidence = Math.min(1, Math.abs(headPose.yaw) / 45);
        details = `Looking right (yaw: ${headPose.yaw.toFixed(1)}°)`;
    } else if (headPose.yaw > thresholds.maxYaw) {
        direction = 'left';
        confidence = Math.min(1, headPose.yaw / 45);
        details = `Looking left (yaw: ${headPose.yaw.toFixed(1)}°)`;
    } else {
        details = 'Looking at screen';
    }

    // Add iris info if available
    if (irisGaze && direction === 'center') {
        if (Math.abs(irisGaze.horizontalGaze) > LOOK_AWAY_THRESHOLDS.MAX_IRIS_HORIZONTAL) {
            direction = irisGaze.horizontalGaze > 0 ? 'left' : 'right';
            details = `Eyes looking ${direction} (iris: ${irisGaze.horizontalGaze.toFixed(2)})`;
            confidence = Math.abs(irisGaze.horizontalGaze);
        } else if (Math.abs(irisGaze.verticalGaze) > LOOK_AWAY_THRESHOLDS.MAX_IRIS_VERTICAL) {
            direction = irisGaze.verticalGaze > 0 ? 'down' : 'up';
            details = `Eyes looking ${direction} (iris: ${irisGaze.verticalGaze.toFixed(2)})`;
            confidence = Math.abs(irisGaze.verticalGaze);
        }
    }

    return {
        isLooking: direction !== 'center',
        direction,
        confidence,
        details
    };
}

/**
 * Detect blink (both eyes closed simultaneously)
 */
export function isBlinking(eyeState: EyeState): boolean {
    return !eyeState.left.isOpen && !eyeState.right.isOpen;
}

/**
 * Calculate blink rate over time window (for liveness detection)
 */
export function calculateBlinkRate(
    blinkHistory: boolean[],
    windowSeconds: number = 10
): number {
    const blinks = blinkHistory.filter(b => b).length;
    return (blinks / windowSeconds) * 60; // Convert to blinks/minute
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}
