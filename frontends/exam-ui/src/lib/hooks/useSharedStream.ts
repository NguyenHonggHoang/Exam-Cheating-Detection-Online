import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Shared Stream Hook
 * 
 * Purpose: Single getUserMedia() call with stream cloning
 * Solves: Browser limits on multiple camera access
 * 
 * Architecture:
 * - One source stream from getUserMedia()
 * - Multiple clones for different consumers
 * - Proper cleanup on unmount
 */

export interface StreamClones {
    source: MediaStream | null;      // Original stream (for display)
    livekit: MediaStream | null;     // Clone for LiveKit WebRTC
    tensorflow: MediaStream | null;  // Clone for TensorFlow detection
    recorder: MediaStream | null;    // Clone for MediaRecorder (circular buffer)
}

export interface UseSharedStreamOptions {
    video?: MediaTrackConstraints | boolean;
    audio?: boolean;
    enabled?: boolean;
}

export interface UseSharedStreamResult {
    streams: StreamClones;
    isReady: boolean;
    error: Error | null;
    retry: () => void;
}

const DEFAULT_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
    width: { ideal: 640 },
    height: { ideal: 480 },
    facingMode: 'user',
    frameRate: { ideal: 30 }
};

export function useSharedStream(options: UseSharedStreamOptions = {}): UseSharedStreamResult {
    const {
        video = DEFAULT_VIDEO_CONSTRAINTS,
        audio = true,
        enabled = true
    } = options;

    const [streams, setStreams] = useState<StreamClones>({
        source: null,
        livekit: null,
        tensorflow: null,
        recorder: null
    });

    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [retryCount, setRetryCount] = useState(0);
    
    // Use refs to avoid dependency changes causing loops
    const videoRef = useRef(video);
    const audioRef = useRef(audio);
    const streamsRef = useRef<StreamClones>(streams);
    
    // Update refs when values change
    videoRef.current = video;
    audioRef.current = audio;
    streamsRef.current = streams;

    // Initialize on mount, when enabled changes, or on retry
    useEffect(() => {
        let isMounted = true;

        const initializeStream = async () => {
            if (!enabled) {
                console.log('[SharedStream] Disabled, skipping initialization');
                return;
            }

            try {
                console.log('[SharedStream] Requesting getUserMedia...');

                const sourceStream = await navigator.mediaDevices.getUserMedia({
                    video: videoRef.current,
                    audio: audioRef.current
                });

                if (!isMounted) {
                    // Component unmounted during async operation
                    sourceStream.getTracks().forEach(track => track.stop());
                    return;
                }

                console.log('[SharedStream] ✅ Got source stream');
                console.log(`[SharedStream] Video tracks: ${sourceStream.getVideoTracks().length}`);
                console.log(`[SharedStream] Audio tracks: ${sourceStream.getAudioTracks().length}`);

                // Create clones for each consumer
                const livekitClone = sourceStream.clone();
                const tensorflowClone = sourceStream.clone();
                const recorderClone = sourceStream.clone();

                console.log('[SharedStream] ✅ Created 3 stream clones');

                const newStreams = {
                    source: sourceStream,
                    livekit: livekitClone,
                    tensorflow: tensorflowClone,
                    recorder: recorderClone
                };

                setStreams(newStreams);
                streamsRef.current = newStreams;
                setIsReady(true);
                setError(null);

                console.log('[SharedStream] ✅ All streams ready');

            } catch (err) {
                console.error('[SharedStream] Failed to initialize:', err);
                if (isMounted) {
                    const error = err instanceof Error ? err : new Error('Failed to access camera');
                    setError(error);
                    setIsReady(false);
                }
            }
        };

        if (enabled) {
            initializeStream();
        } else {
            // When disabled, clean up existing streams
            console.log('[SharedStream] Disabled, cleaning up existing streams');
            const currentStreams = streamsRef.current;
            [currentStreams.source, currentStreams.livekit, currentStreams.tensorflow, currentStreams.recorder].forEach((stream, index) => {
                if (stream) {
                    stream.getTracks().forEach(track => {
                        track.stop();
                        console.log(`[SharedStream] Stopped track ${index}: ${track.kind}`);
                    });
                }
            });
            const emptyStreams = {
                source: null,
                livekit: null,
                tensorflow: null,
                recorder: null
            };
            setStreams(emptyStreams);
            streamsRef.current = emptyStreams;
            setIsReady(false);
        }

        return () => {
            isMounted = false;
            // Cleanup all streams on unmount
            console.log('[SharedStream] Cleaning up streams on unmount...');
            const currentStreams = streamsRef.current;
            [currentStreams.source, currentStreams.livekit, currentStreams.tensorflow, currentStreams.recorder].forEach((stream, index) => {
                if (stream) {
                    stream.getTracks().forEach(track => {
                        track.stop();
                        console.log(`[SharedStream] Cleanup stopped track ${index}: ${track.kind}`);
                    });
                }
            });
        };
    }, [enabled, retryCount]); // Only re-run when enabled or retryCount changes

    const retry = useCallback(() => {
        console.log('[SharedStream] Retrying stream initialization...');
        setRetryCount(prev => prev + 1);
    }, []);

    return {
        streams,
        isReady,
        error,
        retry
    };
}

/**
 * Get stream statistics for monitoring
 */
export function getStreamStats(stream: MediaStream | null): {
    active: boolean;
    videoTracks: number;
    audioTracks: number;
    videoEnabled: boolean;
    audioEnabled: boolean;
} {
    if (!stream) {
        return {
            active: false,
            videoTracks: 0,
            audioTracks: 0,
            videoEnabled: false,
            audioEnabled: false
        };
    }

    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();

    return {
        active: stream.active,
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length,
        videoEnabled: videoTracks.length > 0 && videoTracks[0].enabled,
        audioEnabled: audioTracks.length > 0 && audioTracks[0].enabled
    };
}
