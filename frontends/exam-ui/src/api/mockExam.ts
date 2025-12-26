import axios from 'axios';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api/proxy';

export interface StartSessionRequest {
  examId: string;
  userId: string;
}

export interface StartSessionResponse {
  sessionId: string;
  examId: string;
  examName: string;
  durationMinutes: number;
  startedAt: string;
}

export interface Question {
  id: string;
  type: 'MULTIPLE_CHOICE' | 'TEXT' | 'TRUE_FALSE';
  text: string;
  options: string[] | null;
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
  // correctAnswer is not sent from backend to students
}

export interface GetQuestionsResponse {
  examId: string;
  examName: string;
  questions: Question[];
  durationMinutes: number;
}

export interface GetQuestionResponse {
  examId: string;
  examName: string;
  question: Question;
  questionIndex: number; // 0-based
  totalQuestions: number;
  durationMinutes: number;
}

export interface AnswerChange {
  fromAnswer: string;
  toAnswer: string;
  timestamp: number;
  reason?: string;
}

export interface SubmitAnswer {
  questionId: string;
  answer: string;
  // Answer behavior metrics (optional)
  timeSpentMs?: number;
  revisionCount?: number;
  answerChanges?: AnswerChange[];
  averageTypingSpeed?: number;
  hadPreSuspicionDuring?: boolean;
  difficulty?: string;
}

export interface SubmitRequest {
  sessionId: string;
  answers: SubmitAnswer[];
}

export interface SubmitResponse {
  sessionId: string;
  submittedAt: string;
  totalQuestions: number;
  answeredQuestions: number;
  message: string;
}

// Behavior Analysis types
export interface BehaviorAnomaly {
  type: string;
  severity: string;
  score: number;
  description: string;
  evidence?: {
    questionIndex: number;
    expected: number | string;
    actual: number | string;
  };
}

export interface AnswerStatistics {
  totalQuestions: number;
  answered: number;
  correct: number;
  accuracy: number;
  avgTimePerDifficulty?: Record<string, number>;
  avgRevisionsPerDifficulty?: Record<string, number>;
}

export interface BehaviorPattern {
  name: string;
  detected: boolean;
  confidence: number;
  description: string;
}

export interface BehaviorAnalysisRequest {
  sessionId: string;
  overallScore: number;
  anomalies: BehaviorAnomaly[];
  statistics: AnswerStatistics;
  patterns?: BehaviorPattern[];
}

export interface BehaviorAnalysisResponse {
  sessionId: string;
  incidentCreated: boolean;
  message: string;
}

export const mockExamApi = {
  startSession: async (request: StartSessionRequest): Promise<StartSessionResponse> => {
    const response = await axios.post(`${API_BASE_URL}/api/mock-exam/start`, request);
    return response.data;
  },

  getQuestions: async (examId: string): Promise<GetQuestionsResponse> => {
    const response = await axios.get(`${API_BASE_URL}/api/mock-exam/${examId}/questions`);
    return response.data;
  },

  // NEW: Get single question by index (0-based)
  getQuestion: async (examId: string, questionIndex: number): Promise<GetQuestionResponse> => {
    const response = await axios.get(`${API_BASE_URL}/api/mock-exam/${examId}/question/${questionIndex}`);
    return response.data;
  },

  submitExam: async (request: SubmitRequest): Promise<SubmitResponse> => {
    const response = await axios.post(`${API_BASE_URL}/api/mock-exam/submit`, request);
    return response.data;
  },

  submitBehaviorAnalysis: async (request: BehaviorAnalysisRequest): Promise<BehaviorAnalysisResponse> => {
    const response = await axios.post(`${API_BASE_URL}/api/behavior/submit`, request);
    return response.data;
  }
};
