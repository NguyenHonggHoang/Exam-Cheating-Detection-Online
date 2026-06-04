/**
 * Temporal Pattern Analyzer
 * 
 * Tracks behavior patterns over time to detect suspicious behavior:
 * - Repeated head-down events (multiple phone checks)
 * - Micro-pauses at regular intervals (reading from phone)
 * - Answer latency anomalies (lookup behavior)
 * 
 * Single event ≠ cheating, but patterns over time = suspicious
 */

// ========== Types ==========

export interface TemporalEvent {
    type: 'head_down' | 'head_side' | 'micro_pause' | 'answer_submit' | 'pre_suspicion' | 'blur' | 'focus' | 'window_resize' | 'tab_switch' | 'typing_speed';
    timestamp: number;
    duration?: number;  // For events with duration (ms)
    metadata?: {
        confidence?: number;
        questionId?: string;
        questionDifficulty?: 'easy' | 'medium' | 'hard';
        timeToAnswer?: number;  // ms
    };
}

export interface PatternScore {
    pattern: string;
    score: number;  // 0-100
    count: number;
    avgInterval?: number;  // ms between events
    isAnomalous: boolean;
    description: string;
}

export interface TemporalAnalysisResult {
    overallRiskScore: number;  // 0-100
    patterns: PatternScore[];
    timeline: TemporalEvent[];
    redFlags: string[];
    sessionDurationMs: number;
}

export interface AnswerLog {
    questionId: string;
    questionIndex: number;
    difficulty: 'easy' | 'medium' | 'hard';
    submittedAt: number;
    timeToAnswerMs: number;
    revisionCount: number;
    hadPreSuspicionDuring: boolean;
}

// ========== Constants ==========

const PATTERN_THRESHOLDS = {
    // Repeated head-down
    HEAD_DOWN_MIN_COUNT: 3,           // Minimum events to consider pattern
    HEAD_DOWN_TIME_WINDOW: 300000,    // 5 minutes
    HEAD_DOWN_REGULARITY_THRESHOLD: 0.3, // Coefficient of variation < 0.3 = regular

    // Micro-pauses
    MICRO_PAUSE_DURATION_MIN: 500,    // 0.5s
    MICRO_PAUSE_DURATION_MAX: 3000,   // 3s
    MICRO_PAUSE_INTERVAL_REGULARITY: 0.4,

    // Answer latency
    ANSWER_LATENCY_SPIKE_RATIO: 2.0,  // 2x average = spike
    ANSWER_LATENCY_MIN_SAMPLES: 3,    // Need at least 3 answers to compare

    // Overall scoring
    PATTERN_WEIGHT_HEAD_DOWN: 25,
    PATTERN_WEIGHT_MICRO_PAUSE: 20,
    PATTERN_WEIGHT_ANSWER_LATENCY: 30,
    PATTERN_WEIGHT_PRE_SUSPICION_CORRELATION: 25,

    // Blur frequency (split screen detection)
    BLUR_FREQUENCY_WINDOW: 30000,     // 30 seconds
    BLUR_FREQUENCY_MIN_COUNT: 5,      // 5+ blurs = suspicious
    PATTERN_WEIGHT_BLUR_FREQUENCY: 20
};

// ========== Temporal Pattern Analyzer ==========

export class TemporalPatternAnalyzer {
    private events: TemporalEvent[] = [];
    private answerLogs: AnswerLog[] = [];
    private sessionStartTime: number = 0;
    private questionBaselines: Map<string, number[]> = new Map();  // Difficulty -> times

    constructor() {
        this.sessionStartTime = Date.now();
    }

    /**
     * Reset analyzer for new session
     */
    reset(): void {
        this.events = [];
        this.answerLogs = [];
        this.sessionStartTime = Date.now();
        this.questionBaselines.clear();
    }

    /**
     * Record a temporal event
     */
    recordEvent(event: Omit<TemporalEvent, 'timestamp'>): void {
        this.events.push({
            ...event,
            timestamp: Date.now()
        });

        // Keep last 30 minutes of events
        const cutoff = Date.now() - 30 * 60 * 1000;
        this.events = this.events.filter(e => e.timestamp > cutoff);
    }

    /**
     * Record head-down event (from pre-suspicion detection)
     */
    recordHeadDown(duration: number, confidence: number): void {
        this.recordEvent({
            type: 'head_down',
            duration,
            metadata: { confidence }
        });
    }

