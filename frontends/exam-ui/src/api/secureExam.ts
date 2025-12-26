/**
 * Secure Exam API
 * 
 * Anti-screenshot protected exam with:
 * - One question at a time
 * - No backtracking
 * - Server-side time validation
 */

import { axiosInstance } from './client';

// ========== Types ==========

export interface ExamMetadata {
    sessionId: string;
    examId: string;
    examName: string;
    totalQuestions: number;
    totalDurationMinutes: number;
    allowBacktracking: boolean;
    idleTimeoutSeconds: number;
}

export interface SecureQuestion {
    questionIndex: number;
    totalQuestions: number;
    text: string;
    type: 'MULTIPLE_CHOICE' | 'TEXT' | 'TRUE_FALSE';
    options: string[] | null;
    timeLimitSeconds: number;
    startedAtEpochMs: number;
    remainingSeconds: number;
    difficulty: string;
}

export interface SubmitAnswerResponse {
    accepted: boolean;
    isLastQuestion: boolean;
    examComplete: boolean;
    nextQuestion: SecureQuestion | null;
    questionsAnswered: number;
    totalQuestions: number;
    finalScore: number | null;
    message: string;
}

export interface HeartbeatResponse {
    ok: boolean;
    isLocked: boolean;
    lockReason: string | null;
    currentQuestionIndex: number;
    remainingTimeSeconds: number;
}

export interface SessionStatus {
    sessionId: string;
    currentQuestionIndex: number;
    totalQuestions: number;
    questionsAnswered: number;
    isLocked: boolean;
    lockReason: string | null;
    isCompleted: boolean;
    finalScore: number | null;
    lastActivityEpochMs: number;
}

// ========== API ==========

export const secureExamApi = {
    /**
     * Start secure exam - generates randomized questions.
     * Returns metadata only, NO questions!
     */
    async startExam(sessionId: string): Promise<ExamMetadata> {
        const response = await axiosInstance.post<ExamMetadata>(
            `/secure-exam/${sessionId}/start`
        );
        return response.data;
    },

    /**
     * Get current question ONLY.
     * No endpoint to get all questions!
     */
    async getCurrentQuestion(sessionId: string): Promise<SecureQuestion> {
        const response = await axiosInstance.get<SecureQuestion>(
            `/secure-exam/${sessionId}/current-question`
        );
        return response.data;
    },

    /**
     * Submit answer and get next question.
     * No going back after this!
     */
    async submitAnswer(sessionId: string, answer: string): Promise<SubmitAnswerResponse> {
        const response = await axiosInstance.post<SubmitAnswerResponse>(
            `/secure-exam/${sessionId}/submit-answer`,
            {
                answer,
                clientTimeMs: Date.now()
            }
        );
        return response.data;
    },

    /**
     * Heartbeat for idle detection.
     * Must be called every 5 seconds.
     */
    async heartbeat(sessionId: string): Promise<HeartbeatResponse> {
        const response = await axiosInstance.post<HeartbeatResponse>(
            `/secure-exam/${sessionId}/heartbeat`,
            {
                clientTimeMs: Date.now()
            }
        );
        return response.data;
    },

    /**
     * Get session status.
     */
    async getStatus(sessionId: string): Promise<SessionStatus> {
        const response = await axiosInstance.get<SessionStatus>(
            `/secure-exam/${sessionId}/status`
        );
        return response.data;
    },

    /**
     * Lock session (for proctor or auto-lock).
     */
    async lockSession(sessionId: string, reason: string): Promise<void> {
        await axiosInstance.post(
            `/secure-exam/${sessionId}/lock`,
            null,
            { params: { reason } }
        );
    }
};

export default secureExamApi;
