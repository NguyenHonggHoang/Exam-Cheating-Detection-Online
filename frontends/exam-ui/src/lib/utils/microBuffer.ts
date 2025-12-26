/**
 * Micro Buffer for Pre-Suspicion Recording
 * 
 * Lightweight video buffer triggered by pre-suspicion detection.
 * Fixed 480p resolution, variable bitrate/FPS based on suspicion type.
 * 
 * Quality Modes:
 * - Normal: 100kbps, 5fps (skip frames)
 * - Suspicion: 300kbps, 12fps (motion detection)
 * - Clarity: 1.5Mbps, 8fps (reflection analysis)
 */

import { useRef, useState, useCallback } from 'react';

// ========== Types ==========

export type SuspicionType = 'illumination_spike' | 'motion_detected' | 'head_freeze' | 'default';

export interface MicroBufferQuality {
    resolution: '480p';  // Fixed
    bitrate: number;     // Variable: 100000-1500000
    fps: number;         // Variable: 5-15
    description: string;
}

export interface MicroBufferConfig {
    maxDurationMs: number;   // Default: 5000 (5s)
    chunkDurationMs: number; // Default: 500 (0.5s)
}

export interface MicroBufferStatus {
    isActive: boolean;
    isRecording: boolean;
    chunkCount: number;
    bytesRecorded: number;
    currentQuality: SuspicionType;
}

// ========== Quality Presets ==========

const QUALITY_PRESETS: Record<SuspicionType, MicroBufferQuality> = {
    illumination_spike: {
        resolution: '480p',
        bitrate: 1500000,  // 1.5 Mbps - high clarity for reflection
        fps: 8,
        description: 'High clarity for reflection analysis'
    },
    motion_detected: {
        resolution: '480p',
        bitrate: 500000,   // 500 kbps
        fps: 15,           // High FPS for motion
        description: 'High FPS for motion detection'
    },
    head_freeze: {
        resolution: '480p',
        bitrate: 300000,   // 300 kbps
        fps: 8,
        description: 'Balanced for freeze detection'
    },
    default: {
        resolution: '480p',
        bitrate: 200000,   // 200 kbps - lightweight
        fps: 5,
        description: 'Lightweight default mode'
    }
};

// ========== MicroBuffer Class ==========

export class MicroBuffer {
    private buffer: Blob[] = [];
    private recorder: MediaRecorder | null = null;
    private stream: MediaStream | null = null;
    private currentQuality: SuspicionType = 'default';
    private isActive = false;
    private bytesRecorded = 0;
    private config: MicroBufferConfig;
    private initSegment: Blob | null = null;
    private isFirstChunk = true;

    constructor(config: Partial<MicroBufferConfig> = {}) {
        this.config = {
            maxDurationMs: config.maxDurationMs ?? 5000,
            chunkDurationMs: config.chunkDurationMs ?? 500
        };
    }

    /**
     * Activate micro-buffer with specific quality
     */
    activate(stream: MediaStream, suspicionType: SuspicionType): void {
        if (this.isActive) {
            // Upgrade quality if needed
            if (this.shouldUpgradeQuality(suspicionType)) {
                console.log(`[MicroBuffer] Upgrading quality: ${this.currentQuality} → ${suspicionType}`);
                this.stop();
                this.start(stream, suspicionType);
            }
            return;
        }

        this.start(stream, suspicionType);
    }

    private shouldUpgradeQuality(newType: SuspicionType): boolean {
        const priorityOrder: SuspicionType[] = ['default', 'head_freeze', 'motion_detected', 'illumination_spike'];
        const currentPriority = priorityOrder.indexOf(this.currentQuality);
        const newPriority = priorityOrder.indexOf(newType);
        return newPriority > currentPriority;
    }

