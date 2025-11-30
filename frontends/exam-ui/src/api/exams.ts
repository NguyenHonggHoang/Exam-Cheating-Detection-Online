import { axiosInstance } from './client';

export interface Exam {
  id: string;
  name: string;
  description: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: 'UPCOMING' | 'ACTIVE' | 'ENDED';
  retentionDays: number;
  createdAt: string;
}

export interface ExamsResponse {
  exams: Exam[];
}

export const examsApi = {
  /**
   * Get all exams, optionally filtered by status
   */
  async getAll(status?: 'ACTIVE' | 'ENDED' | 'UPCOMING'): Promise<Exam[]> {
    const params = status ? { status } : {};
    // axiosInstance already has baseURL '/api/proxy', so we use relative path
    const response = await axiosInstance.get<Exam[]>('/api/exams', { params });
    return response.data;
  },

  /**
   * Get a single exam by ID
   */
  async getById(examId: string): Promise<Exam> {
    const response = await axiosInstance.get<Exam>(`/api/exams/${examId}`);
    return response.data;
  },

  /**
   * Create a new exam (Admin only)
   */
  async create(data: {
    name: string;
    description: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    retentionDays?: number;
  }): Promise<Exam> {
    const response = await axiosInstance.post<Exam>('/api/exams', data);
    return response.data;
  },

  /**
   * Update an exam (Admin only)
   */
  async update(examId: string, data: Partial<{
    name: string;
    description: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    retentionDays: number;
  }>): Promise<Exam> {
    const response = await axiosInstance.put<Exam>(`/api/exams/${examId}`, data);
    return response.data;
  },

  /**
   * Delete an exam (Admin only)
   */
  async delete(examId: string): Promise<void> {
    await axiosInstance.delete(`/api/exams/${examId}`);
  }
};