    /**
     * Record micro-pause (detected from motion analysis)
     */
    recordMicroPause(duration: number): void {
        if (duration >= PATTERN_THRESHOLDS.MICRO_PAUSE_DURATION_MIN &&
            duration <= PATTERN_THRESHOLDS.MICRO_PAUSE_DURATION_MAX) {
            this.recordEvent({
                type: 'micro_pause',
                duration
            });
        }
    }

    /**
     * Record answer submission
     */
    recordAnswer(
        questionId: string,
        questionIndex: number,
        difficulty: 'easy' | 'medium' | 'hard',
        timeToAnswerMs: number,
        revisionCount: number = 0
    ): void {
        // Check if there was pre-suspicion during this answer
        const answerTime = Date.now();
        const questionStartTime = answerTime - timeToAnswerMs;

        const hadPreSuspicion = this.events.some(e =>
            e.type === 'pre_suspicion' &&
            e.timestamp >= questionStartTime &&
            e.timestamp <= answerTime
        );

        const log: AnswerLog = {
            questionId,
            questionIndex,
            difficulty,
            submittedAt: answerTime,
            timeToAnswerMs,
            revisionCount,
            hadPreSuspicionDuring: hadPreSuspicion
        };

        this.answerLogs.push(log);

        // Update baseline for this difficulty
        if (!this.questionBaselines.has(difficulty)) {
            this.questionBaselines.set(difficulty, []);
        }
        this.questionBaselines.get(difficulty)!.push(timeToAnswerMs);

        // Record as event
        this.recordEvent({
            type: 'answer_submit',
            metadata: {
                questionId,
                questionDifficulty: difficulty,
                timeToAnswer: timeToAnswerMs
            }
        });
    }

    /**
     * Record pre-suspicion trigger
     */
    recordPreSuspicion(confidence: number): void {
        this.recordEvent({
            type: 'pre_suspicion',
            metadata: { confidence }
        });
    }

    /**
     * Record typing speed sample
     */
    recordTypingSpeed(charsPerSec: number): void {
        this.recordEvent({
            type: 'typing_speed',
            timestamp: Date.now(), // This will be overwritten by recordEvent but needed for type check
            metadata: { confidence: charsPerSec } // Store speed in confidence field
        } as any);
    }

    /**
     * Record window blur event (user switched away)
     */
    recordBlur(): void {
        this.recordEvent({ type: 'blur' });
        console.log('[Temporal] Recorded blur event');
    }

    /**
     * Record window focus event (user returned)
     */
    recordFocus(): void {
        this.recordEvent({ type: 'focus' });
        console.log('[Temporal] Recorded focus event');
    }

    /**
     * Record window resize event
     */
    recordWindowResize(widthRatio: number, heightRatio: number): void {
        this.recordEvent({
            type: 'window_resize',
            metadata: {
                widthRatio,
                heightRatio
            } as any
        });
        console.log(`[Temporal] Recorded window resize: ${Math.round(widthRatio * 100)}%x${Math.round(heightRatio * 100)}%`);
    }

    /**
     * Record tab switch event
     */
    recordTabSwitch(): void {
        this.recordEvent({ type: 'tab_switch' });
        console.log('[Temporal] Recorded tab switch');
    }

