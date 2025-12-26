import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-wasm';
import { setWasmPaths } from '@tensorflow/tfjs-backend-wasm';

/**
 * Initialize TensorFlow.js backend with WebGL → WASM fallback
 * Uses self-hosted WASM files from /public/tfjs-wasm/
 */
export async function initializeTFBackend(): Promise<string> {
    try {
        // Try WebGL first (fastest, GPU-accelerated)
        await tf.setBackend('webgl');
        await tf.ready();

        // Verify WebGL is stable with a test operation
        const testTensor = tf.randomNormal([100, 100]);
        await testTensor.data();
        testTensor.dispose();

        console.log('✅ TensorFlow.js initialized with WebGL backend');
        return 'webgl';
    } catch (error) {
        console.warn('⚠️ WebGL backend failed, falling back to WASM:', error);

        try {
            // Use self-hosted WASM files (no CDN dependency)
            setWasmPaths('/tfjs-wasm/');

            await tf.setBackend('wasm');
            await tf.ready();

            console.log('✅ TensorFlow.js initialized with WASM backend (local files)');
            return 'wasm';
        } catch (wasmError) {
            console.error('❌ WASM backend also failed:', wasmError);
            throw new Error('Failed to initialize TensorFlow.js backend');
        }
    }
}

/**
 * Warm up models with dummy inference to prevent UI freeze
 * Call this after models are loaded but before exam starts
 */
export async function warmUpModels(models: {
    blazeFace: any;
    faceLandmarks: any;
}): Promise<void> {
    try {
        console.log('🔥 Warming up models...');

        // Create dummy tensor matching expected input (320x240 RGB)
        const dummyInput = tf.randomNormal([240, 320, 3]);

        // Run BlazeFace on dummy input
        if (models.blazeFace) {
            await models.blazeFace.estimateFaces(dummyInput, false);
        }

        // Run FaceLandmarks on dummy input
        if (models.faceLandmarks) {
            await models.faceLandmarks.estimateFaces({ input: dummyInput });
        }

        dummyInput.dispose();
        console.log('✅ Models warmed up successfully');
    } catch (error) {
        console.warn('⚠️ Model warm-up failed (non-critical):', error);
    }
}

/**
 * Check current backend and memory usage
 */
export function getTFStatus(): {
    backend: string;
    numTensors: number;
    numBytes: number;
} {
    const backend = tf.getBackend();
    const memory = tf.memory();

    return {
        backend,
        numTensors: memory.numTensors,
        numBytes: memory.numBytes
    };
}
