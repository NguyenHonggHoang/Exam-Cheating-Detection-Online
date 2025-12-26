import { useState, useEffect } from 'react';

/**
 * LiveKit Token Hook
 * 
 * Fetches JWT token from session-service for LiveKit room access
 */

export interface LiveKitTokenData {
    token: string;
    wsUrl: string;
    roomName: string;
}

export function useLiveKitToken(sessionId: string | null) {
    const [data, setData] = useState<LiveKitTokenData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!sessionId) {
            return;
        }

        const fetchToken = async () => {
            setLoading(true);
            setError(null);

            try {
                console.log(`[LiveKit] Fetching token for session: ${sessionId}`);

                // Route through BFF proxy which handles auth cookie
                const response = await fetch(`/api/proxy/sessions/${sessionId}/join`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    credentials: 'include'  // Send session cookie
                });

                if (!response.ok) {
                    throw new Error(`Failed to get LiveKit token: ${response.statusText}`);
                }

                const tokenData = await response.json();

                // Use URL directly from backend (configured via livekit.public-url)
                // Fix internal Docker URL to localhost for browser access
                const wsUrl = (tokenData.wsUrl || '')
                    .replace('ws://host.docker.internal:', 'ws://localhost:')
                    .replace('wss://host.docker.internal:', 'wss://localhost:')
                    .replace('ws://livekit:', 'ws://localhost:')
                    .replace('wss://livekit:', 'wss://localhost:');

                console.log('[LiveKit] ✅ Token received');
                console.log(`[LiveKit] Room: ${tokenData.roomName}`);
                console.log(`[LiveKit] WS URL: ${wsUrl}`);

                setData({
                    ...tokenData,
                    wsUrl
                });

            } catch (err) {
                console.error('[LiveKit] Failed to fetch token:', err);
                const error = err instanceof Error ? err : new Error('Failed to connect to media server');
                setError(error);
            } finally {
                setLoading(false);
            }
        };

        fetchToken();
    }, [sessionId]);

    return { data, loading, error };
}
