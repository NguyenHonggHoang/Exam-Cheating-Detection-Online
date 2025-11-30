// API Type Definitions

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'ADMIN' | 'PROCTOR' | 'REVIEWER' | 'CANDIDATE';
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface Exam {
  id: string;
  name: string;
  description?: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: 'UPCOMING' | 'ACTIVE' | 'ENDED';
  retentionDays: number;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  userId: string;
  examId: string;
  startedAt: string;
  endedAt: string | null;
  status: 'ACTIVE' | 'ENDED';
  createdAt: string;
}

export interface StartSessionRequest {
  examId: string;
  userId: string;
}

export interface StartSessionResponse {
  session: Session;
}

export interface MediaSnapshot {
  id: string;
  sessionId: string;
  ts: number;
  objectKey: string;
  faceCount?: number;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface SnapshotUploadItem {
  sessionId: string;
  ts: number;
  imageBase64: string;
  faceCount?: number;
  idempotencyKey: string;
}

export interface SnapshotUploadRequest {
  items: SnapshotUploadItem[];
}

export interface EventType {
  type: 'FOCUS' | 'BLUR' | 'TAB_SWITCH' | 'PASTE' | 'COPY' | 'CUSTOM';
  payload?: Record<string, any>;
}

export interface IngestEventItem {
  sessionId: string;
  ts: number;
  eventType: string;
  payload?: Record<string, any>;
  idempotencyKey: string;
}

export interface IngestEventsRequest {
  events: IngestEventItem[];
}

export interface Incident {
  id: string;
  sessionId: string;
  ts: number;
  type: 'TAB_ABUSE' | 'NO_FACE' | 'MULTI_FACE' | 'PASTE_DETECTED' | 'UNAUTHORIZED_DEVICE';
  score: number;
  reason: string;
  evidenceUrl: string | null;
  status: 'OPEN' | 'CONFIRMED' | 'REJECTED';
  createdAt: string;
}

export interface PaginatedIncidents {
  content: Incident[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
}

export interface Review {
  id: string;
  incidentId: string;
  reviewerId: string;
  decision: 'CONFIRM' | 'REJECT';
  note?: string;
  reviewedAt: string;
}

export interface ReviewIncidentRequest {
  decision: 'CONFIRM' | 'REJECT';
  note?: string;
}

export interface ExamStats {
  examId: string;
  totalIncidents: number;
  confirmedIncidents: number;
  rejectedIncidents: number;
  pendingIncidents: number;
  confirmationRate: number;
  incidentByType: Record<string, number>;
}

export interface ApiError {
  message: string;
  status: number;
  errors?: Record<string, string[]>;
}
