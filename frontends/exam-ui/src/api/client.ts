import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  LoginRequest,
  LoginResponse,
  StartSessionRequest,
  StartSessionResponse,
  Session,
  SnapshotUploadRequest,
  IngestEventsRequest,
  PaginatedIncidents,
  Incident,
  ReviewIncidentRequest,
  ExamStats,
  Exam,
  ApiError,
} from './types';

const API_BASE_URL = '/api/proxy';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        if (error.response?.status === 401 && error.config?.url?.includes('/api/auth/userinfo')) {
          console.log('[ApiClient] Userinfo returned 401, redirecting to login');
          window.location.href = '/api/auth/login';
        }
        return Promise.reject(error);
      }
    );
  }

  async login(): Promise<void> {
    const callbackUrl = window.location.origin;
    window.location.href = `/api/auth/login?callbackUrl=${encodeURIComponent(callbackUrl)}`;
  }

  async logout(): Promise<void> {
    const response = await axios.post('/api/auth/logout');
    if (response.data?.redirectUrl) {
      window.location.href = response.data.redirectUrl;
    }
  }

  async register(data: any): Promise<any> {
    // Public endpoint - doesn't require authentication
    const response = await axios.post('/api/register', data);
    return response.data;
  }

  // Session endpoints
  async startSession(request: StartSessionRequest): Promise<StartSessionResponse> {
    const response = await this.client.post<StartSessionResponse>('/sessions/start', request);
    return response.data;
  }

  async endSession(sessionId: string): Promise<void> {
    await this.client.post(`/sessions/${sessionId}/end`);
  }

  async getSession(sessionId: string): Promise<Session> {
    const response = await this.client.get<Session>(`/sessions/${sessionId}`);
    return response.data;
  }

  // Ingest endpoints
  async uploadSnapshots(request: SnapshotUploadRequest): Promise<void> {
    await this.client.post('/ingest/snapshots/upload', request);
  }

  async ingestEvents(request: IngestEventsRequest): Promise<void> {
    await this.client.post('/ingest/events', request);
  }

  // Incidents endpoints
  async getIncidents(params?: {
    examId?: string;
    sessionId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<PaginatedIncidents> {
    const response = await this.client.get<PaginatedIncidents>('/api/incidents', { params });
    return response.data;
  }

  async getIncident(incidentId: string): Promise<Incident> {
    const response = await this.client.get<Incident>(`/incidents/${incidentId}`);
    return response.data;
  }

  async reviewIncident(incidentId: string, request: ReviewIncidentRequest): Promise<void> {
    await this.client.post(`/incidents/${incidentId}/review`, request);
  }

  // Admin endpoints
  async getExamStats(examId: string): Promise<ExamStats> {
    const response = await this.client.get<ExamStats>('/admin/stats', {
      params: { examId },
    });
    return response.data;
  }

  async getExams(): Promise<Exam[]> {
    const response = await this.client.get<Exam[]>('/admin/exams');
    return response.data;
  }

  async createExam(exam: Partial<Exam>): Promise<Exam> {
    const response = await this.client.post<Exam>('/admin/exams', exam);
    return response.data;
  }
}

export const apiClient = new ApiClient();
export const axiosInstance = apiClient['client'] as AxiosInstance;
export default apiClient;
