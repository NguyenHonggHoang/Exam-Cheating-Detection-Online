import { useState, useEffect, useCallback, useRef } from 'react';
import { secureExamApi, type HeartbeatResponse } from '@/api/secureExam';

interface UseHeartbeatOptions {
    sessionId: string;
    intervalMs?: number;  // Default 5 seconds
    enabled?: boolean;
    onSessionLocked?: (reason: string) => void;
    onError?: (error: Error) => void;
}

interface UseHeartbeatReturn {
    isAlive: boolean;
    lastHeartbeat: number | null;
    lastResponse: HeartbeatResponse | null;
    error: Error | null;
    sendHeartbeat: () => Promise<void>;
}

export function useHeartbeat(options: UseHeartbeatOptions): UseHeartbeatReturn {
    const {
        sessionId,
        intervalMs = 5000,
        enabled = true,
        onSessionLocked,
        onError
    } = options;

    const [isAlive, setIsAlive] = useState(true);
    const [lastHeartbeat, setLastHeartbeat] = useState<number | null>(null);
    const [lastResponse, setLastResponse] = useState<HeartbeatResponse | null>(null);
    const [error, setError] = useState<Error | null>(null);

    const onSessionLockedRef = useRef(onSessionLocked);
    const onErrorRef = useRef(onError);

    useEffect(() => {
        onSessionLockedRef.current = onSessionLocked;
        onErrorRef.current = onError;
    }, [onSessionLocked, onError]);

    const sendHeartbeat = useCallback(async () => {
        if (!sessionId) return;

        try {
            const response = await secureExamApi.heartbeat(sessionId);
            setLastResponse(response);
            setLastHeartbeat(Date.now());
            setIsAlive(response.ok);
            setError(null);

            if (response.isLocked && response.lockReason) {
                onSessionLockedRef.current?.(response.lockReason);
            }
        } catch (err) {
            const error = err instanceof Error ? err : new Error('Heartbeat failed');
            setError(error);
            setIsAlive(false);
            onErrorRef.current?.(error);
        }
    }, [sessionId]);

    // Periodic heartbeat
    useEffect(() => {
        if (!enabled || !sessionId) return;

        // Initial heartbeat
        sendHeartbeat();

        // Set up interval
        const interval = setInterval(sendHeartbeat, intervalMs);

        return () => clearInterval(interval);
    }, [enabled, sessionId, intervalMs, sendHeartbeat]);

    return {
        isAlive,
        lastHeartbeat,
        lastResponse,
        error,
        sendHeartbeat
    };
}

export default useHeartbeat;
