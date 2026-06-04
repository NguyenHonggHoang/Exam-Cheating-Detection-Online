import { axiosInstance } from './client';

/**
 * Incident Types aligned with backend
 */
export type IncidentType =
  | 'MULTIPLE_FACES'
  | 'NO_FACE'
  | 'LOOKING_AWAY'
  | 'TAB_SWITCH'
  | 'PASTE'
  | 'BLUR'
  | 'FOCUS'
  | 'DEVICE_CHANGE'
  | 'BROWSER_EXTENSION'
  | 'ANSWER_BEHAVIOR_ANOMALY'
  | 'SCREENSHOT_ATTEMPT'
  | 'USER_IDLE'
  | 'BEHAVIOR_ANALYSIS';

export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH';
export type IncidentStatus = 'PENDING' | 'UNDER_REVIEW' | 'REVIEWED' | 'DISMISSED' | 'ESCALATED';
export type ReviewDecision = 'VALID' | 'FALSE_POSITIVE' | 'ESCALATED' | 'INCONCLUSIVE';

export interface Incident {
  id: string;
  sessionId: string;
  examId?: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  evidenceUrl: string | null;
  objectKey?: string;
  fileSize?: number;
  detectedBy: 'FRONTEND_AI' | 'SERVER_AI' | 'PROCTOR';
  detectedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  consecutiveCount?: number;
  firstDetectedAt?: string;
  metadata?: Record<string, any>;
}

export interface IncidentDetailed extends Incident {
  examId?: string;
  userId?: string;
  sessionStatus?: string;
}

export interface PaginatedIncidents {
  content: Incident[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface IncidentSummary {
  totalIncidents: number;
  pendingIncidents: number;
  reviewedIncidents: number;
  dismissedIncidents: number;
  lowSeverityCount: number;
  mediumSeverityCount: number;
  highSeverityCount: number;
}

export interface Review {
  id: string;
  incidentId: string;
  reviewedBy: string;
  decision: ReviewDecision;
  notes?: string;
  reviewedAt: string;
  createdAt: string;
}

export interface CreateReviewRequest {
  reviewedBy: string;
  decision: ReviewDecision;
  notes?: string;
}

export const incidentsApi = {
  async list(params?: {
    sessionId?: string;
    examId?: string;
    severity?: IncidentSeverity;
    status?: IncidentStatus;
    page?: number;
    size?: number;
    sort?: string;
  }): Promise<PaginatedIncidents> {
    const response = await axiosInstance.get<PaginatedIncidents>('/incidents', { params });
    return response.data;
  },

  /**
   * Get incident details with session context
   */
  async getById(incidentId: string): Promise<IncidentDetailed> {
    const response = await axiosInstance.get<IncidentDetailed>(`/incidents/${incidentId}`);
    return response.data;
  },

  /**
   * Update incident status
   */
  async updateStatus(incidentId: string, status: IncidentStatus, notes?: string): Promise<Incident> {
    const response = await axiosInstance.patch<Incident>(
      `/incidents/${incidentId}/status`,
      { status, notes }
    );
    return response.data;
  },

  /**
   * Get incident summary statistics
   */
  async getSummary(params?: {
    sessionId?: string;
    examId?: string;
  }): Promise<IncidentSummary> {
    const response = await axiosInstance.get<IncidentSummary>('/incidents/summary', { params });
    return response.data;
  },

  /**
   * Create review for incident
   */
  async createReview(incidentId: string, request: CreateReviewRequest): Promise<Review> {
    const response = await axiosInstance.post<Review>(
      `/incidents/${incidentId}/reviews`,
      request
    );
    return response.data;
  },

  /**
   * Get reviews for incident
   */
  async getReviews(incidentId: string): Promise<Review[]> {
    const response = await axiosInstance.get<Review[]>(`/incidents/${incidentId}/reviews`);
    return response.data;
  },

  /**
   * Send client-side detection event (creates incident)
   * Routes through BFF proxy which adds auth token
   */
  async sendClientEvent(event: {
    sessionId: string;
    eventType: string;
    violationType: IncidentType;
    violationState?: string;
    evidenceUrl?: string;
    objectKey?: string;
    fileSize?: number;
    timestamp: number;
    source?: string;
    detectionResult?: {
      faceCount: number;
      confidence: number;
      headPose?: { pitch: number; yaw: number; roll: number };
      eyeState?: { leftEyeOpen: boolean; rightEyeOpen: boolean };
      timestamp: number;
    };
    consecutiveCount?: number;
    firstDetectedAt?: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await axiosInstance.post('/incident/client-event', event);
  }
};

export const getIncidentsBySession = (sessionId: string) =>
  incidentsApi.list({ sessionId });
