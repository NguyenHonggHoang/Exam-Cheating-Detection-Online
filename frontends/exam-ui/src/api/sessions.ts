import { axiosInstance } from './client';

export interface Session {
  id: string;
  examId: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  status: 'ACTIVE' | 'ENDED';
  createdAt: string;
}

export const sessionsApi = {
  /**
   * Get all sessions for a specific user
   */
  async getByUser(userId: string): Promise<Session[]> {
    const response = await axiosInstance.get<Session[]>(`/api/sessions/user/${userId}`);
    return response.data;
  },

  /**
   * Get a specific session by ID
   */
  async getById(sessionId: string): Promise<Session> {
    const response = await axiosInstance.get<Session>(`/api/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Start a new session
   */
  async start(data: { examId: string; userId: string }): Promise<Session> {
    const response = await axiosInstance.post<Session>('/api/sessions/start', data);
    return response.data;
  },

  /**
   * End a session
   */
  async end(sessionId: string): Promise<Session> {
    const response = await axiosInstance.post<Session>(`/api/sessions/${sessionId}/end`);
    return response.data;
  },

  /**
   * Get all sessions (Admin/Proctor only)
   */
  async getAll(): Promise<Session[]> {
    const response = await axiosInstance.get<Session[]>('/api/sessions');
    return response.data;
  }
};
