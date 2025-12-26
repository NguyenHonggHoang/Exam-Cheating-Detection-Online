/**
 * Idle Detection Hook
 * 
 * Detects user inactivity and triggers callback.
 * Used to lock exam session when user is idle.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseIdleDetectionOptions {
    timeoutMs?: number;  // Default 30 seconds
    onIdle: () => void;
    enabled?: boolean;
    events?: string[];
}

interface UseIdleDetectionReturn {
    isIdle: boolean;
    lastActivityAt: number;
    remainingMs: number;
    reset: () => void;
}

const DEFAULT_EVENTS = [
    'mousedown',
    'mousemove',
    'keydown',
    'scroll',
    'touchstart',
    'click'
];

export function useIdleDetection(
    options: UseIdleDetectionOptions
): UseIdleDetectionReturn {
    const {
        timeoutMs = 30000,
        onIdle,
        enabled = true,
        events = DEFAULT_EVENTS
    } = options;

    const [isIdle, setIsIdle] = useState(false);
    const [lastActivityAt, setLastActivityAt] = useState(Date.now());
    const [remainingMs, setRemainingMs] = useState(timeoutMs);

    const onIdleRef = useRef(onIdle);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);
    const idledRef = useRef(false);

    // Update ref when callback changes
    useEffect(() => {
        onIdleRef.current = onIdle;
    }, [onIdle]);

    // Reset activity
    const reset = useCallback(() => {
        setLastActivityAt(Date.now());
        setIsIdle(false);
        setRemainingMs(timeoutMs);
        idledRef.current = false;
    }, [timeoutMs]);

    // Handle activity
    const handleActivity = useCallback(() => {
        if (!enabled) return;

        setLastActivityAt(Date.now());
        setIsIdle(false);
        setRemainingMs(timeoutMs);
        idledRef.current = false;

        // Reset timeout
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        timeoutRef.current = setTimeout(() => {
            if (!idledRef.current) {
                idledRef.current = true;
                setIsIdle(true);
                setRemainingMs(0);
                onIdleRef.current();
            }
        }, timeoutMs);
    }, [enabled, timeoutMs]);

    // Set up event listeners
    useEffect(() => {
        if (!enabled) return;

        // Initial timeout
        handleActivity();

        // Add listeners
        events.forEach(event => {
            document.addEventListener(event, handleActivity, { passive: true });
        });

        return () => {
            events.forEach(event => {
                document.removeEventListener(event, handleActivity);
            });

            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, [enabled, events, handleActivity]);

    // Update remaining time
    useEffect(() => {
        if (!enabled || isIdle) return;

        const interval = setInterval(() => {
            const elapsed = Date.now() - lastActivityAt;
            const remaining = Math.max(0, timeoutMs - elapsed);
            setRemainingMs(remaining);
        }, 1000);

        return () => clearInterval(interval);
    }, [enabled, isIdle, lastActivityAt, timeoutMs]);

    return {
        isIdle,
        lastActivityAt,
        remainingMs,
        reset
    };
}

export default useIdleDetection;
