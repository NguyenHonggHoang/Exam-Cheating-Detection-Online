import { useEffect, useRef, useCallback } from 'react';
import {
    Room,
    RoomEvent,
    VideoPresets,
    LocalVideoTrack,
    LocalAudioTrack,
    Track,
    createLocalTracks
} from 'livekit-client';

interface ExamRoomProps {
    sessionId: string;
    stream: MediaStream | null;
    token: string;
    wsUrl: string;
    onRoomConnected?: () => void;
    onRoomDisconnected?: () => void;
    onError?: (error: Error) => void;
}

/**
 * ExamRoom - Refactored
 * 
 * Uses external stream instead of internal getUserMedia
 * Publishes to LiveKit for proctor viewing
 */
export const ExamRoom = ({
    sessionId,
    stream,
    token,
    wsUrl,
    onRoomConnected,
    onRoomDisconnected,
    onError
}: ExamRoomProps) => {
    const roomRef = useRef<Room | null>(null);
    const publishedRef = useRef(false);
    const connectingRef = useRef(false);

    // Use refs for callbacks to avoid re-running useEffect
    const streamRef = useRef(stream);
    const onRoomConnectedRef = useRef(onRoomConnected);
    const onRoomDisconnectedRef = useRef(onRoomDisconnected);
    const onErrorRef = useRef(onError);

    // Update refs when props change
    streamRef.current = stream;
    onRoomConnectedRef.current = onRoomConnected;
    onRoomDisconnectedRef.current = onRoomDisconnected;
    onErrorRef.current = onError;

    // Publish stream to room
    const publishStream = useCallback(async (room: Room) => {
        if (publishedRef.current || !streamRef.current) return;

        try {
            const videoTrack = streamRef.current.getVideoTracks()[0];
            const audioTrack = streamRef.current.getAudioTracks()[0];

            if (videoTrack) {
                const localVideoTrack = new LocalVideoTrack(videoTrack);
                await room.localParticipant.publishTrack(localVideoTrack, {
                    name: 'camera',
                    source: Track.Source.Camera, // Explicit source for proctor subscription
                    simulcast: false, // Disable simulcast for better Egress stability
                    videoEncoding: {
                        maxBitrate: 1500000, // 1.5 Mbps
                        maxFramerate: 24
                    }
                });
                console.log('[ExamRoom] Video track published with source: Camera');
            }

            if (audioTrack) {
                const localAudioTrack = new LocalAudioTrack(audioTrack);
                await room.localParticipant.publishTrack(localAudioTrack, {
                    name: 'microphone',
                    source: Track.Source.Microphone // Explicit source
                });
                console.log('[ExamRoom] Audio track published with source: Microphone');
            }

            publishedRef.current = true;
        } catch (error) {
            console.error('[ExamRoom] Failed to publish tracks:', error);
            onErrorRef.current?.(error as Error);
        }
    }, []);

    // Store latest props in refs (so we can access current values without causing re-runs)
    const tokenRef = useRef(token);
    const wsUrlRef = useRef(wsUrl);
    const sessionIdRef = useRef(sessionId);

    // Ref to track if initial connect was attempted
    const initialConnectAttemptedRef = useRef(false);
    // Ref to the connect function so we can call it from multiple places
    const connectFnRef = useRef<(() => Promise<void>) | null>(null);

    // Update refs when props change (but don't re-run the main effect)
    useEffect(() => {
        tokenRef.current = token;
        wsUrlRef.current = wsUrl;
        sessionIdRef.current = sessionId;

        // If we haven't connected yet and now have valid props, try to connect
        if (token && wsUrl && !roomRef.current && !connectingRef.current && connectFnRef.current) {
            console.log('[ExamRoom] Token available, attempting connection...');
            connectFnRef.current();
        }
    }, [token, wsUrl, sessionId]);

    // Connect to room - only run on MOUNT, cleanup only on UNMOUNT
    // This prevents disconnect/reconnect when parent re-renders
    useEffect(() => {
        // Use a ref to track if we've started connecting
        let isMounted = true;

        const connect = async () => {
            const currentToken = tokenRef.current;
            const currentWsUrl = wsUrlRef.current;
            const currentSessionId = sessionIdRef.current;

            if (!currentToken || !currentWsUrl) {
                console.log('[ExamRoom] Missing token or wsUrl, waiting...');
                return;
            }

            // Prevent multiple connections
            if (connectingRef.current || roomRef.current) {
                console.log('[ExamRoom] Already connecting or connected, skipping');
                return;
            }

            connectingRef.current = true;

            const room = new Room({
                adaptiveStream: true,
                dynacast: true
            });

            roomRef.current = room;

            // Event handlers
            room.on(RoomEvent.Connected, () => {
                console.log('[ExamRoom] Connected to room:', currentSessionId);
                connectingRef.current = false;
                onRoomConnectedRef.current?.();
                publishStream(room);
            });

            room.on(RoomEvent.Disconnected, () => {
                console.log('[ExamRoom] Disconnected from room');
                publishedRef.current = false;
                connectingRef.current = false;
                onRoomDisconnectedRef.current?.();
            });

            room.on(RoomEvent.Reconnecting, () => {
                console.log('[ExamRoom] Reconnecting...');
            });

            room.on(RoomEvent.Reconnected, () => {
                console.log('[ExamRoom] Reconnected');
                if (!publishedRef.current) {
                    publishStream(room);
                }
            });

            // Connect
            console.log('[ExamRoom] Connecting to:', currentWsUrl);
            try {
                await room.connect(currentWsUrl, currentToken);
            } catch (error) {
                console.error('[ExamRoom] Connection error:', error);
                connectingRef.current = false;
                if (isMounted) {
                    onErrorRef.current?.(error as Error);
                }
            }
        };

        // Store connect function in ref so other effects can call it
        connectFnRef.current = connect;

        connect();

        // Cleanup ONLY on component unmount
        return () => {
            isMounted = false;
            if (roomRef.current) {
                console.log('[ExamRoom] Component unmounting - cleaning up room');
                roomRef.current.disconnect();
                roomRef.current = null;
                publishedRef.current = false;
                connectingRef.current = false;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Empty deps = only run on mount/unmount

    // Handle stream updates - publish when stream becomes available
    useEffect(() => {
        if (roomRef.current && roomRef.current.state === 'connected' && stream && !publishedRef.current) {
            console.log('[ExamRoom] Stream became available, publishing...');
            publishStream(roomRef.current);
        }
    }, [stream, publishStream]);

    // This component doesn't render anything - it just manages the LiveKit connection
    return null;
};

export default ExamRoom;
