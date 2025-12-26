import { useRef, useState, useEffect, useCallback } from 'react';

/**
 * Circular Video Buffer for Evidence Clips
 * 
 * PURPOSE: Keep last N seconds in memory, create clips on demand
 * USE CASE: When violation detected, create 2s pre + 3s post clip
 * 
 * SOLUTION FOR FROZEN FRAMES:
 * ===============================
 * WebM chunks after the first one are "dependent" frames (P-frames/B-frames)
 * that require previous keyframes to decode. Simply concatenating WebM blobs
 * results in only the first chunk being playable.
 * 
 * This implementation uses a CONTINUOUS RECORDING approach:
 * - Keep a single continuous recording running
 * - Use SourceBuffer to access just the portion we need
 * - Or record a fresh clip starting from the violation event
 * 
 * Alternative approaches considered:
 * 1. Per-chunk keyframe forcing (not supported by MediaRecorder API)
 * 2. FFmpeg/WASM remuxing (too heavy for browser)
 * 3. Canvas-based frame capture (high CPU, lower quality)
 * 4. Server-side clip extraction (requires egress)
 * 
 * CHOSEN: Hybrid approach - continuous buffer for pre-event, fresh recording for post-event
 */

interface VideoChunk {
    blob: Blob;
    timestamp: number;
    duration: number;
}

/**
 * Complete recording segment that can be played independently
 * Each segment starts with an init segment (keyframe + codec info)
 */
interface VideoSegment {
    blob: Blob;
    startTime: number;
    endTime: number;
    duration: number;
}

export interface CircularBufferOptions {
    maxDurationMs?: number;      // Default: 15000 (15s buffer)
    videoBitsPerSecond?: number; // Default: 500000 (500 kbps for better quality)
}

export class CircularVideoBuffer {
    private segments: VideoSegment[] = [];
    private maxSegments: number;
    private currentRecorder: MediaRecorder | null = null;
    private stream: MediaStream | null = null;
    private videoBitsPerSecond: number;
    private isRecording = false;
    private maxDurationMs: number;

    // Segment rotation: start new recorder every 5s to ensure keyframes
    private segmentDurationMs = 5000;
    private rotationIntervalId: number | null = null;

    constructor(options: CircularBufferOptions = {}) {
        const {
            maxDurationMs = 15000,
            videoBitsPerSecond = 500000
        } = options;

        this.maxDurationMs = maxDurationMs;
        this.maxSegments = Math.ceil(maxDurationMs / this.segmentDurationMs) + 1;
        this.videoBitsPerSecond = videoBitsPerSecond;
    }

    /**
     * Start recording stream with segment rotation
     * Each segment is self-contained with keyframes
     */
    startRecording(stream: MediaStream): void {
        if (this.isRecording) {
            console.warn('[CircularBuffer] Already recording');
            return;
        }

        // Validate stream
        const videoTracks = stream.getVideoTracks();
        if (!videoTracks || videoTracks.length === 0) {
            console.error('[CircularBuffer] Stream has no video tracks');
            return;
        }

        const videoTrack = videoTracks[0];
        if (videoTrack.readyState !== 'live') {
            console.error('[CircularBuffer] Video track is not live:', videoTrack.readyState);
            return;
        }

        this.stream = stream;
        this.isRecording = true;

        // Start first segment
        this.startNewSegment();

        // Rotate segments every segmentDurationMs to ensure fresh keyframes
        this.rotationIntervalId = window.setInterval(() => {
            this.rotateSegment();
        }, this.segmentDurationMs);

        console.log('[CircularBuffer] Started with segment rotation every', this.segmentDurationMs, 'ms');
    }

