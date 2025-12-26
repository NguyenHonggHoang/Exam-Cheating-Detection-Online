/**
 * Answer Behavior Analyzer
 * 
 * Analyzes answer patterns to detect potential cheating:
 * - Time-to-answer spikes (lookup behavior)
 * - Answer revision patterns
 * - Accuracy jumps (unusual improvement)
 * - Response consistency with question difficulty
 * 
 * Works in conjunction with temporal pattern analyzer for correlation.
 */

// ========== Types ==========

export interface AnswerEvent {
    questionId: string;
    questionIndex: number;
    difficulty: 'easy' | 'medium' | 'hard';
    correctAnswer: string;
    selectedAnswer: string;
    isCorrect: boolean;
    startedAt: number;       // When question was displayed
    submittedAt: number;     // When answer was submitted
    timeToAnswerMs: number;
    revisionCount: number;   // How many times answer was changed
    hadPreSuspicionDuring: boolean;
    answerChanges: AnswerChange[];
}

export interface AnswerChange {
    fromAnswer: string;
    toAnswer: string;
    timestamp: number;
    reason?: 'initial' | 'revision' | 'final';
}

export interface BehaviorAnomaly {
    type: 'latency_spike' | 'accuracy_jump' | 'revision_pattern' | 'difficulty_mismatch' | 'suspicious_timing';
    severity: 'low' | 'medium' | 'high';
    score: number;  // 0-100
    description: string;
    evidence: {
        questionIndex: number;
        expected: number | string;
        actual: number | string;
    };
    answerDetails?: {
        timeSpent: number;
        difficulty: string;
        isCorrect: boolean;
        revisionCount: number;
    };
}

export interface AnswerBehaviorResult {
    overallScore: number;  // 0-100 (higher = more suspicious)
    anomalies: BehaviorAnomaly[];
    statistics: AnswerStatistics;
    patterns: BehaviorPattern[];
}

export interface AnswerStatistics {
    totalQuestions: number;
    answered: number;
    correct: number;
    accuracy: number;  // 0-1
    avgTimePerDifficulty: {
        easy: number;
        medium: number;
        hard: number;
    };
    avgRevisionsPerDifficulty: {
        easy: number;
        medium: number;
        hard: number;
    };
}

export interface BehaviorPattern {
    name: string;
    detected: boolean;
    confidence: number;
    description: string;
}

// ========== Constants ==========

const BEHAVIOR_THRESHOLDS = {
    // Latency analysis
    LATENCY_SPIKE_RATIO: 2.5,    // 2.5x average = spike
    LATENCY_MIN_SAMPLES: 3,      // Need at least 3 answers per difficulty

    // Accuracy analysis
    ACCURACY_WINDOW_SIZE: 5,     // Rolling window for accuracy tracking
    ACCURACY_JUMP_THRESHOLD: 0.4, // 40% improvement in window = suspicious

    // Revision analysis
    HIGH_REVISION_COUNT: 3,      // More than 3 revisions = suspicious
    REVISION_BEFORE_CORRECT: 2,  // 2+ revisions then correct = lookup pattern

    // Difficulty mismatch
    EASY_MAX_TIME_RATIO: 0.5,    // Easy should be <50% of hard time
    HARD_MIN_TIME_RATIO: 1.5,    // Hard should be >150% of easy time

    // Time patterns
    CONSISTENT_TIME_CV: 0.15,    // Very consistent timing (CV < 0.15) = suspicious
    SUSPICION_BEFORE_CORRECT: 5000  // Pre-suspicion within 5s of correct answer = flag
};

// ========== Answer Behavior Analyzer ==========

export class AnswerBehaviorAnalyzer {
    private answers: AnswerEvent[] = [];
    private questionStartTimes: Map<string, number> = new Map();
    private currentAnswers: Map<string, string> = new Map();
    private answerChangeCounts: Map<string, number> = new Map();
    private answerChangeHistory: Map<string, AnswerChange[]> = new Map();

