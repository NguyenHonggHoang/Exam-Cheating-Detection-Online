/**
 * Face Quality Detection Utilities
 * 
 * PURPOSE: UI/Calibration-focused face quality analysis
 * - Used during identity verification and calibration phases
 * - Provides detailed metrics for user guidance UI
 * - Draws visual guides (oval frame, dimmed overlay)
 * - Vietnamese language suggestions for user feedback
 * 
 * NOTE: This is SEPARATE from analyzeFaceQuality() in faceAnalysis.ts:
 * - faceAnalysis.ts → Detection phase (lightweight, real-time)
 * - faceQuality.ts → Calibration phase (comprehensive, user-facing)
 * 
 * Analyzes:
 * - Face detection and positioning
 * - Lighting analysis (brightness/contrast)
 * - Sharpness detection
 * - Head pose (frontal check)
 * - Eye visibility
 * 
 * Optimized for: UI guidance + identity verification quality
 */

import type { HeadPose } from '@/lib/types/detection';

export interface FaceBoundingBox {
    x: number;      // Left edge
    y: number;      // Top edge
    width: number;
    height: number;
}

export interface FaceQualityMetrics {
    // Detection
    faceDetected: boolean;
    faceCount: number;
    faceBoundingBox: FaceBoundingBox | null;

    // Positioning
    faceInFrame: boolean;       // Face is within the oval guide
    faceCentered: boolean;      // Face is centered in frame
    faceSizeOk: boolean;        // Face size is appropriate (not too small/large)
    faceSizePercent: number;    // Face size as % of frame

    // Quality
    lightingOk: boolean;        // Good lighting conditions
    brightness: number;         // 0-255 average brightness
    contrast: number;           // Contrast level
    sharpnessOk: boolean;       // Face is in focus
    sharpness: number;          // Sharpness score

    // Pose
    faceFrontal: boolean;       // Looking at camera
    headPose: HeadPose | null;

    // Eyes
    eyesVisible: boolean;       // Both eyes detected
    eyesOpen: boolean;          // Eyes are open

    // Overall
    overallQuality: 'excellent' | 'good' | 'acceptable' | 'poor';
    qualityScore: number;       // 0-100
    passesThreshold: boolean;   // Ready for capture
    suggestions: string[];      // What to improve
}

// Quality thresholds - aligned with faceAnalysis.ts LOOK_AWAY_THRESHOLDS
// These are for calibration UI guidance, slightly stricter than detection thresholds
export const QUALITY_THRESHOLDS = {
    // Face size relative to frame
    MIN_FACE_SIZE_PERCENT: 20,      // Face must be at least 20% of frame
    MAX_FACE_SIZE_PERCENT: 70,      // Face must not exceed 70% of frame
    IDEAL_FACE_SIZE_MIN: 30,        // Ideal range: 30-50%
    IDEAL_FACE_SIZE_MAX: 50,

    // Face positioning (center tolerance)
    CENTER_TOLERANCE_X: 0.15,       // 15% tolerance from center X
    CENTER_TOLERANCE_Y: 0.15,       // 15% tolerance from center Y

    // Brightness (0-255 scale)
    MIN_BRIGHTNESS: 70,             // Not too dark
    MAX_BRIGHTNESS: 210,            // Not too bright/overexposed
    IDEAL_BRIGHTNESS_MIN: 100,
    IDEAL_BRIGHTNESS_MAX: 180,

    // Contrast (std deviation)
    MIN_CONTRAST: 30,               // Enough contrast for face features

    // Sharpness (Laplacian variance)
    MIN_SHARPNESS: 80,              // Sharp enough for recognition
    IDEAL_SHARPNESS: 150,

    // Head pose (degrees) - aligned with faceAnalysis.ts for consistency
    // Calibration is stricter than detection to ensure good baseline
    MAX_PITCH: 15,                  // Stricter than detection's 20-25° (ensures centered baseline)
    MAX_YAW: 20,                    // Stricter than detection's 25° (ensures centered baseline)
    MAX_ROLL: 15,                   // Head tilt

    // Eye aspect ratio
    MIN_EYE_ASPECT_RATIO: 0.18,     // Eyes must be open

    // Overall quality score to pass
    MIN_QUALITY_SCORE: 60,          // Minimum 60/100 to capture
};

// Oval frame config for face guide
export const FACE_FRAME_CONFIG = {
    // Position relative to canvas (0-1)
    centerX: 0.5,
    centerY: 0.42,                  // Slightly above center

    // Size relative to canvas
    widthRatio: 0.45,               // 45% of canvas width
    heightRatio: 0.6,               // 60% of canvas height

    // Colors
    colorDefault: 'rgba(255, 255, 255, 0.7)',
    colorGood: 'rgba(34, 197, 94, 0.8)',        // Green
    colorWarning: 'rgba(251, 191, 36, 0.8)',    // Yellow
    colorError: 'rgba(239, 68, 68, 0.8)',       // Red

    // Line
    lineWidth: 3,
};

/**
 * Calculate face size as percentage of frame
 */
