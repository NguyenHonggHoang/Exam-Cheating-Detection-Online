import { axiosInstance } from './client';

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

export const incidentsApi = {
  /**
   * Get incidents, optionally filtered by sessionId with pagination
   */
  async getAll(params?: {
    sessionId?: string;
    page?: number;
    size?: number;
    sort?: string;
  }): Promise<Incident[] | PaginatedIncidents> {
    const response = await axiosInstance.get<Incident[] | PaginatedIncidents>('/api/incidents', { params });
    return response.data;
  },

  /**
   * Get a specific incident by ID
   */
  async getById(incidentId: string): Promise<Incident> {
    const response = await axiosInstance.get<Incident>(`/api/incidents/${incidentId}`);
    return response.data;
  },

  /**
   * Create a new incident (usually done by system)
   */
  async create(data: {
    sessionId: string;
    ts: number;
    type: Incident['type'];
    score: number;
    reason: string;
    evidenceUrl?: string;
  }): Promise<Incident> {
    const response = await axiosInstance.post<Incident>('/api/incidents', data);
    return response.data;
  }
};