    /**
     * Reset analyzer for new exam
     */
    reset(): void {
        this.answers = [];
        this.questionStartTimes.clear();
        this.currentAnswers.clear();
        this.answerChangeCounts.clear();
        this.answerChangeHistory.clear();
    }

    /**
     * Record when a question is displayed
     * Only sets start time if question hasn't been tracked before
     * to preserve accurate time measurements when user navigates back
     */
    startQuestion(questionId: string): void {
        // Only set start time if not already tracking
        if (!this.questionStartTimes.has(questionId)) {
            this.questionStartTimes.set(questionId, Date.now());
            console.log(`[Behavior] Started tracking question ${questionId}`);
        } else {
            console.log(`[Behavior] Resumed tracking question ${questionId}`);
        }

        // Initialize counters if not exist
        if (!this.answerChangeCounts.has(questionId)) {
            this.answerChangeCounts.set(questionId, 0);
        }
        if (!this.answerChangeHistory.has(questionId)) {
            this.answerChangeHistory.set(questionId, []);
        }
    }

    /**
     * Record answer change (for revision tracking)
     */
    recordAnswerChange(questionId: string, newAnswer: string): void {
        const previousAnswer = this.currentAnswers.get(questionId) || '';

        if (previousAnswer !== newAnswer) {
            const count = (this.answerChangeCounts.get(questionId) || 0) + 1;
            this.answerChangeCounts.set(questionId, count);
            this.currentAnswers.set(questionId, newAnswer);

            const history = this.answerChangeHistory.get(questionId) || [];
            history.push({
                fromAnswer: previousAnswer,
                toAnswer: newAnswer,
                timestamp: Date.now(),
                reason: previousAnswer === '' ? 'initial' : 'revision'
            });
            this.answerChangeHistory.set(questionId, history);
        }
    }

    /**
     * Record final answer submission
     */
    submitAnswer(
        questionId: string,
        questionIndex: number,
        difficulty: 'easy' | 'medium' | 'hard',
        selectedAnswer: string,
        correctAnswer: string,
        hadPreSuspicionDuring: boolean = false
    ): AnswerEvent {
        const startedAt = this.questionStartTimes.get(questionId) || Date.now();
        const submittedAt = Date.now();
        const timeToAnswerMs = submittedAt - startedAt;
        const revisionCount = this.answerChangeCounts.get(questionId) || 0;
        const answerChanges = this.answerChangeHistory.get(questionId) || [];

        // Mark final answer
        if (answerChanges.length > 0) {
            answerChanges[answerChanges.length - 1].reason = 'final';
        }

        const event: AnswerEvent = {
            questionId,
            questionIndex,
            difficulty,
            correctAnswer,
            selectedAnswer,
            isCorrect: selectedAnswer === correctAnswer,
            startedAt,
            submittedAt,
            timeToAnswerMs,
            revisionCount,
            hadPreSuspicionDuring,
            answerChanges
        };

        this.answers.push(event);

        // Cleanup
        this.questionStartTimes.delete(questionId);
        this.currentAnswers.delete(questionId);
        this.answerChangeCounts.delete(questionId);
        this.answerChangeHistory.delete(questionId);

        return event;
    }

    /**
     * Analyze all recorded answers for suspicious patterns
     */
    analyze(): AnswerBehaviorResult {
        const anomalies: BehaviorAnomaly[] = [];
        const patterns: BehaviorPattern[] = [];
        let overallScore = 0;

        // Calculate statistics
        const statistics = this.calculateStatistics();

        // 1. Detect latency spikes
        const latencyAnomalies = this.detectLatencySpikes(statistics);
        anomalies.push(...latencyAnomalies);
        overallScore += latencyAnomalies.reduce((sum, a) => sum + a.score, 0) * 0.25;

        // 2. Detect accuracy jumps
        const accuracyAnomalies = this.detectAccuracyJumps();
        anomalies.push(...accuracyAnomalies);
        overallScore += accuracyAnomalies.reduce((sum, a) => sum + a.score, 0) * 0.25;

        // 3. Detect revision patterns
        const revisionAnomalies = this.detectRevisionPatterns();
        anomalies.push(...revisionAnomalies);
        overallScore += revisionAnomalies.reduce((sum, a) => sum + a.score, 0) * 0.20;

        // 4. Detect difficulty mismatches
        const difficultyAnomalies = this.detectDifficultyMismatches(statistics);
        anomalies.push(...difficultyAnomalies);
        overallScore += difficultyAnomalies.reduce((sum, a) => sum + a.score, 0) * 0.15;

        // 5. Detect suspicious timing patterns
        const timingPatterns = this.detectTimingPatterns();
        patterns.push(...timingPatterns);
        overallScore += timingPatterns.filter(p => p.detected).reduce((sum, p) => sum + p.confidence * 0.15, 0);

        return {
            overallScore: Math.min(100, Math.round(overallScore)),
            anomalies,
            statistics,
            patterns
        };
    }