export function calculateFaceSizePercent(
    faceBbox: FaceBoundingBox,
    frameWidth: number,
    frameHeight: number
): number {
    const faceArea = faceBbox.width * faceBbox.height;
    const frameArea = frameWidth * frameHeight;
    return (faceArea / frameArea) * 100;
}

/**
 * Check if face center is within the oval guide frame
 */
export function isFaceInOvalFrame(
    faceBbox: FaceBoundingBox,
    frameWidth: number,
    frameHeight: number
): boolean {
    const config = FACE_FRAME_CONFIG;

    // Face center
    const faceCenterX = faceBbox.x + faceBbox.width / 2;
    const faceCenterY = faceBbox.y + faceBbox.height / 2;

    // Oval center and radii
    const ovalCenterX = frameWidth * config.centerX;
    const ovalCenterY = frameHeight * config.centerY;
    const ovalRadiusX = (frameWidth * config.widthRatio) / 2;
    const ovalRadiusY = (frameHeight * config.heightRatio) / 2;

    // Check if face center is inside oval
    const normalizedX = (faceCenterX - ovalCenterX) / ovalRadiusX;
    const normalizedY = (faceCenterY - ovalCenterY) / ovalRadiusY;

    return (normalizedX * normalizedX + normalizedY * normalizedY) <= 1;
}

/**
 * Calculate image brightness from ImageData
 */
export function calculateBrightness(imageData: ImageData, region?: FaceBoundingBox): number {
    const data = imageData.data;
    let sum = 0;
    let count = 0;

    const startX = region ? Math.floor(region.x) : 0;
    const startY = region ? Math.floor(region.y) : 0;
    const endX = region ? Math.floor(region.x + region.width) : imageData.width;
    const endY = region ? Math.floor(region.y + region.height) : imageData.height;

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const i = (y * imageData.width + x) * 4;
            // Luminance formula
            const brightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            sum += brightness;
            count++;
        }
    }

    return count > 0 ? sum / count : 0;
}

/**
 * Calculate image contrast (standard deviation of brightness)
 */
export function calculateContrast(imageData: ImageData, region?: FaceBoundingBox): number {
    const data = imageData.data;
    const brightness = calculateBrightness(imageData, region);

    let sumSquaredDiff = 0;
    let count = 0;

    const startX = region ? Math.floor(region.x) : 0;
    const startY = region ? Math.floor(region.y) : 0;
    const endX = region ? Math.floor(region.x + region.width) : imageData.width;
    const endY = region ? Math.floor(region.y + region.height) : imageData.height;

    for (let y = startY; y < endY; y++) {
        for (let x = startX; x < endX; x++) {
            const i = (y * imageData.width + x) * 4;
            const pixelBrightness = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            sumSquaredDiff += Math.pow(pixelBrightness - brightness, 2);
            count++;
        }
    }

    return count > 0 ? Math.sqrt(sumSquaredDiff / count) : 0;
}

/**
 * Calculate image sharpness using Laplacian variance approximation
 * Higher values = sharper image
 */
export function calculateSharpness(imageData: ImageData, region?: FaceBoundingBox): number {
    const data = imageData.data;
    const width = imageData.width;

    const startX = Math.max(1, region ? Math.floor(region.x) : 1);
    const startY = Math.max(1, region ? Math.floor(region.y) : 1);
    const endX = Math.min(width - 1, region ? Math.floor(region.x + region.width) : width - 1);
    const endY = Math.min(imageData.height - 1, region ? Math.floor(region.y + region.height) : imageData.height - 1);

    let laplacianSum = 0;
    let count = 0;

    // Sample every 2nd pixel for performance
    for (let y = startY; y < endY; y += 2) {
        for (let x = startX; x < endX; x += 2) {
            const getGray = (px: number, py: number): number => {
                const i = (py * width + px) * 4;
                return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
            };

            // Laplacian kernel approximation
            const center = getGray(x, y);
            const laplacian = Math.abs(
                -4 * center +
                getGray(x - 1, y) +
                getGray(x + 1, y) +
                getGray(x, y - 1) +
                getGray(x, y + 1)
            );

            laplacianSum += laplacian * laplacian;
            count++;
        }
    }

    return count > 0 ? laplacianSum / count : 0;
}

/**
 * Build suggestions based on quality metrics
 */