    /**
     * Analyze patterns and return risk assessment
     */
    analyze(): TemporalAnalysisResult {
        const patterns: PatternScore[] = [];
        const redFlags: string[] = [];
        let overallScore = 0;

        // 1. Analyze repeated head-down pattern
        const headDownPattern = this.analyzeRepeatedHeadDown();
        if (headDownPattern) {
            patterns.push(headDownPattern);
            if (headDownPattern.isAnomalous) {
                redFlags.push(headDownPattern.description);
                overallScore += headDownPattern.score * (PATTERN_THRESHOLDS.PATTERN_WEIGHT_HEAD_DOWN / 100);
            }
        }

        // 2. Analyze micro-pause regularity
        const microPausePattern = this.analyzeMicroPauses();
        if (microPausePattern) {
            patterns.push(microPausePattern);
            if (microPausePattern.isAnomalous) {
                redFlags.push(microPausePattern.description);
                overallScore += microPausePattern.score * (PATTERN_THRESHOLDS.PATTERN_WEIGHT_MICRO_PAUSE / 100);
            }
        }

        // 3. Analyze answer latency anomalies
        const answerPattern = this.analyzeAnswerLatency();
        if (answerPattern) {
            patterns.push(answerPattern);
            if (answerPattern.isAnomalous) {
                redFlags.push(answerPattern.description);
                overallScore += answerPattern.score * (PATTERN_THRESHOLDS.PATTERN_WEIGHT_ANSWER_LATENCY / 100);
            }
        }

        // 4. Analyze pre-suspicion + answer correlation
        const correlationPattern = this.analyzePreSuspicionAnswerCorrelation();
        if (correlationPattern) {
            patterns.push(correlationPattern);
            if (correlationPattern.isAnomalous) {
                redFlags.push(correlationPattern.description);
                overallScore += correlationPattern.score * (PATTERN_THRESHOLDS.PATTERN_WEIGHT_PRE_SUSPICION_CORRELATION / 100);
            }
        }

        // 5. Analyze Typing Speed (Impossible Speed)
        const typingPattern = this.analyzeTypingSpeed();
        if (typingPattern) {
            patterns.push(typingPattern);
            if (typingPattern.isAnomalous) {
                redFlags.push(typingPattern.description);
                overallScore += typingPattern.score * 0.3; // 30% weight
            }
        }

        // 6. Analyze Answer Burst
        const burstPattern = this.analyzeAnswerBurst();
        if (burstPattern) {
            patterns.push(burstPattern);
            if (burstPattern.isAnomalous) {
                redFlags.push(burstPattern.description);
                overallScore += burstPattern.score * 0.2; // 20% weight
            }
        }

        // 7. Analyze Blur Frequency (split screen detection)
        const blurPattern = this.analyzeBlurFrequency();
        if (blurPattern) {
            patterns.push(blurPattern);
            if (blurPattern.isAnomalous) {
                redFlags.push(blurPattern.description);
                overallScore += blurPattern.score * (PATTERN_THRESHOLDS.PATTERN_WEIGHT_BLUR_FREQUENCY / 100);
            }
        }

        return {
            overallRiskScore: Math.min(100, Math.round(overallScore)),
            patterns,
            timeline: [...this.events].slice(-50),  // Last 50 events
            redFlags,
            sessionDurationMs: Date.now() - this.sessionStartTime
        };
    }

    private analyzeTypingSpeed(): PatternScore | null {
        const typingEvents = this.events.filter(e => e.type === 'typing_speed' as any);
        if (typingEvents.length === 0) return null;

        // Check for speeds > 15 chars/sec
        const highSpeedEvents = typingEvents.filter(e => (e.metadata?.confidence || 0) > 15);

        if (highSpeedEvents.length === 0) return null;

        const maxSpeed = Math.max(...highSpeedEvents.map(e => e.metadata?.confidence || 0));

        return {
            pattern: 'impossible_typing_speed',
            score: 100,
            count: highSpeedEvents.length,
            isAnomalous: true,
            description: `Phát hiện tốc độ gõ bất thường (${maxSpeed.toFixed(1)} ký tự/giây)`
        };
    }

    private analyzeAnswerBurst(): PatternScore | null {
        if (this.answerLogs.length < 3) return null;

        // Check for 3 answers within 10 seconds
        let burstCount = 0;
        const sortedLogs = [...this.answerLogs].sort((a, b) => a.submittedAt - b.submittedAt);

        for (let i = 2; i < sortedLogs.length; i++) {
            const timeDiff = sortedLogs[i].submittedAt - sortedLogs[i - 2].submittedAt;
            if (timeDiff < 10000) { // 10 seconds
                burstCount++;
            }
        }

        if (burstCount === 0) return null;

        return {
            pattern: 'answer_burst',
            score: Math.min(100, burstCount * 30),
            count: burstCount,
            isAnomalous: true,
            description: `Phát hiện trả lời liên tiếp ${burstCount} lần trong thời gian ngắn`
        };
    }

