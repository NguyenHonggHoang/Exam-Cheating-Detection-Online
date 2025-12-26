import * as tf from '@tensorflow/tfjs';

export interface PreflightResult {
    passed: boolean;
    critical: string[];
    warnings: string[];
    info: {
        sebDetected: boolean;
        tfBackend: string;
        cameraAccess: boolean;
        lightingQuality: 'good' | 'dark' | 'bright' | 'unknown';
        brightness: number;
    };
}

/**
 * Comprehensive pre-flight check for exam proctoring system
 */
export async function runPreflightCheck(
    videoElement: HTMLVideoElement | null,
    requireSEB: boolean = false
): Promise<PreflightResult> {
    const critical: string[] = [];
    const warnings: string[] = [];

    // CHECK 1: Safe Exam Browser Detection
    const userAgent = navigator.userAgent;
    const sebDetected = /SEB|SafeExamBrowser/i.test(userAgent);

    if (!sebDetected) {
        const message = 'Not running in Safe Exam Browser';
        if (requireSEB) {
            critical.push(message + ' (REQUIRED for official exams)');
        } else {
            warnings.push(message + ' (recommended for security)');
        }
    }

    // CHECK 2: TensorFlow.js Backend
    let tfBackend = 'none';
    try {
        tfBackend = tf.getBackend();

        if (tfBackend === 'webgl') {
            console.log('✅ TensorFlow.js running on WebGL (GPU-accelerated)');
        } else if (tfBackend === 'wasm') {
            warnings.push('TensorFlow.js using WASM backend (slower than WebGL but functional)');
        } else {
            critical.push(`TensorFlow.js backend '${tfBackend}' not supported`);
        }
    } catch (error) {
        critical.push('TensorFlow.js backend not initialized');
    }

    // CHECK 3: Camera Access & Video Stream
    let cameraAccess = false;
    let lightingQuality: 'good' | 'dark' | 'bright' | 'unknown' = 'unknown';
    let brightness = 0;

    if (!videoElement) {
        critical.push('Video element not initialized');
    } else if (!videoElement.srcObject) {
        critical.push('Camera not initialized - please grant camera permissions');
    } else {
        const stream = videoElement.srcObject as MediaStream;
        const tracks = stream.getVideoTracks();

        if (tracks.length === 0) {
            critical.push('No video tracks found in camera stream');
        } else {
            const track = tracks[0];
            const settings = track.getSettings();

            cameraAccess = true;
            console.log('📹 Camera:', {
                label: track.label,
                resolution: `${settings.width}x${settings.height}`,
                fps: settings.frameRate
            });

            if (videoElement.videoWidth === 0 || videoElement.videoHeight === 0) {
                warnings.push('Camera not producing frames yet (may resolve shortly)');
            } else {
                // Check lighting quality
                const lighting = analyzeLightingQuality(videoElement);
                lightingQuality = lighting.quality;
                brightness = lighting.brightness;

                if (lighting.quality === 'dark') {
                    warnings.push(lighting.recommendation);
                } else if (lighting.quality === 'bright') {
                    warnings.push(lighting.recommendation);
                }
            }
        }
    }

    // CHECK 4: Camera Permission Error Handling
    if (!cameraAccess) {
        if (sebDetected) {
            critical.push(
                'Camera access denied. To fix:\n' +
                '1. Close Safe Exam Browser\n' +
                '2. Open Windows Settings > Privacy > Camera\n' +
                '3. Enable camera access for Safe Exam Browser\n' +
                '4. Restart Safe Exam Browser'
            );
        } else {
            critical.push(
                'Camera access denied. To fix:\n' +
                '1. Click the camera icon in your browser\'s address bar\n' +
                '2. Select "Always allow" for this website\n' +
                '3. Refresh the page'
            );
        }
    }

    return {
        passed: critical.length === 0,
        critical,
        warnings,
        info: {
            sebDetected,
            tfBackend,
            cameraAccess,
            lightingQuality,
            brightness
        }
    };
}

/**
 * Analyze video frame for lighting quality
 */
function analyzeLightingQuality(videoElement: HTMLVideoElement): {
    brightness: number;
    quality: 'good' | 'dark' | 'bright' | 'unknown';
    recommendation: string;
} {
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 120;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return { brightness: 0, quality: 'unknown', recommendation: 'Unable to analyze' };
    }

    ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;

    // Calculate average brightness using luminosity formula
    let totalBrightness = 0;
    for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        totalBrightness += brightness;
    }

    const avgBrightness = totalBrightness / (pixels.length / 4);

    let quality: 'good' | 'dark' | 'bright' | 'unknown';
    let recommendation: string;

    if (avgBrightness < 40) {
        quality = 'dark';
        recommendation = '💡 Environment too dark. Turn on lights for better detection.';
    } else if (avgBrightness > 220) {
        quality = 'bright';
        recommendation = '☀️ Environment too bright. Reduce glare/backlighting.';
    } else {
        quality = 'good';
        recommendation = '✅ Lighting quality is good.';
    }

    return { brightness: avgBrightness, quality, recommendation };
}
