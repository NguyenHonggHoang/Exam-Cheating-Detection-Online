import axios from 'axios';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api/proxy';

export interface EventItem {
  sessionId: string;
  ts: number;
  eventType: 'TAB_SWITCH' | 'PASTE' | 'FOCUS' | 'BLUR';
  details?: string;
  idempotencyKey: string;
}

export interface IngestEventsRequest {
  items: EventItem[];
}

export interface IngestEventsResponse {
  created: number;
  duplicates: number;
  ids: string[];
}

export interface SnapshotItem {
  sessionId: string;
  ts: number;
  objectKey: string;
  fileSize: number;
  mimeType: string;
  faceCount?: number;
  idempotencyKey: string;
}

export interface IngestSnapshotsRequest {
  items: SnapshotItem[];
}

export interface IngestSnapshotsResponse {
  created: number;
  duplicates: number;
  ids: string[];
}

export const ingestApi = {
  ingestEvents: async (request: IngestEventsRequest): Promise<IngestEventsResponse> => {
    const response = await axios.post(`${API_BASE_URL}/api/ingest/events`, request);
    return response.data;
  },

  uploadSnapshot: async (sessionId: string, blob: Blob): Promise<void> => {
    const formData = new FormData();
    const filename = `snapshot-${Date.now()}.jpg`;
    formData.append('file', blob, filename);
    formData.append('sessionId', sessionId);
    formData.append('ts', Date.now().toString()); // milliseconds

    // Use fetch instead of axios to avoid interceptors messing with Content-Type
    const response = await fetch(`${API_BASE_URL}/api/ingest/snapshots/upload`, {
      method: 'POST',
      body: formData
      // No headers - let browser set Content-Type with boundary automatically
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }
  }
};

// Helper to generate idempotency key
export const generateIdempotencyKey = (sessionId: string, type: string, ts: number): string => {
  return `${sessionId}-${type}-${ts}`;
};