    /**
     * Analyze blur/focus frequency for split-screen detection
     * High frequency blur/focus events suggest user is switching between windows frequently
     */
    private analyzeBlurFrequency(): PatternScore | null {
        const windowStart = Date.now() - PATTERN_THRESHOLDS.BLUR_FREQUENCY_WINDOW;
        const recentBlurs = this.events.filter(e =>
            e.type === 'blur' && e.timestamp > windowStart
        );

        if (recentBlurs.length < PATTERN_THRESHOLDS.BLUR_FREQUENCY_MIN_COUNT) {
            return null;
        }

        // Calculate average interval between blurs
        const intervals: number[] = [];
        for (let i = 1; i < recentBlurs.length; i++) {
            intervals.push(recentBlurs[i].timestamp - recentBlurs[i - 1].timestamp);
        }

        const avgInterval = intervals.length > 0
            ? intervals.reduce((a, b) => a + b, 0) / intervals.length
            : 0;

        // Score based on blur count and frequency
        const score = Math.min(100, recentBlurs.length * 15);

        console.log(`[Temporal] Blur frequency: ${recentBlurs.length} blurs in ${PATTERN_THRESHOLDS.BLUR_FREQUENCY_WINDOW / 1000}s, avg interval: ${Math.round(avgInterval)}ms`);

        return {
            pattern: 'frequent_blur',
            score,
            count: recentBlurs.length,
            avgInterval,
            isAnomalous: true,
            description: `Phát hiện ${recentBlurs.length} lần blur trong 30 giây - có thể đang sử dụng split screen`
        };
    }


    /**
     * Analyze repeated head-down events
     */
    private analyzeRepeatedHeadDown(): PatternScore | null {
        const headDownEvents = this.events.filter(e => e.type === 'head_down');

        if (headDownEvents.length < PATTERN_THRESHOLDS.HEAD_DOWN_MIN_COUNT) {
            return null;
        }

        // Get events in time window
        const windowStart = Date.now() - PATTERN_THRESHOLDS.HEAD_DOWN_TIME_WINDOW;
        const recentEvents = headDownEvents.filter(e => e.timestamp > windowStart);

        if (recentEvents.length < PATTERN_THRESHOLDS.HEAD_DOWN_MIN_COUNT) {
            return null;
        }

        // Calculate intervals between events
        const intervals: number[] = [];
        for (let i = 1; i < recentEvents.length; i++) {
            intervals.push(recentEvents[i].timestamp - recentEvents[i - 1].timestamp);
        }

        // Calculate statistics
        const avgInterval = this.mean(intervals);
        const stdInterval = this.stdDev(intervals);
        const coefficientOfVariation = stdInterval / avgInterval;

        // Check if pattern is regular (low CV = regular intervals)
        const isRegular = coefficientOfVariation < PATTERN_THRESHOLDS.HEAD_DOWN_REGULARITY_THRESHOLD;

        // Score based on count and regularity
        let score = 0;
        score += Math.min(40, recentEvents.length * 8);  // Up to 40 from count
        if (isRegular) {
            score += 30;  // Regular pattern is more suspicious
        }
        score += Math.min(30, (1 - coefficientOfVariation) * 30);  // Low variation = higher score

        return {
            pattern: 'repeated_head_down',
            score: Math.min(100, Math.round(score)),
            count: recentEvents.length,
            avgInterval,
            isAnomalous: score >= 50,
            description: `${recentEvents.length} lần nhìn xuống trong 5 phút (CV=${coefficientOfVariation.toFixed(2)})`
        };
    }

    /**
     * Analyze micro-pause regularity
     */
    private analyzeMicroPauses(): PatternScore | null {
        const pauseEvents = this.events.filter(e => e.type === 'micro_pause');

        if (pauseEvents.length < 5) {
            return null;
        }

        // Get events in last 10 minutes
        const windowStart = Date.now() - 10 * 60 * 1000;
        const recentPauses = pauseEvents.filter(e => e.timestamp > windowStart);

        if (recentPauses.length < 5) {
            return null;
        }

        // Calculate intervals
        const intervals: number[] = [];
        for (let i = 1; i < recentPauses.length; i++) {
            intervals.push(recentPauses[i].timestamp - recentPauses[i - 1].timestamp);
        }

        const avgInterval = this.mean(intervals);
        const coefficientOfVariation = this.stdDev(intervals) / avgInterval;

        // Regular pauses (like reading from phone at intervals) are suspicious
        const isRegular = coefficientOfVariation < PATTERN_THRESHOLDS.MICRO_PAUSE_INTERVAL_REGULARITY;

        let score = 0;
        if (isRegular) {
            score = 60 + (1 - coefficientOfVariation) * 40;
        } else {
            score = 20;  // Some pauses are normal
        }

        return {
            pattern: 'regular_micro_pauses',
            score: Math.min(100, Math.round(score)),
            count: recentPauses.length,
            avgInterval,
            isAnomalous: isRegular,
            description: isRegular
                ? `Micro-pauses đều đặn mỗi ${Math.round(avgInterval / 1000)}s`
                : `${recentPauses.length} micro-pauses (không đều)`
        };
    }

