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
  type: 'MULTIPLE_CHOICE' | 'TEXT';
  text: string;
  options: string[] | null;
  correctAnswer?: string;
}

export interface GetQuestionsResponse {
  examId: string;
  examName: string;
  questions: Question[];
  durationMinutes: number;
}

export interface SubmitAnswer {
  questionId: string;
  answer: string;
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

export const mockExamApi = {
  startSession: async (request: StartSessionRequest): Promise<StartSessionResponse> => {
    const response = await axios.post(`${API_BASE_URL}/api/mock-exam/start`, request);
    return response.data;
  },

  getQuestions: async (examId: string): Promise<GetQuestionsResponse> => {
    const response = await axios.get(`${API_BASE_URL}/api/mock-exam/${examId}/questions`);
    return response.data;
  },

  submitExam: async (request: SubmitRequest): Promise<SubmitResponse> => {
    const response = await axios.post(`${API_BASE_URL}/api/mock-exam/submit`, request);
    return response.data;
  }
};