export function buildSuggestions(metrics: Partial<FaceQualityMetrics>): string[] {
    const suggestions: string[] = [];

    if (!metrics.faceDetected) {
        suggestions.push('Không phát hiện khuôn mặt. Hãy đảm bảo mặt bạn trong khung hình.');
        return suggestions;
    }

    if (metrics.faceCount && metrics.faceCount > 1) {
        suggestions.push('Phát hiện nhiều khuôn mặt. Đảm bảo chỉ có bạn trong khung hình.');
    }

    if (!metrics.faceInFrame) {
        suggestions.push('Đưa mặt vào trong khung oval.');
    }

    if (!metrics.faceCentered) {
        suggestions.push('Di chuyển để mặt ở giữa khung hình.');
    }

    if (metrics.faceSizePercent !== undefined) {
        if (metrics.faceSizePercent < QUALITY_THRESHOLDS.MIN_FACE_SIZE_PERCENT) {
            suggestions.push('Di chuyển lại gần camera hơn.');
        } else if (metrics.faceSizePercent > QUALITY_THRESHOLDS.MAX_FACE_SIZE_PERCENT) {
            suggestions.push('Di chuyển ra xa camera một chút.');
        }
    }

    if (!metrics.lightingOk) {
        if (metrics.brightness !== undefined) {
            if (metrics.brightness < QUALITY_THRESHOLDS.MIN_BRIGHTNESS) {
                suggestions.push('Ánh sáng quá tối. Hãy bật thêm đèn hoặc di chuyển đến nơi sáng hơn.');
            } else if (metrics.brightness > QUALITY_THRESHOLDS.MAX_BRIGHTNESS) {
                suggestions.push('Ánh sáng quá chói. Tránh ánh sáng trực tiếp chiếu vào mặt.');
            }
        }
    }

    if (!metrics.sharpnessOk) {
        suggestions.push('Hình ảnh bị mờ. Giữ yên và đảm bảo camera được lấy nét.');
    }

    if (!metrics.faceFrontal && metrics.headPose) {
        const { pitch, yaw } = metrics.headPose;
        if (Math.abs(pitch) > QUALITY_THRESHOLDS.MAX_PITCH) {
            suggestions.push(pitch > 0 ? 'Hạ cằm xuống một chút.' : 'Ngẩng đầu lên một chút.');
        }
        if (Math.abs(yaw) > QUALITY_THRESHOLDS.MAX_YAW) {
            suggestions.push('Quay mặt nhìn thẳng vào camera.');
        }
    }

    if (!metrics.eyesVisible || !metrics.eyesOpen) {
        suggestions.push('Mở mắt và nhìn thẳng vào camera.');
    }

    return suggestions;
}

/**
 * Calculate overall quality score (0-100)
 */
export function calculateQualityScore(metrics: Partial<FaceQualityMetrics>): number {
    if (!metrics.faceDetected) return 0;

    let score = 0;
    const weights = {
        faceInFrame: 15,
        faceCentered: 10,
        faceSizeOk: 15,
        lightingOk: 20,
        sharpnessOk: 15,
        faceFrontal: 15,
        eyesVisible: 5,
        eyesOpen: 5,
    };

    if (metrics.faceInFrame) score += weights.faceInFrame;
    if (metrics.faceCentered) score += weights.faceCentered;
    if (metrics.faceSizeOk) score += weights.faceSizeOk;
    if (metrics.lightingOk) score += weights.lightingOk;
    if (metrics.sharpnessOk) score += weights.sharpnessOk;
    if (metrics.faceFrontal) score += weights.faceFrontal;
    if (metrics.eyesVisible) score += weights.eyesVisible;
    if (metrics.eyesOpen) score += weights.eyesOpen;

    return score;
}

/**
 * Determine overall quality level
 */
export function getQualityLevel(score: number): 'excellent' | 'good' | 'acceptable' | 'poor' {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'acceptable';
    return 'poor';
}

/**
 * Draw oval face guide frame on canvas
 */
export function drawFaceGuideFrame(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    quality: 'excellent' | 'good' | 'acceptable' | 'poor' | 'none' = 'none'
): void {
    const config = FACE_FRAME_CONFIG;

    const centerX = width * config.centerX;
    const centerY = height * config.centerY;
    const radiusX = (width * config.widthRatio) / 2;
    const radiusY = (height * config.heightRatio) / 2;

    // Determine color based on quality
    let color = config.colorDefault;
    if (quality === 'excellent' || quality === 'good') {
        color = config.colorGood;
    } else if (quality === 'acceptable') {
        color = config.colorWarning;
    } else if (quality === 'poor') {
        color = config.colorError;
    }

    // Draw oval
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.strokeStyle = color;
    ctx.lineWidth = config.lineWidth;
    ctx.stroke();

    // Draw corner markers for better visibility
    const markerLength = 20;
    ctx.beginPath();

    // Top
    ctx.moveTo(centerX, centerY - radiusY - 10);
    ctx.lineTo(centerX, centerY - radiusY + markerLength);

    // Bottom
    ctx.moveTo(centerX, centerY + radiusY + 10);
    ctx.lineTo(centerX, centerY + radiusY - markerLength);

    // Left
    ctx.moveTo(centerX - radiusX - 10, centerY);
    ctx.lineTo(centerX - radiusX + markerLength, centerY);

    // Right
    ctx.moveTo(centerX + radiusX + 10, centerY);
    ctx.lineTo(centerX + radiusX - markerLength, centerY);

    ctx.stroke();
}

/**
 * Create dimmed overlay outside the oval
 */
export function drawDimmedOverlay(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
): void {
    const config = FACE_FRAME_CONFIG;

    const centerX = width * config.centerX;
    const centerY = height * config.centerY;
    const radiusX = (width * config.widthRatio) / 2;
    const radiusY = (height * config.heightRatio) / 2;

    // Save context
    ctx.save();

    // Draw full dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, width, height);

    // Cut out oval (make it transparent)
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
    ctx.fill();

    // Restore context
    ctx.restore();
}