    /**
     * Calculate answer statistics
     */
    private calculateStatistics(): AnswerStatistics {
        const byDifficulty = {
            easy: this.answers.filter(a => a.difficulty === 'easy'),
            medium: this.answers.filter(a => a.difficulty === 'medium'),
            hard: this.answers.filter(a => a.difficulty === 'hard')
        };

        const avgTime = (answers: AnswerEvent[]): number => {
            if (answers.length === 0) return 0;
            return answers.reduce((sum, a) => sum + a.timeToAnswerMs, 0) / answers.length;
        };

        const avgRevisions = (answers: AnswerEvent[]): number => {
            if (answers.length === 0) return 0;
            return answers.reduce((sum, a) => sum + a.revisionCount, 0) / answers.length;
        };

        const correct = this.answers.filter(a => a.isCorrect).length;

        return {
            totalQuestions: this.answers.length,
            answered: this.answers.length,
            correct,
            accuracy: this.answers.length > 0 ? correct / this.answers.length : 0,
            avgTimePerDifficulty: {
                easy: avgTime(byDifficulty.easy),
                medium: avgTime(byDifficulty.medium),
                hard: avgTime(byDifficulty.hard)
            },
            avgRevisionsPerDifficulty: {
                easy: avgRevisions(byDifficulty.easy),
                medium: avgRevisions(byDifficulty.medium),
                hard: avgRevisions(byDifficulty.hard)
            }
        };
    }

    /**
     * Detect abnormal latency spikes per difficulty
     */
    private detectLatencySpikes(stats: AnswerStatistics): BehaviorAnomaly[] {
        const anomalies: BehaviorAnomaly[] = [];

        for (const answer of this.answers) {
            const avgTime = stats.avgTimePerDifficulty[answer.difficulty];
            if (avgTime === 0) continue;

            const ratio = answer.timeToAnswerMs / avgTime;

            // Spike: much longer than average for this difficulty
            if (ratio > BEHAVIOR_THRESHOLDS.LATENCY_SPIKE_RATIO) {
                let severity: 'low' | 'medium' | 'high' = 'low';
                let score = 30;

                if (ratio > 4) {
                    severity = 'high';
                    score = 70;
                } else if (ratio > 3) {
                    severity = 'medium';
                    score = 50;
                }

                // Higher score if correct after long time (lookup behavior)
                if (answer.isCorrect && ratio > 3) {
                    score += 20;
                }

                // Higher score if pre-suspicion during answer
                if (answer.hadPreSuspicionDuring) {
                    score += 15;
                    severity = severity === 'low' ? 'medium' : 'high';
                }

                anomalies.push({
                    type: 'latency_spike',
                    severity,
                    score: Math.min(100, score),
                    description: `Q${answer.questionIndex + 1}: ${(answer.timeToAnswerMs / 1000).toFixed(1)}s (avg: ${(avgTime / 1000).toFixed(1)}s, ${ratio.toFixed(1)}x)`,
                    evidence: {
                        questionIndex: answer.questionIndex,
                        expected: avgTime,
                        actual: answer.timeToAnswerMs
                    },
                    answerDetails: {
                        timeSpent: answer.timeToAnswerMs,
                        difficulty: answer.difficulty,
                        isCorrect: answer.isCorrect,
                        revisionCount: answer.revisionCount
                    }
                });
            }
        }

        return anomalies;
    }

