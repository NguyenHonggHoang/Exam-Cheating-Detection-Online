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
    averageTypingSpeed?: number;
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
        answer: string,
        averageTypingSpeed?: number // Added optional parameter
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
            submittedAt,
            averageTypingSpeed // Store it in event
        };

        setAnswerEvents(prev => {
            const filtered = prev.filter(e => e.questionId !== questionId);
            return [...filtered, event];
        });
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

        const totalTime = events.reduce((sum, e) => sum + e.timeToAnswerMs, 0);
        const avgTime = totalTime / events.length;
        const totalRevisions = events.reduce((sum, e) => sum + e.revisionCount, 0);
        const avgRevisions = totalRevisions / events.length;

        const rapidAnswers = events.filter(e => {
            const threshold = e.difficulty === 'easy' ? 5000 : e.difficulty === 'medium' ? 10000 : 15000;
            return e.timeToAnswerMs < threshold;
        }).length;

        const slowAnswers = events.filter(e => e.timeToAnswerMs > 300000).length;

        const allAnomalies: BehaviorAnomaly[] = [];
        events.forEach(event => {
            const eventAnomalies = detectAnswerAnomalies(event);
            allAnomalies.push(...eventAnomalies);
        });

        const preSuspicionCount = events.filter(e => e.hadPreSuspicionDuring).length;

        const riskScore = calculateRiskScore(events, allAnomalies);

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
                timeClusterAnomalies: 0
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



function detectAnswerAnomalies(event: AnswerEvent): BehaviorAnomaly[] {
    const anomalies: BehaviorAnomaly[] = [];

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

    if (event.revisionCount > 5) {
        anomalies.push({
            type: 'EXCESSIVE_REVISION',
            severity: event.revisionCount > 10 ? 'high' : 'medium',
            score: 25,
            description: `Changed answer ${event.revisionCount} times`,
            evidence: { questionId: event.questionId, revisions: event.revisionCount, changes: event.answerChanges }
        });
    }

    if (event.hadPreSuspicionDuring) {
        anomalies.push({
            type: 'SUSPICIOUS_PATTERN',
            severity: 'high',
            score: 40,
            description: 'Answered while pre-suspicion detection active (looking away/phone usage suspected)',
            evidence: { questionId: event.questionId }
        });
    }

    if (event.averageTypingSpeed && event.averageTypingSpeed > 12) {
        anomalies.push({
            type: 'TYPING_SPEED_ANOMALY',
            severity: 'medium',
            score: 30,
            description: `Abnormal typing speed: ${event.averageTypingSpeed.toFixed(1)} chars/sec`,
            evidence: { questionId: event.questionId, speed: event.averageTypingSpeed }
        });
    }

    return anomalies;
}

function calculateRiskScore(events: AnswerEvent[], anomalies: BehaviorAnomaly[]): number {
    if (events.length === 0) return 0;

    let score = 0;

    anomalies.forEach(anomaly => {
        score += anomaly.score;
    });

    score = score / events.length;

    return Math.min(100, Math.round(score));
}
