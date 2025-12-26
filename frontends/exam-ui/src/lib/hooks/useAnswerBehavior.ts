import { useState, useEffect, useRef, useCallback } from 'react';

export type BehaviorAnomaly = {
    type: 'RAPID_ANSWER' | 'EXCESSIVE_REVISION' | 'SUSPICIOUS_PATTERN' | 'TYPING_SPEED_ANOMALY';
    severity: 'low' | 'medium' | 'high';
    score: number;
    description: string;
    evidence: any;
};

export type AnswerChange = {
    fromAnswer: string;
    toAnswer: string;
    timestamp: number;
    reason?: string;
};

export type AnswerEvent = {
    questionId: string;
    questionIndex: number;
    difficulty: 'easy' | 'medium' | 'hard';
    selectedAnswer: string;
    timeToAnswerMs: number;
    revisionCount: number;
    answerChanges: AnswerChange[];
    hadPreSuspicionDuring: boolean;
    startedAt: number;
    submittedAt: number;
};

export type BehaviorAnalysis = {
    overallScore: number;
    anomalies: BehaviorAnomaly[];
    statistics: {
        averageTimePerQuestion: number;
        averageRevisions: number;
        rapidAnswers: number;
        slowAnswers: number;
    };
    patterns: {
        preSuspicionCount: number;
        timeClusterAnomalies: number;
    };
};

type UseAnswerBehaviorOptions = {
    sessionId: string;
    examId: string;
    enabled?: boolean;
    onAnomalyDetected?: (anomalies: BehaviorAnomaly[]) => void;
    onRiskScoreChange?: (score: number) => void;
};

export function useAnswerBehavior(options: UseAnswerBehaviorOptions) {
    const { sessionId, examId, enabled = true, onAnomalyDetected, onRiskScoreChange } = options;

    const [answerEvents, setAnswerEvents] = useState<AnswerEvent[]>([]);
    const [currentQuestionStart, setCurrentQuestionStart] = useState<Record<string, number>>({});
    const [answerChanges, setAnswerChanges] = useState<Record<string, AnswerChange[]>>({});
    const [preSuspicionFlags, setPreSuspicionFlags] = useState<Record<string, boolean>>({});

    const lastRiskScoreRef = useRef<number>(0);

    // Load from sessionStorage on mount
    useEffect(() => {
        if (!enabled || !sessionId) return;

        const key = `answer_behavior_${sessionId}`;
        const stored = sessionStorage.getItem(key);

        if (stored) {
            try {
                const data = JSON.parse(stored);
                setAnswerEvents(data.events || []);
                setCurrentQuestionStart(data.starts || {});
                setAnswerChanges(data.changes || {});
                setPreSuspicionFlags(data.flags || {});
            } catch (e) {
                console.error('[useAnswerBehavior] Failed to load stored data:', e);
            }
        }
    }, [sessionId, enabled]);

    // Save to sessionStorage on changes
    useEffect(() => {
        if (!enabled || !sessionId) return;

        const key = `answer_behavior_${sessionId}`;
        const data = {
            events: answerEvents,
            starts: currentQuestionStart,
            changes: answerChanges,
            flags: preSuspicionFlags,
        };

        sessionStorage.setItem(key, JSON.stringify(data));
    }, [sessionId, answerEvents, currentQuestionStart, answerChanges, preSuspicionFlags, enabled]);

    const startQuestion = useCallback((questionId: string) => {
        if (!enabled) return;

        setCurrentQuestionStart(prev => ({
            ...prev,
            [questionId]: Date.now()
        }));

        // Initialize answer changes for this question
        if (!answerChanges[questionId]) {
            setAnswerChanges(prev => ({
                ...prev,
                [questionId]: []
            }));
        }
    }, [enabled, answerChanges]);

    const recordAnswerChange = useCallback((questionId: string, newAnswer: string) => {
        if (!enabled) return;

        setAnswerChanges(prev => {
            const existing = prev[questionId] || [];
            const lastAnswer = existing.length > 0
                ? existing[existing.length - 1].toAnswer
                : '';

            // Only record if answer actually changed
            if (lastAnswer !== newAnswer) {
                return {
                    ...prev,
                    [questionId]: [
                        ...existing,
                        {
                            fromAnswer: lastAnswer,
                            toAnswer: newAnswer,
                            timestamp: Date.now()
                        }
                    ]
                };
            }

            return prev;
        });
    }, [enabled]);

    const markPreSuspicionDuring = useCallback(() => {
        if (!enabled) return;

        // Mark the current active question
        setPreSuspicionFlags(prev => {
            const activeQuestionId = Object.keys(currentQuestionStart).find(
                id => !answerEvents.some(e => e.questionId === id)
            );

            if (activeQuestionId) {
                return {
                    ...prev,
                    [activeQuestionId]: true
                };
            }

            return prev;
        });
    }, [enabled, currentQuestionStart, answerEvents]);

    const submitAnswer = useCallback((
        questionId: string,
        questionIndex: number,
        difficulty: 'easy' | 'medium' | 'hard',
        answer: string
    ) => {
        if (!enabled) return;

        const startTime = currentQuestionStart[questionId];
        if (!startTime) {
            console.warn(`[useAnswerBehavior] No start time for question ${questionId}`);
            return;
        }

        const submittedAt = Date.now();
        const timeToAnswer = submittedAt - startTime;
        const changes = answerChanges[questionId] || [];
        const hadPreSuspicion = preSuspicionFlags[questionId] || false;

        const event: AnswerEvent = {
            questionId,
            questionIndex,
            difficulty,
            selectedAnswer: answer,
            timeToAnswerMs: timeToAnswer,
            revisionCount: changes.length,
            answerChanges: changes,
            hadPreSuspicionDuring: hadPreSuspicion,
            startedAt: startTime,
            submittedAt
        };

        setAnswerEvents(prev => {
            // Remove existing event for this question if it exists (e.g., user navigated back)
            const filtered = prev.filter(e => e.questionId !== questionId);
            return [...filtered, event];
        });

        // Detect anomalies for this answer
        const anomalies = detectAnswerAnomalies(event);
        if (anomalies.length > 0 && onAnomalyDetected) {
            onAnomalyDetected(anomalies);
        }
    }, [enabled, currentQuestionStart, answerChanges, preSuspicionFlags, onAnomalyDetected]);

    const getAnswers = useCallback(() => {
        return answerEvents;
    }, [answerEvents]);

    const getAnalysis = useCallback((): BehaviorAnalysis => {
        const events = answerEvents;

        if (events.length === 0) {
            return {
                overallScore: 0,
                anomalies: [],
                statistics: {
                    averageTimePerQuestion: 0,
                    averageRevisions: 0,
                    rapidAnswers: 0,
                    slowAnswers: 0
                },
                patterns: {
                    preSuspicionCount: 0,
                    timeClusterAnomalies: 0
                }
            };
        }

        // Calculate statistics
        const totalTime = events.reduce((sum, e) => sum + e.timeToAnswerMs, 0);
        const avgTime = totalTime / events.length;
        const totalRevisions = events.reduce((sum, e) => sum + e.revisionCount, 0);
        const avgRevisions = totalRevisions / events.length;

        // Count rapid and slow answers
        const rapidAnswers = events.filter(e => {
            const threshold = e.difficulty === 'easy' ? 5000 : e.difficulty === 'medium' ? 10000 : 15000;
            return e.timeToAnswerMs < threshold;
        }).length;

        const slowAnswers = events.filter(e => e.timeToAnswerMs > 300000).length; // > 5 min

        // Detect all anomalies
        const allAnomalies: BehaviorAnomaly[] = [];
        events.forEach(event => {
            const eventAnomalies = detectAnswerAnomalies(event);
            allAnomalies.push(...eventAnomalies);
        });

        // Pattern analysis
        const preSuspicionCount = events.filter(e => e.hadPreSuspicionDuring).length;

        // Calculate overall risk score
        const riskScore = calculateRiskScore(events, allAnomalies);

        // Notify if risk score changed significantly
        if (Math.abs(riskScore - lastRiskScoreRef.current) > 10 && onRiskScoreChange) {
            lastRiskScoreRef.current = riskScore;
            onRiskScoreChange(riskScore);
        }

        return {
            overallScore: riskScore,
            anomalies: allAnomalies,
            statistics: {
                averageTimePerQuestion: avgTime,
                averageRevisions: avgRevisions,
                rapidAnswers,
                slowAnswers
            },
            patterns: {
                preSuspicionCount,
                timeClusterAnomalies: 0 // TODO: Implement clustering
            }
        };
    }, [answerEvents, onRiskScoreChange]);

    return {
        startQuestion,
        recordAnswerChange,
        markPreSuspicionDuring,
        submitAnswer,
        getAnswers,
        getAnalysis
    };
}