    /**
     * Detect sudden accuracy improvements
     */
    private detectAccuracyJumps(): BehaviorAnomaly[] {
        const anomalies: BehaviorAnomaly[] = [];
        const windowSize = BEHAVIOR_THRESHOLDS.ACCURACY_WINDOW_SIZE;

        if (this.answers.length < windowSize * 2) {
            return anomalies;
        }

        for (let i = windowSize; i <= this.answers.length - windowSize; i++) {
            const beforeWindow = this.answers.slice(i - windowSize, i);
            const afterWindow = this.answers.slice(i, i + windowSize);

            const beforeAccuracy = beforeWindow.filter(a => a.isCorrect).length / windowSize;
            const afterAccuracy = afterWindow.filter(a => a.isCorrect).length / windowSize;
            const jump = afterAccuracy - beforeAccuracy;

            if (jump >= BEHAVIOR_THRESHOLDS.ACCURACY_JUMP_THRESHOLD) {
                // Check if pre-suspicion occurred around the jump point
                const aroundJump = this.answers.slice(i - 1, i + 1);
                const hadSuspicion = aroundJump.some(a => a.hadPreSuspicionDuring);

                let score = jump * 100;
                let severity: 'low' | 'medium' | 'high' = 'medium';

                if (hadSuspicion) {
                    score += 25;
                    severity = 'high';
                }

                if (jump >= 0.6) {
                    severity = 'high';
                    score = Math.min(100, score + 20);
                }

                anomalies.push({
                    type: 'accuracy_jump',
                    severity,
                    score: Math.min(100, Math.round(score)),
                    description: `Accuracy jump từ ${(beforeAccuracy * 100).toFixed(0)}% → ${(afterAccuracy * 100).toFixed(0)}% tại Q${i + 1}`,
                    evidence: {
                        questionIndex: i,
                        expected: beforeAccuracy,
                        actual: afterAccuracy
                    }
                });
            }
        }

        return anomalies;
    }

    /**
     * Detect suspicious revision patterns
     */
    private detectRevisionPatterns(): BehaviorAnomaly[] {
        const anomalies: BehaviorAnomaly[] = [];

        for (const answer of this.answers) {
            // Pattern: Many revisions then correct (lookup behavior)
            if (answer.revisionCount >= BEHAVIOR_THRESHOLDS.REVISION_BEFORE_CORRECT && answer.isCorrect) {
                let severity: 'low' | 'medium' | 'high' = 'medium';
                let score = 40 + (answer.revisionCount * 10);

                if (answer.hadPreSuspicionDuring) {
                    score += 20;
                    severity = 'high';
                }

                if (answer.revisionCount >= BEHAVIOR_THRESHOLDS.HIGH_REVISION_COUNT) {
                    severity = 'high';
                    score += 15;
                }

                anomalies.push({
                    type: 'revision_pattern',
                    severity,
                    score: Math.min(100, score),
                    description: `Q${answer.questionIndex + 1}: ${answer.revisionCount} lần sửa → đúng`,
                    evidence: {
                        questionIndex: answer.questionIndex,
                        expected: 1,
                        actual: answer.revisionCount
                    },
                    answerDetails: {
                        timeSpent: answer.timeToAnswerMs,
                        difficulty: answer.difficulty,
                        isCorrect: answer.isCorrect,
                        revisionCount: answer.revisionCount
                    }
                });
            }
        }

        return anomalies;
    }