    /**
     * Start a new recording segment
     */
    private startNewSegment(): void {
        if (!this.stream || !this.isRecording) return;

        // Validate stream is still active before starting recorder
        const videoTracks = this.stream.getVideoTracks();
        if (!videoTracks || videoTracks.length === 0) {
            console.warn('[CircularBuffer] No video tracks available, skipping segment');
            return;
        }

        const videoTrack = videoTracks[0];
        if (videoTrack.readyState !== 'live') {
            console.warn('[CircularBuffer] Video track not live:', videoTrack.readyState);
            // Stop recording if track ended
            if (videoTrack.readyState === 'ended') {
                this.stopRecording();
            }
            return;
        }

        const mimeType = this.getSupportedMimeType();
        if (!mimeType) {
            console.error('[CircularBuffer] No supported MIME type');
            return;
        }

        try {
            const recorder = new MediaRecorder(this.stream, {
                mimeType,
                videoBitsPerSecond: this.videoBitsPerSecond
            });

            const chunks: Blob[] = [];
            const startTime = Date.now();

            recorder.ondataavailable = (event: BlobEvent) => {
                if (event.data && event.data.size > 0) {
                    chunks.push(event.data);
                }
            };

            recorder.onstop = () => {
                if (chunks.length > 0) {
                    const blob = new Blob(chunks, { type: mimeType });
                    const endTime = Date.now();

                    this.addSegment({
                        blob,
                        startTime,
                        endTime,
                        duration: endTime - startTime
                    });

                    console.log(`[CircularBuffer] Segment saved: ${blob.size} bytes, ${endTime - startTime}ms`);
                }
            };

            recorder.onerror = (event: Event) => {
                console.error('[CircularBuffer] Recorder error:', event);
            };

            // Start recording continuously (no timeslice = single blob with keyframes)
            recorder.start();
            this.currentRecorder = recorder;

        } catch (error) {
            // Graceful fallback - don't crash, just log and skip this segment
            console.warn('[CircularBuffer] Failed to start segment (codec/stream issue), will retry next rotation:', error);
            // Clean up
            this.currentRecorder = null;
        }
    }

    /**
     * Rotate to new segment (stop current, start new)
     */
    private rotateSegment(): void {
        if (!this.isRecording) return;

        // Stop current recorder (triggers onstop which saves segment)
        if (this.currentRecorder && this.currentRecorder.state === 'recording') {
            this.currentRecorder.stop();
        }

        // Start new segment
        this.startNewSegment();
    }

    /**
     * Add segment to circular buffer
     */
    private addSegment(segment: VideoSegment): void {
        this.segments.push(segment);

        // Remove oldest if exceeds capacity
        while (this.segments.length > this.maxSegments) {
            this.segments.shift();
        }
    }

    /**
     * Get supported MIME type (prefer VP8 for better keyframe handling)
     */
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