// Helper: Detect anomalies for a single answer
function detectAnswerAnomalies(event: AnswerEvent): BehaviorAnomaly[] {
    const anomalies: BehaviorAnomaly[] = [];

    // RAPID_ANSWER: Too fast for difficulty
    const timeThreshold = event.difficulty === 'easy' ? 5000 :
        event.difficulty === 'medium' ? 10000 : 15000;

    if (event.timeToAnswerMs < timeThreshold) {
        anomalies.push({
            type: 'RAPID_ANSWER',
            severity: event.difficulty === 'hard' ? 'high' : 'medium',
            score: 30,
            description: `Answered ${event.difficulty} question in ${(event.timeToAnswerMs / 1000).toFixed(1)}s (threshold: ${timeThreshold / 1000}s)`,
            evidence: { questionId: event.questionId, time: event.timeToAnswerMs, threshold: timeThreshold }
        });
    }

    // EXCESSIVE_REVISION: Too many answer changes
    if (event.revisionCount > 5) {
        anomalies.push({
            type: 'EXCESSIVE_REVISION',
            severity: event.revisionCount > 10 ? 'high' : 'medium',
            score: 25,
            description: `Changed answer ${event.revisionCount} times`,
            evidence: { questionId: event.questionId, revisions: event.revisionCount, changes: event.answerChanges }
        });
    }

    // SUSPICIOUS_PATTERN: Pre-suspicion active during answer
    if (event.hadPreSuspicionDuring) {
        anomalies.push({
            type: 'SUSPICIOUS_PATTERN',
            severity: 'high',
            score: 40,
            description: 'Answered while pre-suspicion detection active (looking away/phone usage suspected)',
            evidence: { questionId: event.questionId }
        });
    }

    return anomalies;
}

// Helper: Calculate overall risk score
function calculateRiskScore(events: AnswerEvent[], anomalies: BehaviorAnomaly[]): number {
    if (events.length === 0) return 0;

    let score = 0;

    // Base score from anomalies
    anomalies.forEach(anomaly => {
        score += anomaly.score;
    });

    // Normalize by number of questions
    score = score / events.length;

    // Cap at 100
    return Math.min(100, Math.round(score));
}