    /**
     * Detect difficulty-time mismatches
     */
    private detectDifficultyMismatches(stats: AnswerStatistics): BehaviorAnomaly[] {
        const anomalies: BehaviorAnomaly[] = [];

        // Easy questions should be faster than hard questions
        if (stats.avgTimePerDifficulty.easy > 0 && stats.avgTimePerDifficulty.hard > 0) {
            const ratio = stats.avgTimePerDifficulty.hard / stats.avgTimePerDifficulty.easy;

            // If hard questions aren't taking longer than easy ones = suspicious
            if (ratio < 1.2) {
                anomalies.push({
                    type: 'difficulty_mismatch',
                    severity: 'medium',
                    score: 50,
                    description: `Câu khó không mất nhiều thời gian hơn câu dễ (ratio: ${ratio.toFixed(2)})`,
                    evidence: {
                        questionIndex: -1,
                        expected: 1.5,
                        actual: ratio
                    }
                });
            }
        }

        // Individual easy questions taking too long
        for (const answer of this.answers) {
            if (answer.difficulty === 'easy' && stats.avgTimePerDifficulty.hard > 0) {
                if (answer.timeToAnswerMs > stats.avgTimePerDifficulty.hard) {
                    anomalies.push({
                        type: 'difficulty_mismatch',
                        severity: 'low',
                        score: 30,
                        description: `Q${answer.questionIndex + 1} (dễ) mất ${(answer.timeToAnswerMs / 1000).toFixed(1)}s > avg câu khó`,
                        evidence: {
                            questionIndex: answer.questionIndex,
                            expected: stats.avgTimePerDifficulty.easy,
                            actual: answer.timeToAnswerMs
                        },
                        answerDetails: {
                            timeSpent: answer.timeToAnswerMs,
                            difficulty: answer.difficulty,
                            isCorrect: answer.isCorrect,
                            revisionCount: answer.revisionCount
                        }
                    });
                }
            }
        }

        return anomalies;
    }

    /**
     * Detect suspicious timing patterns
     */
    private detectTimingPatterns(): BehaviorPattern[] {
        const patterns: BehaviorPattern[] = [];
        const times = this.answers.map(a => a.timeToAnswerMs);

        if (times.length < 5) {
            return patterns;
        }

        // Check for too-consistent timing (robotic behavior)
        const mean = times.reduce((a, b) => a + b, 0) / times.length;
        const variance = times.reduce((sum, t) => sum + Math.pow(t - mean, 2), 0) / times.length;
        const cv = Math.sqrt(variance) / mean;  // Coefficient of variation

        patterns.push({
            name: 'consistent_timing',
            detected: cv < BEHAVIOR_THRESHOLDS.CONSISTENT_TIME_CV,
            confidence: cv < BEHAVIOR_THRESHOLDS.CONSISTENT_TIME_CV ? (1 - cv / BEHAVIOR_THRESHOLDS.CONSISTENT_TIME_CV) * 100 : 0,
            description: cv < BEHAVIOR_THRESHOLDS.CONSISTENT_TIME_CV
                ? `Thời gian trả lời quá đều đặn (CV=${cv.toFixed(3)})`
                : 'Thời gian trả lời bình thường'
        });

        // Check for pre-suspicion → correct pattern
        const suspicionCorrectCount = this.answers.filter(a =>
            a.hadPreSuspicionDuring && a.isCorrect
        ).length;
        const suspicionRatio = suspicionCorrectCount / this.answers.filter(a => a.hadPreSuspicionDuring).length || 0;

        patterns.push({
            name: 'suspicion_correct_correlation',
            detected: suspicionRatio > 0.7 && suspicionCorrectCount >= 3,
            confidence: suspicionRatio > 0.7 ? suspicionRatio * 100 : 0,
            description: suspicionRatio > 0.7 && suspicionCorrectCount >= 3
                ? `${suspicionCorrectCount} câu có nghi vấn → đúng (${(suspicionRatio * 100).toFixed(0)}%)`
                : 'Không có correlation nghi vấn-đúng'
        });

        return patterns;
    }

    // ========== Export/Import ==========

    toJSON(): string {
        return JSON.stringify({
            answers: this.answers
        });
    }

    fromJSON(json: string): void {
        const data = JSON.parse(json);
        this.answers = data.answers || [];
    }

    getAnswers(): AnswerEvent[] {
        return [...this.answers];
    }
}

// ========== Singleton Instance ==========

export const answerBehaviorAnalyzer = new AnswerBehaviorAnalyzer();
