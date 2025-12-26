import { axiosInstance } from './client';

export type BrowserMode = 'NORMAL' | 'SEB_REQUIRED' | 'SEB_OPTIONAL';

export interface ProhibitedProcess {
  identifier: string;
  os: 1 | 2; // 1 = Windows, 2 = macOS
  description?: string;
}

export interface SebConfig {
  // Basic Settings
  quitPassword?: string;
  adminPassword?: string;
  allowWifi?: boolean;
  showTaskBar?: boolean;
  showReloadButton?: boolean;
  showTime?: boolean;
  showInputLanguage?: boolean;
  allowQuit?: boolean;

  // Security - VM & Remote Detection
  detectVirtualMachine?: boolean;
  allowRemoteDesktop?: boolean;

  // Security - Display
  allowMultipleDisplays?: boolean;
  allowDisplayMirroring?: boolean;
  blockScreenCapture?: boolean;

  // Security - Kiosk Mode
  enableKioskMode?: boolean;
  enablePrivateClipboard?: boolean;

  // URL Filter Rules (array of regex patterns)
  urlFilterRules?: string;

  // Prohibited Processes (JSON string of ProhibitedProcess array)
  prohibitedProcesses?: string;
}

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
  createdBy?: string;
  updatedAt?: string;
  // SEB Configuration
  browserMode: BrowserMode;
  sebConfig?: SebConfig;
  sebConfigKey?: string;
  requireIdVerification: boolean;
  maxVerificationAttempts: number;
  maxAttempts: number | null; // null = unlimited
}

export interface CreateExamRequest {
  name: string;
  description?: string;
  startTime: string;
  endTime?: string;
  durationMinutes?: number;
  retentionDays?: number;
  browserMode?: BrowserMode;
  sebConfig?: SebConfig;
  requireIdVerification?: boolean;
  maxVerificationAttempts?: number;
  maxAttempts?: number | null;
}

export interface UpdateExamRequest {
  name?: string;
  description?: string;
  startTime?: string;
  endTime?: string;
  durationMinutes?: number;
  retentionDays?: number;
  browserMode?: BrowserMode;
  sebConfig?: SebConfig;
  requireIdVerification?: boolean;
  maxVerificationAttempts?: number;
  maxAttempts?: number | null;
}

export const examsApi = {
  /**
   * Get all exams, optionally filtered by status
   */
  async getAll(status?: 'ACTIVE' | 'ENDED' | 'UPCOMING' | 'SCHEDULED'): Promise<Exam[]> {
    const params = status ? { status } : {};
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
  async create(data: CreateExamRequest): Promise<Exam> {
    const response = await axiosInstance.post<Exam>('/api/exams', data);
    return response.data;
  },

  /**
   * Update an exam (Admin only)
   */
  async update(examId: string, data: UpdateExamRequest): Promise<Exam> {
    const response = await axiosInstance.put<Exam>(`/api/exams/${examId}`, data);
    return response.data;
  },

  /**
   * Delete an exam (Admin only)
   */
  async delete(examId: string): Promise<void> {
    await axiosInstance.delete(`/api/exams/${examId}`);
  },

  // ========== Queue Management ==========

  /**
   * Join exam queue (Student)
   */
  async joinQueue(examId: string): Promise<{
    examId: string;
    userId: string;
    position: number;
    totalInQueue: number;
    examStarted: boolean;
  }> {
    const response = await axiosInstance.post(`/api/exams/${examId}/queue/join`);
    return response.data;
  },

  /**
   * Leave exam queue (Student)
   */
  async leaveQueue(examId: string): Promise<void> {
    await axiosInstance.post(`/api/exams/${examId}/queue/leave`);
  },

  /**
   * Get queue status
   */
  async getQueueStatus(examId: string): Promise<{
    examId: string;
    totalInQueue: number;
    examStarted: boolean;
  }> {
    const response = await axiosInstance.get(`/api/exams/${examId}/queue/status`);
    return response.data;
  },

  /**
   * Get queue members (Proctor/Admin)
   */
  async getQueueMembers(examId: string): Promise<{
    examId: string;
    members: Array<{ id: string; userId: string; joinedAt: string }>;
    totalInQueue: number;
    examStarted: boolean;
  }> {
    const response = await axiosInstance.get(`/api/exams/${examId}/queue/members`);
    return response.data;
  },

  /**
   * Start exam - allows students in queue to proceed (Proctor/Admin)
   */
  async startExam(examId: string): Promise<{
    examId: string;
    started: boolean;
    studentsNotified: number;
  }> {
    const response = await axiosInstance.post(`/api/exams/${examId}/start`);
    return response.data;
  }
};

