import { axiosInstance } from './client';

export type SessionStatus = 'ACTIVE' | 'PAUSED' | 'ENDED' | 'ABORTED';

export interface Session {
  id: string;
  examId: string;
  userId: string;
  startedAt: string;
  endedAt: string | null;
  status: SessionStatus;
  createdAt?: string;
}

export interface JoinSessionResponse {
  sessionId: string;
  token: string;
  wsUrl: string;
  roomName: string;
  examName: string;
  duration: number;
  startedAt: string;
}

export interface StorageUsageResponse {
  usageBytes: number;
  fileCount: number;
  limitBytes: number;
  quotaExceeded: boolean;
}

export interface PresignedUrlRequest {
  sessionId: string;
  type: 'snapshot' | 'clip' | 'identity';
  contentType: string;
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  publicUrl: string;
  objectKey: string;
  expiresIn: number;
}

// ========== Answer Logs Types ==========

/**
 * Answer log entry for a single question response
 * Contains behavior metrics for proctor analysis
 */
export interface AnswerLog {
  id: string;
  sessionId: string;
  examId: string;
  questionId: string;
  questionIndex: number;
  selectedAnswer: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeToAnswerMs: number;
  revisionCount: number;
  answerChangesJson: string;
  averageTypingSpeed: number | null;
  hadPreSuspicionDuring: boolean;
  createdAt: string;
}

/**
 * Response wrapper for answer logs endpoint
 */
export interface AnswerLogResponse {
  content: AnswerLog[];
  totalElements: number;
}

/**
 * Session Service API
 * 
 * Handles session lifecycle and storage operations
 */