        console.error('[CircularBuffer] No supported video MIME type found');
        return null;
    }

    /**
     * Check if buffer is ready to create clips
     */
    isReady(): boolean {
        return this.isRecording && this.segments.length > 0;
    }

    /**
     * Get mimeType being used
     */
    getMimeType(): string | null {
        return this.currentRecorder?.mimeType || null;
    }

    /**
     * Create clip from buffer
     * 
     * @param preBufferSeconds - Seconds before trigger (from buffer)
     * @param postRecordSeconds - Seconds after trigger (record new)
     * @returns Blob containing the clip
     */
    async createClip(
        preBufferSeconds: number = 2,
        postRecordSeconds: number = 3
    ): Promise<Blob> {
        if (!this.stream || !this.isRecording) {
            throw new Error('CircularBuffer not recording. Call startRecording() first.');
        }

        const mimeType = this.getSupportedMimeType();
        if (!mimeType) {
            throw new Error('CircularBuffer mimeType not available.');
        }

        const now = Date.now();
        const preBufferCutoff = now - (preBufferSeconds * 1000);

        // Step 1: Force save current recording segment FIRST to capture latest frames
        if (this.currentRecorder && this.currentRecorder.state === 'recording') {
            this.currentRecorder.stop();
            // Wait for onstop to process and add segment to buffer
            await new Promise(resolve => setTimeout(resolve, 200));
        }

        // Step 2: Get pre-buffer segments
        // Only include segments that ENDED within the pre-buffer window (within last N seconds)
        // This ensures we don't keep reusing old segments from previous clips
        const preSegments = this.segments.filter(seg => {
            return seg.endTime >= preBufferCutoff;
        });

        // If no segments match, take the most recent one as fallback
        const segmentsToUse = preSegments.length > 0
            ? preSegments
            : this.segments.slice(-1); // Take last segment only

        console.log(`[CircularBuffer] Creating clip: ${preBufferSeconds}s pre + ${postRecordSeconds}s post`);
        console.log(`[CircularBuffer] Available segments: ${this.segments.length}, using ${segmentsToUse.length} for pre-buffer (cutoff: ${new Date(preBufferCutoff).toISOString()})`);

        // Debug: log segment times
        segmentsToUse.forEach((seg, i) => {
            const age = (now - seg.endTime) / 1000;
            console.log(`[CircularBuffer] Using segment ${i}: age=${age.toFixed(1)}s, duration=${seg.duration}ms, startTime=${new Date(seg.startTime).toISOString()}`);
        });

        // Step 3: Record post-buffer (fresh recording for post-trigger period)
        const postBlob = await this.recordPostBuffer(postRecordSeconds);

        // Restart continuous recording
        this.startNewSegment();

        // Step 4: Combine segments
        const allBlobs: Blob[] = [];

        // Add pre-buffer segments
        segmentsToUse.forEach((seg, i) => {
            allBlobs.push(seg.blob);
            console.log(`[CircularBuffer] Pre-segment ${i}: ${seg.blob.size} bytes, ${seg.duration}ms`);
        });

        // Add post-buffer blob
        if (postBlob && postBlob.size > 0) {
            allBlobs.push(postBlob);
            console.log(`[CircularBuffer] Post-buffer: ${postBlob.size} bytes`);
        }

        if (allBlobs.length === 0) {
            throw new Error('No video data available to create clip');
        }

        // Create final blob
        // NOTE: Each segment has its own init segment, so they're all playable
        // For better compatibility, we could use a single segment approach instead
        const finalBlob = new Blob(allBlobs, { type: mimeType });

        const totalDuration = preSegments.reduce((sum, s) => sum + s.duration, 0) + (postRecordSeconds * 1000);
        console.log(`✅ Clip created: ${finalBlob.size} bytes (${allBlobs.length} segments), ~${totalDuration / 1000}s expected`);

        return finalBlob;
    }

    /**
     * Record fresh video for post-trigger period
     * This ensures we have keyframes and don't rely on concatenation
     */
    private async recordPostBuffer(durationSeconds: number): Promise<Blob> {
        return new Promise((resolve, reject) => {
            if (!this.stream) {
                resolve(new Blob());
                return;
            }

            // Check stream is still active
            const videoTracks = this.stream.getVideoTracks();
            if (!videoTracks || videoTracks.length === 0 || videoTracks[0].readyState !== 'live') {
                console.warn('[CircularBuffer] Stream not active, skipping post-buffer');
                resolve(new Blob());
                return;
            }

            const mimeType = this.getSupportedMimeType();
            if (!mimeType) {
                resolve(new Blob());
                return;
            }

            try {
                const postRecorder = new MediaRecorder(this.stream, {
                    mimeType,
                    videoBitsPerSecond: this.videoBitsPerSecond
                });

                const chunks: Blob[] = [];

                postRecorder.ondataavailable = (event: BlobEvent) => {
                    if (event.data && event.data.size > 0) {
                        chunks.push(event.data);
                    }
                };

                postRecorder.onstop = () => {
                    const blob = new Blob(chunks, { type: mimeType });
                    console.log(`[CircularBuffer] Post-buffer recorded: ${blob.size} bytes`);
                    resolve(blob);
                };

                postRecorder.onerror = (event: Event) => {
                    console.error('[CircularBuffer] Post-recorder error:', event);
                    resolve(new Blob()); // Don't fail, just return empty
                };

                // Record without timeslice = single continuous blob with proper keyframes
                postRecorder.start();

                setTimeout(() => {
                    if (postRecorder.state === 'recording') {
                        postRecorder.stop();
                    }
                }, durationSeconds * 1000);

            } catch (error) {
                console.error('[CircularBuffer] Post-buffer error:', error);
                resolve(new Blob());
            }
        });
    }

    /**
     * Get current buffer status
     */
    getStatus() {
        const totalDuration = this.segments.reduce((sum, seg) => sum + seg.duration, 0);
        const totalSize = this.segments.reduce((sum, seg) => sum + seg.blob.size, 0);

        return {
            isRecording: this.isRecording,
            chunkCount: this.segments.length,
            maxChunks: this.maxSegments,
            totalDurationMs: totalDuration,
            totalSizeBytes: totalSize,
            utilizationPercent: (this.segments.length / this.maxSegments) * 100
        };
    }

    /**
     * Stop recording and clear buffer
     */
    stopRecording(): void {
        if (this.rotationIntervalId) {
            window.clearInterval(this.rotationIntervalId);
            this.rotationIntervalId = null;
        }

        if (this.currentRecorder && this.currentRecorder.state === 'recording') {
            this.currentRecorder.stop();
        }

        this.currentRecorder = null;
        this.isRecording = false;
        this.segments = [];
        this.stream = null;

        console.log('[CircularBuffer] Stopped');
    }

    /**
     * Pause recording (stops segment rotation but keeps buffer)
     */
    pause(): void {
        if (this.currentRecorder && this.currentRecorder.state === 'recording') {
            this.currentRecorder.pause();
        }
        if (this.rotationIntervalId) {
            window.clearInterval(this.rotationIntervalId);
            this.rotationIntervalId = null;
        }
    }

    /**
     * Resume recording
     */
    resume(): void {
        if (this.currentRecorder && this.currentRecorder.state === 'paused') {
            this.currentRecorder.resume();
        }
        // Restart rotation
        if (!this.rotationIntervalId && this.isRecording) {
            this.rotationIntervalId = window.setInterval(() => {
                this.rotateSegment();
            }, this.segmentDurationMs);
        }
    }
}

