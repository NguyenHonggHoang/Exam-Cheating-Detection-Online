import { useEffect, useRef, useState, useCallback } from 'react';

export interface SignalingMessage {
    type: 'offer' | 'answer' | 'ice-candidate' | 'error';
    payload: any;
}

export interface MediaSignalingOptions {
    sessionId: string;
    onConnected?: () => void;
    onDisconnected?: () => void;
    onError?: (error: Error) => void;
    onRemoteStream?: (stream: MediaStream) => void;
}

/**
 * Hook for WebRTC signaling via WebSocket
 * 
 * Flow:
 * 1. Connect to Session Service WebSocket
 * 2. Exchange SDP Offer/Answer
 * 3. Exchange ICE candidates
 * 4. Establish P2P connection to Media Server
 */
export function useMediaSignaling(options: MediaSignalingOptions) {
    const {
        sessionId,
        onConnected,
        onDisconnected,
        onError,
        onRemoteStream
    } = options;

    const wsRef = useRef<WebSocket | null>(null);
    const pcRef = useRef<RTCPeerConnection | null>(null);
    const [connected, setConnected] = useState(false);
    const [signalingState, setSignalingState] = useState<RTCSignalingState>('stable');

    /**
     * Initialize WebSocket connection to signaling server
     * Uses relative URL to go through Vite proxy (dev) or BFF proxy (prod)
     */
    const connectSignaling = useCallback(() => {
        const token = localStorage.getItem('access_token');
        // Use relative WebSocket URL - Vite proxy handles routing to session-service
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/signaling?sessionId=${sessionId}&token=${token}`;

        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
            console.log('[Signaling] WebSocket connected');
            setConnected(true);
            onConnected?.();
        };

        ws.onmessage = async (event) => {
            try {
                const message: SignalingMessage = JSON.parse(event.data);
                await handleSignalingMessage(message);
            } catch (error) {
                console.error('[Signaling] Error handling message:', error);
                onError?.(error as Error);
            }
        };

        ws.onerror = (error) => {
            console.error('[Signaling] WebSocket error:', error);
            onError?.(new Error('Signaling connection failed'));
        };

        ws.onclose = () => {
            console.log('[Signaling] WebSocket disconnected');
            setConnected(false);
            onDisconnected?.();
        };
    }, [sessionId, onConnected, onDisconnected, onError]);

    /**
     * Initialize RTCPeerConnection
     */
    const initPeerConnection = useCallback(() => {
        const config: RTCConfiguration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        const pc = new RTCPeerConnection(config);
        pcRef.current = pc;

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'ice-candidate',
                    payload: event.candidate
                }));
            }
        };

        // Handle remote stream
        pc.ontrack = (event) => {
            console.log('[WebRTC] Received remote track');
            if (event.streams && event.streams[0]) {
                onRemoteStream?.(event.streams[0]);
            }
        };

        // Monitor connection state
        pc.onconnectionstatechange = () => {
            console.log('[WebRTC] Connection state:', pc.connectionState);
            if (pc.connectionState === 'failed') {
                onError?.(new Error('WebRTC connection failed'));
            }
        };

        // Monitor signaling state
        pc.onsignalingstatechange = () => {
            setSignalingState(pc.signalingState);
        };

        return pc;
    }, [onRemoteStream, onError]);

    /**
     * Handle signaling messages from server
     */
    const handleSignalingMessage = useCallback(async (message: SignalingMessage) => {
        const pc = pcRef.current;
        if (!pc) return;

        switch (message.type) {
            case 'answer':
                await pc.setRemoteDescription(new RTCSessionDescription(message.payload));
                console.log('[Signaling] Remote description set (answer)');
                break;

            case 'ice-candidate':
                if (message.payload) {
                    await pc.addIceCandidate(new RTCIceCandidate(message.payload));
                    console.log('[Signaling] ICE candidate added');
                }
                break;

            case 'error':
                console.error('[Signaling] Server error:', message.payload);
                onError?.(new Error(message.payload.message));
                break;
        }
    }, [onError]);

    /**
     * Start streaming local media to server
     */
    const startStreaming = useCallback(async (localStream: MediaStream) => {
        try {
            // Initialize peer connection
            const pc = initPeerConnection();

            // Add local tracks
            localStream.getTracks().forEach(track => {
                pc.addTrack(track, localStream);
            });

            // Create and send offer
            const offer = await pc.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: true
            });

            await pc.setLocalDescription(offer);

            // Send offer via WebSocket
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({
                    type: 'offer',
                    payload: offer
                }));
                console.log('[Signaling] Offer sent');
            }
        } catch (error) {
            console.error('[WebRTC] Error starting stream:', error);
            onError?.(error as Error);
        }
    }, [initPeerConnection, onError]);

    /**
     * Stop streaming and close connections
     */
    const stopStreaming = useCallback(() => {
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }

        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }

        setConnected(false);
    }, []);

    // Connect on mount
    useEffect(() => {
        connectSignaling();

        return () => {
            stopStreaming();
        };
    }, [connectSignaling, stopStreaming]);

    return {
        connected,
        signalingState,
        startStreaming,
        stopStreaming
    };
}
