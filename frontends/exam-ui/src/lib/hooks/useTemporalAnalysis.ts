/**
 * Temporal Analysis Hook
 * 
 * React hook for integrating temporal pattern analysis with exam flow.
 * Tracks events over the session and provides real-time risk assessment.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import {
    TemporalPatternAnalyzer,
    TemporalAnalysisResult,
    AnswerLog
} from '../utils/temporalPatternAnalyzer';

// ========== Types ==========

export interface UseTemporalAnalysisOptions {
    sessionId: string;
    enabled?: boolean;
    analysisInterval?: number;  // How often to run analysis (ms)
    onRiskScoreChange?: (score: number, redFlags: string[]) => void;
}

export interface TemporalAnalysisState {
    riskScore: number;
    redFlags: string[];
    lastAnalysis: TemporalAnalysisResult | null;
    eventCount: number;
    answerCount: number;
}

// ========== Hook ==========

export function useTemporalAnalysis(options: UseTemporalAnalysisOptions) {
    const {
        sessionId,
        enabled = true,
        analysisInterval = 30000,  // Analyze every 30s by default
        onRiskScoreChange
    } = options;

    // Refs
    const analyzerRef = useRef<TemporalPatternAnalyzer | null>(null);
    const lastRiskScoreRef = useRef<number>(0);

    // State
    const [state, setState] = useState<TemporalAnalysisState>({
        riskScore: 0,
        redFlags: [],
        lastAnalysis: null,
        eventCount: 0,
        answerCount: 0
    });

    // Initialize analyzer
    useEffect(() => {
        analyzerRef.current = new TemporalPatternAnalyzer();

        // Try to restore from sessionStorage
        const saved = sessionStorage.getItem(`temporal_analysis_${sessionId}`);
        if (saved) {
            try {
                analyzerRef.current.fromJSON(saved);
                console.log('[TemporalAnalysis] Restored from session');
            } catch (e) {
                console.warn('[TemporalAnalysis] Failed to restore:', e);
            }
        }

        return () => {
            // Save to sessionStorage on unmount
            if (analyzerRef.current) {
                sessionStorage.setItem(
                    `temporal_analysis_${sessionId}`,
                    analyzerRef.current.toJSON()
                );
            }
        };
    }, [sessionId]);

    // Periodic analysis
    useEffect(() => {
        if (!enabled) return;

        const interval = setInterval(() => {
            runAnalysis();
        }, analysisInterval);

        return () => clearInterval(interval);
    }, [enabled, analysisInterval]);

    /**
     * Run analysis and update state
     */
    const runAnalysis = useCallback(() => {
        if (!analyzerRef.current) return null;

        const result = analyzerRef.current.analyze();

        setState(s => ({
            ...s,
            riskScore: result.overallRiskScore,
            redFlags: result.redFlags,
            lastAnalysis: result
        }));

        // Notify if risk score changed significantly
        if (Math.abs(result.overallRiskScore - lastRiskScoreRef.current) >= 10) {
            lastRiskScoreRef.current = result.overallRiskScore;
            onRiskScoreChange?.(result.overallRiskScore, result.redFlags);
        }

        return result;
    }, [onRiskScoreChange]);

    /**
     * Record head-down event from pre-suspicion detection
     */
    const recordHeadDown = useCallback((duration: number, confidence: number) => {
        if (!enabled || !analyzerRef.current) return;

        analyzerRef.current.recordHeadDown(duration, confidence);
        setState(s => ({ ...s, eventCount: s.eventCount + 1 }));
    }, [enabled]);

    /**
     * Record micro-pause
     */
    const recordMicroPause = useCallback((duration: number) => {
        if (!enabled || !analyzerRef.current) return;

        analyzerRef.current.recordMicroPause(duration);
        setState(s => ({ ...s, eventCount: s.eventCount + 1 }));
    }, [enabled]);

    /**
     * Record answer submission
     */
    const recordAnswer = useCallback((
        questionId: string,
        questionIndex: number,
        difficulty: 'easy' | 'medium' | 'hard',
        timeToAnswerMs: number,
        revisionCount: number = 0
    ) => {
        if (!enabled || !analyzerRef.current) return;

        analyzerRef.current.recordAnswer(
            questionId,
            questionIndex,
            difficulty,
            timeToAnswerMs,
            revisionCount
        );

        setState(s => ({
            ...s,
            eventCount: s.eventCount + 1,
            answerCount: s.answerCount + 1
        }));

        // Run analysis after each answer
        runAnalysis();
    }, [enabled, runAnalysis]);

    /**
     * Record pre-suspicion trigger
     */
    const recordPreSuspicion = useCallback((confidence: number) => {
        if (!enabled || !analyzerRef.current) return;

        analyzerRef.current.recordPreSuspicion(confidence);
        setState(s => ({ ...s, eventCount: s.eventCount + 1 }));
    }, [enabled]);

    /**
     * Reset analyzer
     */
    const reset = useCallback(() => {
        analyzerRef.current?.reset();
        setState({
            riskScore: 0,
            redFlags: [],
            lastAnalysis: null,
            eventCount: 0,
            answerCount: 0
        });
        sessionStorage.removeItem(`temporal_analysis_${sessionId}`);
    }, [sessionId]);

    /**
     * Get current analysis result
     */
    const getAnalysis = useCallback((): TemporalAnalysisResult | null => {
        return analyzerRef.current?.analyze() ?? null;
    }, []);

    /**
     * Record typing speed
     */
    const recordTypingSpeed = useCallback((charsPerSec: number) => {
        if (!enabled || !analyzerRef.current) return;

        analyzerRef.current.recordTypingSpeed(charsPerSec);
        setState(s => ({ ...s, eventCount: s.eventCount + 1 }));
    }, [enabled]);

    /**
     * Record blur event
     */
    const recordBlur = useCallback(() => {
        if (!enabled || !analyzerRef.current) return;

        analyzerRef.current.recordBlur();
        setState(s => ({ ...s, eventCount: s.eventCount + 1 }));
    }, [enabled]);

    /**
     * Record focus event
     */
    const recordFocus = useCallback(() => {
        if (!enabled || !analyzerRef.current) return;

        analyzerRef.current.recordFocus();
        setState(s => ({ ...s, eventCount: s.eventCount + 1 }));
    }, [enabled]);

    /**
     * Record tab switch event
     */
    const recordTabSwitch = useCallback(() => {
        if (!enabled || !analyzerRef.current) return;

        analyzerRef.current.recordTabSwitch();
        setState(s => ({ ...s, eventCount: s.eventCount + 1 }));
    }, [enabled]);

    /**
     * Record window resize event
     */
    const recordWindowResize = useCallback((widthRatio: number, heightRatio: number) => {
        if (!enabled || !analyzerRef.current) return;

        analyzerRef.current.recordWindowResize(widthRatio, heightRatio);
        setState(s => ({ ...s, eventCount: s.eventCount + 1 }));
    }, [enabled]);

    /**
     * Get average typing speed
     */
    const getAverageTypingSpeed = useCallback((): number | undefined => {
        if (!analyzerRef.current) return undefined;
        return analyzerRef.current.getAverageTypingSpeed();
    }, []);

    return {
        // State
        ...state,

        // Actions
        recordHeadDown,
        recordMicroPause,
        recordAnswer,
        recordPreSuspicion,
        recordTypingSpeed,
        recordBlur,
        recordFocus,
        recordTabSwitch,
        recordWindowResize,
        runAnalysis,
        reset,
        getAnalysis,
        getAverageTypingSpeed
    };
}

export default useTemporalAnalysis;
