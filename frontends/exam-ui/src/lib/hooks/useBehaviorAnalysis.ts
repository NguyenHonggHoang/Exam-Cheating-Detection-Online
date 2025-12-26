import { useState, useEffect, useCallback, useRef } from 'react';

// Types
export type BehaviorEventType =
    | 'TEMPORAL_ANOMALY'
    | 'IMPOSSIBLE_SPEED'
    | 'ANSWER_BURST'
    | 'PRE_SUSPICION';

export interface BehaviorEvent {
    type: BehaviorEventType;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    details: string;
    timestamp: number;
}

interface UseBehaviorAnalysisProps {
    sessionId: string | null;
    onViolation: (event: BehaviorEvent) => void;
    enabled?: boolean;
}

export const useBehaviorAnalysis = ({
    sessionId,
    onViolation,
    enabled = true
}: UseBehaviorAnalysisProps) => {
    // State for Temporal Analysis
    const eventHistoryRef = useRef<number[]>([]);

    // State for Answer Analysis
    const lastAnswerTimeRef = useRef<number>(Date.now());
    const answerHistoryRef = useRef<number[]>([]);

    // 1. Temporal Pattern Analysis
    // Call this whenever a minor violation occurs (e.g., tab switch, look away)
    const trackEvent = useCallback(() => {
        if (!enabled) return;

        const now = Date.now();
        eventHistoryRef.current.push(now);

        // Clean old events (> 60s)
        eventHistoryRef.current = eventHistoryRef.current.filter(t => now - t < 60000);

        // Check for clustering (e.g., 3 events in 60s)
        if (eventHistoryRef.current.length >= 3) {
            onViolation({
                type: 'TEMPORAL_ANOMALY',
                severity: 'MEDIUM',
                details: `Detected ${eventHistoryRef.current.length} violations in 60 seconds`,
                timestamp: now
            });
            // Reset history to avoid spamming
            eventHistoryRef.current = [];
        }
    }, [enabled, onViolation]);

    // 2. Answer Behavior Analysis
    const analyzeAnswer = useCallback((textLength: number, isPaste: boolean = false) => {
        if (!enabled) return;

        const now = Date.now();
        const timeDiff = (now - lastAnswerTimeRef.current) / 1000; // seconds
        lastAnswerTimeRef.current = now;

        // A. Impossible Speed (Typing)
        if (!isPaste && textLength > 0 && timeDiff > 0) {
            const charsPerSec = textLength / timeDiff;
            if (charsPerSec > 15 && textLength > 5) { // Threshold: 15 chars/s
                onViolation({
                    type: 'IMPOSSIBLE_SPEED',
                    severity: 'HIGH',
                    details: `Typing speed anomaly: ${charsPerSec.toFixed(1)} chars/s`,
                    timestamp: now
                });
            }
        }

        // B. Answer Burst (Submission frequency)
        answerHistoryRef.current.push(now);
        // Keep last 30s
        answerHistoryRef.current = answerHistoryRef.current.filter(t => now - t < 30000);

        // Check for burst (e.g., 3 answers in 10s)
        const recentAnswers = answerHistoryRef.current.filter(t => now - t < 10000);
        if (recentAnswers.length >= 3) {
            onViolation({
                type: 'ANSWER_BURST',
                severity: 'MEDIUM',
                details: 'Multiple answers submitted in rapid succession',
                timestamp: now
            });
            answerHistoryRef.current = []; // Reset
        }
    }, [enabled, onViolation]);

    return {
        trackEvent,
        analyzeAnswer
    };
};
