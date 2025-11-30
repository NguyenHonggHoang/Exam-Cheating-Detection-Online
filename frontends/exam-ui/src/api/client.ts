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

const AUTH_BASE_URL = '/api/auth';

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

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        if (error.response?.status === 401) {
          console.warn('[ApiClient] Session expired or unauthorized. Redirecting to login...');
          
          if (!window.location.pathname.includes('/auth/signin')) {

             window.location.href = `${AUTH_BASE_URL}/signin/exam-oidc?callbackUrl=${encodeURIComponent(window.location.href)}`;
          }
        }
        return Promise.reject(error);
      }
    );
  }


  async login(): Promise<void> {
    try {
      const csrfResponse = await axios.get('/api/auth/csrf');
      const csrfToken = csrfResponse.data.csrfToken;

      const callbackUrl = window.location.href;
      const targetUrl = '/api/auth/signin/exam-oidc';


      const form = document.createElement('form');
      form.method = 'POST';
      form.action = targetUrl;


      const csrfInput = document.createElement('input');
      csrfInput.type = 'hidden';
      csrfInput.name = 'csrfToken';
      csrfInput.value = csrfToken;
      form.appendChild(csrfInput);


      const callbackInput = document.createElement('input');
      callbackInput.type = 'hidden';
      callbackInput.name = 'callbackUrl';
      callbackInput.value = callbackUrl;
      form.appendChild(callbackInput);

      document.body.appendChild(form);
      form.submit();
      
    } catch (error) {
      console.error("Login flow error:", error);
      window.location.href = '/api/auth/signin/exam-oidc';
    }
  }

  async logout(): Promise<void> {
    try {
      const response = await axios.get('/api/auth/federated-logout');
      const logoutUrl = response.data.url;

      await axios.post('/api/auth/signout', {
        csrfToken: await this.getCsrfToken() 
      });
      
      window.location.href = logoutUrl;

    } catch (error) {
      console.error("Logout error:", error);

      window.location.href = '/api/auth/signout';
    }
  }

  private async getCsrfToken() {
     const res = await axios.get('/api/auth/csrf');
     return res.data.csrfToken;
  }


  async register(data: any): Promise<any> {
    const response = await axios.post('/api/register', data, {
      headers: { 'Content-Type': 'application/json' }
    });
    return response.data;
  }

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

  async uploadSnapshots(request: SnapshotUploadRequest): Promise<void> {
    await this.client.post('/ingest/snapshots/upload', request);
  }

  async ingestEvents(request: IngestEventsRequest): Promise<void> {
    await this.client.post('/ingest/events', request);
  }

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