export const sessionsApi = {
  /**
   * Get all sessions for a specific user
   */
  async getByUser(userId: string): Promise<Session[]> {
    const response = await axiosInstance.get<Session[]>(`/sessions/user/${userId}`);
    return response.data;
  },

  /**
   * Get a specific session by ID
   */
  async getById(sessionId: string): Promise<Session> {
    const response = await axiosInstance.get<Session>(`/sessions/${sessionId}`);
    return response.data;
  },

  /**
   * Start a new session
   */
  async start(data: { examId: string }): Promise<Session> {
    const response = await axiosInstance.post<Session>('/sessions/start', data);
    return response.data;
  },

  /**
   * Join session and get LiveKit token
   */
  async join(sessionId: string): Promise<JoinSessionResponse> {
    const response = await axiosInstance.post<JoinSessionResponse>(
      `/sessions/${sessionId}/join`
    );
    return response.data;
  },

  /**
   * Join exam directly (creates session + LiveKit token)
   */
  async joinExam(examId: string): Promise<JoinSessionResponse> {
    const response = await axiosInstance.post<JoinSessionResponse>(
      '/sessions/internal/session/join',
      { examId }
    );
    return response.data;
  },

  /**
   * Complete session (exam submitted)
   */
  async complete(sessionId: string): Promise<Session> {
    const response = await axiosInstance.post<Session>(`/sessions/${sessionId}/complete`);
    return response.data;
  },

  /**
   * End session (general end)
   */
  async end(sessionId: string): Promise<Session> {
    const response = await axiosInstance.post<Session>(`/sessions/${sessionId}/end`);
    return response.data;
  },

  /**
   * Update session status
   */
  async updateStatus(sessionId: string, status: SessionStatus): Promise<Session> {
    const response = await axiosInstance.patch<Session>(
      `/sessions/${sessionId}/status`,
      { status }
    );
    return response.data;
  },

  /**
   * Get all sessions for an exam (Proctor only)
   */
  async getByExam(examId: string, status?: SessionStatus): Promise<Session[]> {
    const params = status ? { status } : {};
    const response = await axiosInstance.get<Session[]>(
      `/sessions/exam/${examId}`,
      { params }
    );
    return response.data;
  },

  /**
   * Get all sessions (Admin/Proctor only)
   */
  async getAll(): Promise<Session[]> {
    const response = await axiosInstance.get<Session[]>('/sessions');
    return response.data;
  },

  /**
   * Get storage usage for session
   */
  async getStorageUsage(sessionId: string): Promise<StorageUsageResponse> {
    const response = await axiosInstance.get<StorageUsageResponse>(
      `/sessions/${sessionId}/storage-usage`
    );
    return response.data;
  },

  /**
   * Get presigned URL for upload
   */
  async getPresignedUrl(request: PresignedUrlRequest): Promise<PresignedUrlResponse> {
    const params = new URLSearchParams({
      type: request.type,
      ...(request.sessionId && { sessionId: request.sessionId })
    });
    const response = await axiosInstance.get<PresignedUrlResponse>(
      `/storage/presigned-url?${params.toString()}`
    );
    return response.data;
  },

  /**
   * Get proctor token for LiveKit room monitoring
   */
  async getProctorToken(roomName: string): Promise<{
    token: string;
    wsUrl: string;
    roomName: string;
  }> {
    const response = await axiosInstance.get<{
      token: string;
      wsUrl: string;
      roomName: string;
    }>(`/sessions/proctor-token?roomName=${encodeURIComponent(roomName)}`);
    return response.data;
  },

  /**
   * Queue video clip for AI analysis (YOLO detection)
   * Called after uploading clip to MinIO when TF.js detects violation
   */
  async queueVideoAnalysis(request: {
    sessionId: string;
    objectKey: string;
    publicUrl: string;
    violationType: string;
    timestamp: number;
    durationMs?: number;
    mimeType?: string;
    fileSize?: number;
  }): Promise<{ status: string; message: string }> {
    const response = await axiosInstance.post<{ status: string; message: string }>(
      '/analysis/video',
      request
    );
    return response.data;
  },

  /**
   * Queue pre-suspicion micro-buffer video for screen glow analysis
   * Called after uploading micro-buffer to MinIO during pre-suspicion detection
   */
  async queuePreSuspicionAnalysis(request: {
    sessionId: string;
    objectKey: string;
    publicUrl: string;
    pattern: 'phone_below' | 'phone_beside' | 'none';
    confidence: number;
    timestamp: number;
    durationMs?: number;
    fileSize?: number;
  }): Promise<{ status: string; message: string }> {
    const response = await axiosInstance.post<{ status: string; message: string }>(
      '/analysis/video',
      {
        sessionId: request.sessionId,
        objectKey: request.objectKey,
        publicUrl: request.publicUrl,
        violationType: 'PHONE_USAGE',
        timestamp: request.timestamp,
        durationMs: request.durationMs || 5000,
        mimeType: 'video/webm',
        fileSize: request.fileSize || 0,
        requestedAnalysis: 'SCREEN_GLOW',  // Specific analysis type
        metadata: {
          pattern: request.pattern,
          confidence: request.confidence,
          source: 'PRE_SUSPICION_DETECTOR'
        }
      }
    );
    return response.data;
  },

  // ========== LiveKit Egress API ==========

  /**
   * Start server-side video recording via LiveKit Egress
   * Called when TF.js detects a violation to record evidence
   * 
   * @param request Recording parameters
   * @returns Egress ID for tracking
   */
  async startEgressRecording(request: {
    sessionId: string;
    roomName: string;
    trackId?: string;  // Optional: specific track to record
    violationType: string;
    durationSeconds?: number;  // Default: 10 seconds
  }): Promise<{
    status: string;
    egressId: string;
    message: string;
    durationSeconds: number;
  }> {
    const response = await axiosInstance.post<{
      status: string;
      egressId: string;
      message: string;
      durationSeconds: number;
    }>('/egress/start', request);
    return response.data;
  },

  /**
   * Stop an active Egress recording
   * 
   * @param egressId The egress ID returned from startEgressRecording
   */
  async stopEgressRecording(egressId: string): Promise<{
    status: string;
    egressId: string;
  }> {
    const response = await axiosInstance.post<{
      status: string;
      egressId: string;
    }>(`/egress/stop/${egressId}`);
    return response.data;
  },

  /**
   * List active Egress recordings
   */
  async listActiveEgress(): Promise<{
    count: number;
    recordings: string[];
  }> {
    const response = await axiosInstance.get<{
      count: number;
      recordings: string[];
    }>('/egress/active');
    return response.data;
  },

  // ========== Calibration API ==========

  /**
   * Save gaze calibration data to backend
   * Persists calibration so it survives page refresh
   */
  async saveCalibration(sessionId: string, calibration: GazeCalibrationData): Promise<void> {
    await axiosInstance.post(`/sessions/${sessionId}/calibration`, calibration);
  },

  /**
   * Load gaze calibration data from backend
   * Returns null if no calibration exists
   */
  async getCalibration(sessionId: string): Promise<GazeCalibrationData | null> {
    try {
      const response = await axiosInstance.get<GazeCalibrationData>(`/sessions/${sessionId}/calibration`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // ========== Answer Logs API ==========

  /**
   * Get answer logs for a session
   * Returns all answer log entries ordered by question index
   * Used by proctor dashboard to analyze student behavior
   */
  async getAnswerLogs(sessionId: string): Promise<AnswerLogResponse> {
    const response = await axiosInstance.get<AnswerLogResponse>(
      `/sessions/${sessionId}/answer-logs`
    );
    return response.data;
  }
};

/**
 * Gaze calibration data structure
 */
export interface GazeCalibrationData {
  corners: {
    center: { pitch: number; yaw: number; roll: number };
    topLeft: { pitch: number; yaw: number; roll: number };
    topRight: { pitch: number; yaw: number; roll: number };
    bottomRight: { pitch: number; yaw: number; roll: number };
    bottomLeft: { pitch: number; yaw: number; roll: number };
  };
  boundaries: {
    minPitch: number;
    maxPitch: number;
    minYaw: number;
    maxYaw: number;
  };
  timestamp: number;
}

// Legacy export
export const getSessionsByUser = sessionsApi.getByUser;
