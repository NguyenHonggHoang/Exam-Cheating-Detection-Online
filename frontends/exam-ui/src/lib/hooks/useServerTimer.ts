/**
 * Server-Synced Timer Hook
 * 
 * Uses server's startedAt timestamp for accurate timing.
 * Prevents client-side clock manipulation cheating.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseServerTimerOptions {
    /** Server timestamp when exam started (ISO string or epoch ms) */
    serverStartedAt: string | number | null;

    /** Total exam duration in minutes */
    durationMinutes: number;

    /** Callback when time is up */
    onTimeUp?: () => void;

    /** Whether to start the timer */
    enabled?: boolean;

    /** Re-sync with server time every N seconds (default: 10) */
    syncIntervalSeconds?: number;
}

export interface UseServerTimerReturn {
    /** Remaining seconds */
    secondsLeft: number;

    /** Whether timer is running */
    isRunning: boolean;

    /** Whether time has expired */
    isExpired: boolean;

    /** Whether in warning zone (< 5 minutes) */
    isWarning: boolean;

    /** Whether in critical zone (< 1 minute) */
    isCritical: boolean;

    /** Formatted time string (MM:SS) */
    formatTime: () => string;

    /** Formatted time string with hours (HH:MM:SS) */
    formatTimeWithHours: () => string;

    /** Progress percentage (0-100) */
    progressPercent: number;
}

export function useServerTimer(options: UseServerTimerOptions): UseServerTimerReturn {
    const {
        serverStartedAt,
        durationMinutes,
        onTimeUp,
        enabled = true,
        syncIntervalSeconds = 10
    } = options;

    const [secondsLeft, setSecondsLeft] = useState(durationMinutes * 60);
    const [isRunning, setIsRunning] = useState(false);
    const onTimeUpRef = useRef(onTimeUp);
    const hasTriggeredTimeUp = useRef(false);

    // Update callback ref
    useEffect(() => {
        onTimeUpRef.current = onTimeUp;
    }, [onTimeUp]);

    // Calculate remaining time based on server timestamp
    const calculateRemaining = useCallback((): number => {
        if (!serverStartedAt) {
            return durationMinutes * 60;
        }

        // Parse server timestamp
        let startedAtMs: number;
        if (typeof serverStartedAt === 'number') {
            startedAtMs = serverStartedAt;
        } else {
            startedAtMs = new Date(serverStartedAt).getTime();
        }

        // Calculate elapsed and remaining
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startedAtMs) / 1000);
        const totalSeconds = durationMinutes * 60;
        const remaining = Math.max(0, totalSeconds - elapsedSeconds);

        return remaining;
    }, [serverStartedAt, durationMinutes]);

    // Initialize and sync timer
    useEffect(() => {
        if (!enabled || !serverStartedAt) {
            setIsRunning(false);
            return;
        }

        hasTriggeredTimeUp.current = false;

        // Initial calculation
        const remaining = calculateRemaining();
        setSecondsLeft(remaining);
        setIsRunning(remaining > 0);

        // If already expired
        if (remaining <= 0) {
            if (!hasTriggeredTimeUp.current) {
                hasTriggeredTimeUp.current = true;
                onTimeUpRef.current?.();
            }
            return;
        }

        // Countdown interval (1 second)
        const countdownInterval = setInterval(() => {
            setSecondsLeft(prev => {
                const next = prev - 1;
                if (next <= 0) {
                    setIsRunning(false);
                    if (!hasTriggeredTimeUp.current) {
                        hasTriggeredTimeUp.current = true;
                        setTimeout(() => onTimeUpRef.current?.(), 0);
                    }
                    return 0;
                }
                return next;
            });
        }, 1000);

        // Sync interval (re-calculate from server time)
        const syncInterval = setInterval(() => {
            const synced = calculateRemaining();
            setSecondsLeft(synced);

            if (synced <= 0 && !hasTriggeredTimeUp.current) {
                hasTriggeredTimeUp.current = true;
                setIsRunning(false);
                onTimeUpRef.current?.();
            }
        }, syncIntervalSeconds * 1000);

        return () => {
            clearInterval(countdownInterval);
            clearInterval(syncInterval);
        };
    }, [enabled, serverStartedAt, durationMinutes, calculateRemaining, syncIntervalSeconds]);

    // Format as MM:SS
    const formatTime = useCallback((): string => {
        const mins = Math.floor(secondsLeft / 60);
        const secs = secondsLeft % 60;
        return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, [secondsLeft]);

    // Format as HH:MM:SS
    const formatTimeWithHours = useCallback((): string => {
        const hours = Math.floor(secondsLeft / 3600);
        const mins = Math.floor((secondsLeft % 3600) / 60);
        const secs = secondsLeft % 60;
        return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }, [secondsLeft]);

    const totalSeconds = durationMinutes * 60;
    const progressPercent = totalSeconds > 0
        ? Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100))
        : 0;

    return {
        secondsLeft,
        isRunning,
        isExpired: secondsLeft <= 0,
        isWarning: secondsLeft <= 300 && secondsLeft > 60, // < 5 min
        isCritical: secondsLeft <= 60, // < 1 min
        formatTime,
        formatTimeWithHours,
        progressPercent
    };
}

export default useServerTimer;
