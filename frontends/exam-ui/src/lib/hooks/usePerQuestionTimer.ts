/**
 * Per-Question Timer Hook
 * 
 * Tracks time for individual questions with server-time validation.
 * Auto-calls onTimeUp when time expires.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UsePerQuestionTimerOptions {
    timeLimitSeconds: number;
    startedAtEpochMs: number;  // Server timestamp
    onTimeUp: () => void;
    enabled?: boolean;
}

interface UsePerQuestionTimerReturn {
    secondsLeft: number;
    percentLeft: number;
    isExpired: boolean;
    isWarning: boolean;  // < 10 seconds
    isCritical: boolean; // < 5 seconds
    formatTime: () => string;
}

export function usePerQuestionTimer(
    options: UsePerQuestionTimerOptions
): UsePerQuestionTimerReturn {
    const { timeLimitSeconds, startedAtEpochMs, onTimeUp, enabled = true } = options;

    const [secondsLeft, setSecondsLeft] = useState(timeLimitSeconds);
    const onTimeUpRef = useRef(onTimeUp);
    const hasExpiredRef = useRef(false);

    // Update ref when callback changes
    useEffect(() => {
        onTimeUpRef.current = onTimeUp;
    }, [onTimeUp]);

    // Calculate initial time based on server timestamp
    useEffect(() => {
        if (!enabled) return;

        hasExpiredRef.current = false;

        // Calculate elapsed time since server started this question
        const serverElapsed = Math.floor((Date.now() - startedAtEpochMs) / 1000);
        const remaining = Math.max(0, timeLimitSeconds - serverElapsed);
        setSecondsLeft(remaining);

        // If already expired
        if (remaining <= 0) {
            hasExpiredRef.current = true;
            onTimeUpRef.current();
            return;
        }

        // Start countdown
        const interval = setInterval(() => {
            setSecondsLeft((prev) => {
                const next = prev - 1;
                if (next <= 0 && !hasExpiredRef.current) {
                    hasExpiredRef.current = true;
                    clearInterval(interval);
                    // Use setTimeout to avoid calling setState during render
                    setTimeout(() => onTimeUpRef.current(), 0);
                    return 0;
                }
                return Math.max(0, next);
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [timeLimitSeconds, startedAtEpochMs, enabled]);

    // Format time as MM:SS
    const formatTime = useCallback((): string => {
        const mins = Math.floor(secondsLeft / 60);
        const secs = secondsLeft % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }, [secondsLeft]);

    return {
        secondsLeft,
        percentLeft: (secondsLeft / timeLimitSeconds) * 100,
        isExpired: secondsLeft <= 0,
        isWarning: secondsLeft <= 10 && secondsLeft > 5,
        isCritical: secondsLeft <= 5,
        formatTime
    };
}

export default usePerQuestionTimer;