/**
 * React Hook for Circular Video Buffer
 */
export function useCircularBuffer({
    stream,
    options
}: {
    stream: MediaStream | null;
    options?: CircularBufferOptions;
}) {
    const bufferRef = useRef<CircularVideoBuffer | null>(null);
    const [status, setStatus] = useState({
        isRecording: false,
        chunkCount: 0,
        totalDurationMs: 0
    });
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const currentStreamIdRef = useRef<string | null>(null);

    // Initialize buffer when stream is available with retry mechanism
    useEffect(() => {
        if (!stream) {
            return;
        }

        // Check if video track is live
        const videoTracks = stream.getVideoTracks();
        if (!videoTracks || videoTracks.length === 0) {
            return;
        }

        const videoTrack = videoTracks[0];
        const streamId = stream.id;

        // Don't restart if already recording the same stream
        if (bufferRef.current && currentStreamIdRef.current === streamId) {
            return;
        }

        // Don't try to start if track is already ended
        if (videoTrack.readyState === 'ended') {
            return;
        }

        // Function to start recording
        const startBuffer = () => {
            if (bufferRef.current) {
                bufferRef.current.stopRecording();
            }

            const buffer = new CircularVideoBuffer(options);
            bufferRef.current = buffer;
            currentStreamIdRef.current = streamId;

            try {
                buffer.startRecording(stream);
            } catch (error) {
                console.error('[CircularBuffer] Failed to start:', error);
            }
        };

        // If track is live, start immediately
        if (videoTrack.readyState === 'live') {
            startBuffer();
        } else {
            // Wait for track to become live (with timeout)
            let checkCount = 0;
            const maxChecks = 25; // 5 seconds / 200ms

            const checkInterval = setInterval(() => {
                checkCount++;
                if (videoTrack.readyState === 'live') {
                    clearInterval(checkInterval);
                    startBuffer();
                } else if (videoTrack.readyState === 'ended' || checkCount >= maxChecks) {
                    clearInterval(checkInterval);
                }
            }, 200);

            return () => {
                clearInterval(checkInterval);
            };
        }

        // Update status periodically (every 5 seconds instead of 1 second)
        const statusInterval = setInterval(() => {
            if (bufferRef.current) {
                setStatus(bufferRef.current.getStatus());
            }
        }, 5000);

        return () => {
            clearInterval(statusInterval);
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
            if (bufferRef.current) {
                bufferRef.current.stopRecording();
                bufferRef.current = null;
                currentStreamIdRef.current = null;
            }
        };
    }, [stream?.id]); // Only depend on stream ID, not stream object

    const createClip = useCallback(async (preSeconds = 2, postSeconds = 3) => {
        if (!bufferRef.current) {
            throw new Error('Buffer not initialized');
        }
        if (!bufferRef.current.isReady()) {
            throw new Error('Buffer not ready. Stream may not be active yet.');
        }
        return bufferRef.current.createClip(preSeconds, postSeconds);
    }, []);

    return {
        createClip,
        status,
        pause: () => bufferRef.current?.pause(),
        resume: () => bufferRef.current?.resume()
    };
}