    /**
     * Analyze answer latency anomalies
     */
    private analyzeAnswerLatency(): PatternScore | null {
        if (this.answerLogs.length < PATTERN_THRESHOLDS.ANSWER_LATENCY_MIN_SAMPLES) {
            return null;
        }

        // Group by difficulty
        const byDifficulty: Record<string, AnswerLog[]> = {
            easy: [],
            medium: [],
            hard: []
        };

        this.answerLogs.forEach(log => {
            byDifficulty[log.difficulty].push(log);
        });

        // Find latency spikes per difficulty
        let spikeCount = 0;
        let totalQuestions = 0;
        const spikes: string[] = [];

        for (const [difficulty, logs] of Object.entries(byDifficulty)) {
            if (logs.length < 2) continue;

            const times = logs.map(l => l.timeToAnswerMs);
            const avgTime = this.mean(times);

            logs.forEach((log, i) => {
                if (log.timeToAnswerMs > avgTime * PATTERN_THRESHOLDS.ANSWER_LATENCY_SPIKE_RATIO) {
                    spikeCount++;
                    spikes.push(`Q${log.questionIndex + 1} (${difficulty}): ${(log.timeToAnswerMs / 1000).toFixed(1)}s vs avg ${(avgTime / 1000).toFixed(1)}s`);
                }
                totalQuestions++;
            });
        }

        if (totalQuestions === 0) return null;

        const spikeRatio = spikeCount / totalQuestions;
        const score = Math.min(100, spikeRatio * 200);  // 50% spikes = 100 score

        return {
            pattern: 'answer_latency_spikes',
            score: Math.round(score),
            count: spikeCount,
            isAnomalous: spikeRatio > 0.2,  // More than 20% spikes
            description: spikeCount > 0
                ? `${spikeCount}/${totalQuestions} câu có thời gian trả lời bất thường`
                : 'Thời gian trả lời bình thường'
        };
    }

    /**
     * Analyze correlation between pre-suspicion and answer behavior
     */
    private analyzePreSuspicionAnswerCorrelation(): PatternScore | null {
        const answersWithPreSuspicion = this.answerLogs.filter(l => l.hadPreSuspicionDuring);

        if (this.answerLogs.length < 3 || answersWithPreSuspicion.length === 0) {
            return null;
        }

        const correlationRatio = answersWithPreSuspicion.length / this.answerLogs.length;

        // High correlation = many answers had pre-suspicion during them
        const score = Math.min(100, correlationRatio * 150);

        return {
            pattern: 'pre_suspicion_answer_correlation',
            score: Math.round(score),
            count: answersWithPreSuspicion.length,
            isAnomalous: correlationRatio > 0.3,  // More than 30% correlation
            description: `${answersWithPreSuspicion.length}/${this.answerLogs.length} câu trả lời có nghi vấn trong lúc làm`
        };
    }

    // ========== Utility Functions ==========

    private mean(values: number[]): number {
        if (values.length === 0) return 0;
        return values.reduce((a, b) => a + b, 0) / values.length;
    }

    private stdDev(values: number[]): number {
        if (values.length < 2) return 0;
        const avg = this.mean(values);
        const squareDiffs = values.map(v => Math.pow(v - avg, 2));
        return Math.sqrt(this.mean(squareDiffs));
    }

    /**
     * Get average typing speed from recorded events
     */
    getAverageTypingSpeed(): number | undefined {
        const typingSpeeds = this.events
            .filter(e => e.type === 'typing_speed' && e.metadata?.confidence)
            .map(e => e.metadata!.confidence!);

        if (typingSpeeds.length === 0) return undefined;
        return this.mean(typingSpeeds);
    }

    // ========== Export/Import ==========

    toJSON(): string {
        return JSON.stringify({
            events: this.events,
            answerLogs: this.answerLogs,
            sessionStartTime: this.sessionStartTime
        });
    }

    fromJSON(json: string): void {
        const data = JSON.parse(json);
        this.events = data.events || [];
        this.answerLogs = data.answerLogs || [];
        this.sessionStartTime = data.sessionStartTime || Date.now();
    }
}

// ========== Singleton Instance ==========

export const temporalPatternAnalyzer = new TemporalPatternAnalyzer();