    private start(stream: MediaStream, suspicionType: SuspicionType): void {
        this.stream = stream;
        this.currentQuality = suspicionType;
        this.buffer = [];
        this.bytesRecorded = 0;
        this.initSegment = null;
        this.isFirstChunk = true;

        const quality = QUALITY_PRESETS[suspicionType];

        // Get supported MIME type
        const mimeType = this.getSupportedMimeType();
        if (!mimeType) {
            console.error('[MicroBuffer] No supported MIME type');
            return;
        }

        try {
            this.recorder = new MediaRecorder(stream, {
                mimeType,
                videoBitsPerSecond: quality.bitrate
            });

            this.recorder.ondataavailable = (event: BlobEvent) => {
                if (event.data && event.data.size > 0) {
                    if (this.isFirstChunk) {
                        this.initSegment = event.data;
                        this.isFirstChunk = false;
                    }

                    this.buffer.push(event.data);
                    this.bytesRecorded += event.data.size;

                    // Limit buffer size
                    const maxChunks = Math.ceil(this.config.maxDurationMs / this.config.chunkDurationMs);
                    if (this.buffer.length > maxChunks) {
                        const removed = this.buffer.shift();
                        if (removed) this.bytesRecorded -= removed.size;
                    }
                }
            };

            this.recorder.onerror = (event) => {
                console.error('[MicroBuffer] Recording error:', event);
            };

            // Start with frame interval based on FPS
            const frameInterval = Math.floor(1000 / quality.fps);
            this.recorder.start(Math.max(frameInterval, this.config.chunkDurationMs));
            this.isActive = true;

            console.log(`[MicroBuffer] Started: ${suspicionType}, ${quality.bitrate}bps, ${quality.fps}fps`);

        } catch (error) {
            console.error('[MicroBuffer] Failed to start:', error);
        }
    }

    /**
     * Stop recording and return collected video
     */
    stop(): Blob | null {
        if (!this.isActive || !this.recorder) {
            return null;
        }

        this.recorder.stop();
        this.isActive = false;

        // Combine all chunks with init segment
        const allBlobs: Blob[] = [];

        if (this.initSegment && this.buffer.length > 0 && this.buffer[0] !== this.initSegment) {
            allBlobs.push(this.initSegment);
        }
        allBlobs.push(...this.buffer);

        const mimeType = this.recorder.mimeType || 'video/webm';
        const finalBlob = new Blob(allBlobs, { type: mimeType });

        console.log(`[MicroBuffer] Stopped: ${this.buffer.length} chunks, ${(finalBlob.size / 1024).toFixed(1)}KB`);

        this.recorder = null;
        return finalBlob;
    }

    /**
     * Get current status
     */
    getStatus(): MicroBufferStatus {
        return {
            isActive: this.isActive,
            isRecording: this.recorder?.state === 'recording',
            chunkCount: this.buffer.length,
            bytesRecorded: this.bytesRecorded,
            currentQuality: this.currentQuality
        };
    }

    /**
     * Get current quality settings
     */
    getQuality(): MicroBufferQuality {
        return QUALITY_PRESETS[this.currentQuality];
    }

    private getSupportedMimeType(): string | null {
        const types = [
            'video/webm;codecs=vp8',
            'video/webm;codecs=vp9',
            'video/webm',
            'video/mp4'
        ];

        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }

        return null;
    }

    /**
     * Check if buffer has enough data for upload
     */
    hasValidData(): boolean {
        return this.buffer.length >= 2 && this.bytesRecorded > 1000;
    }
}

// ========== React Hook ==========

export interface UseMicroBufferOptions {
    stream: MediaStream | null;
    enabled?: boolean;
    config?: Partial<MicroBufferConfig>;
}

export function useMicroBuffer(options: UseMicroBufferOptions) {
    const { stream, enabled = true, config } = options;

    const microBufferRef = useRef<MicroBuffer | null>(null);
    const [status, setStatus] = useState<MicroBufferStatus>({
        isActive: false,
        isRecording: false,
        chunkCount: 0,
        bytesRecorded: 0,
        currentQuality: 'default'
    });

    // Initialize buffer
    if (!microBufferRef.current) {
        microBufferRef.current = new MicroBuffer(config);
    }

    /**
     * Activate micro-buffer with suspicion type
     */
    const activate = useCallback((suspicionType: SuspicionType) => {
        if (!enabled || !stream || !microBufferRef.current) {
            console.warn('[useMicroBuffer] Cannot activate: stream not ready');
            return;
        }

        microBufferRef.current.activate(stream, suspicionType);
        setStatus(microBufferRef.current.getStatus());
    }, [enabled, stream]);

    /**
     * Stop and get recorded video
     */
    const stopAndGet = useCallback((): Blob | null => {
        if (!microBufferRef.current) return null;

        const blob = microBufferRef.current.stop();
        setStatus(microBufferRef.current.getStatus());
        return blob;
    }, []);

    /**
     * Get current status
     */
    const getStatus = useCallback((): MicroBufferStatus => {
        return microBufferRef.current?.getStatus() ?? {
            isActive: false,
            isRecording: false,
            chunkCount: 0,
            bytesRecorded: 0,
            currentQuality: 'default'
        };
    }, []);

    return {
        activate,
        stopAndGet,
        getStatus,
        status,
        quality: QUALITY_PRESETS[status.currentQuality]
    };
}
