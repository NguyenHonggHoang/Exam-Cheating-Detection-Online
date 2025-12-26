import { useEffect } from 'react';
import { useLocalParticipant } from '@livekit/components-react';
import { Track } from 'livekit-client';

/**
 * Publish External Stream to LiveKit
 * 
 * Takes a pre-created MediaStream and publishes it to LiveKit room
 * This allows us to use the same stream for TensorFlow detection
 */

interface PublishExternalStreamProps {
    stream: MediaStream | null;
    enabled?: boolean;
}

export function PublishExternalStream({ stream, enabled = true }: PublishExternalStreamProps) {
    const { localParticipant } = useLocalParticipant();

    useEffect(() => {
        if (!stream || !localParticipant || !enabled) {
            return;
        }

        console.log('[LiveKit] Publishing external stream...');

        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        if (!videoTrack) {
            console.warn('[LiveKit] No video track in stream');
            return;
        }

        const publishTracks = async () => {
            try {
                // Publish video track
                await localParticipant.publishTrack(videoTrack, {
                    name: 'camera',
                    source: Track.Source.Camera,
                    simulcast: false  // Disable simulcast for exam (save bandwidth)
                });

                console.log('[LiveKit] ✅ Video track published');

                // Publish audio track if available
                if (audioTrack) {
                    await localParticipant.publishTrack(audioTrack, {
                        name: 'microphone',
                        source: Track.Source.Microphone
                    });

                    console.log('[LiveKit] ✅ Audio track published');
                }

            } catch (error) {
                console.error('[LiveKit] Failed to publish tracks:', error);
            }
        };

        publishTracks();

        return () => {
            // Unpublish on unmount
            console.log('[LiveKit] Unpublishing tracks...');

            if (videoTrack) {
                localParticipant.unpublishTrack(videoTrack).catch(err => {
                    console.error('[LiveKit] Failed to unpublish video:', err);
                });
            }

            if (audioTrack) {
                localParticipant.unpublishTrack(audioTrack).catch(err => {
                    console.error('[LiveKit] Failed to unpublish audio:', err);
                });
            }
        };
    }, [stream, localParticipant, enabled]);

    return null;  // This is a logic-only component
}
