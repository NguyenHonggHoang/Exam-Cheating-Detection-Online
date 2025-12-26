import { axiosInstance } from './client';

export interface User {
    id: string;
    username: string;
    email: string;
    enabled: boolean;
    roles: string[]; // e.g., ['ROLE_STUDENT', 'ROLE_ADMIN']
    createdAt?: string;
}

export interface PaginatedUsers {
    content: User[];
    totalElements: number;
    totalPages: number;
    size: number;
    number: number;
}

export interface CreateUserRequest {
    username: string;
    email: string;
    password: string;
    role: 'CANDIDATE' | 'PROCTOR' | 'ADMIN';
}

export interface UpdateUserRequest {
    enabled?: boolean;
    role?: 'CANDIDATE' | 'PROCTOR' | 'ADMIN';
}

function mapUser(data: any): User {
    if (!data) return data;
    return {
        ...data,
        roles: data.authorities || data.roles || []
    };
}

export const usersApi = {
    /**
     * List all users with pagination and role filter
     */
    async list(params?: {
        page?: number;
        size?: number;
        role?: string;
    }): Promise<PaginatedUsers> {
        // Use admin-service endpoint
        const response = await axiosInstance.get<any>('/api/admin/users', { params });
        return {
            ...response.data,
            content: response.data.content.map(mapUser)
        };
    },

    /**
     * Search users by name or email
     */
    async search(query: string, limit = 10): Promise<User[]> {
        const response = await axiosInstance.get<any[]>('/api/users/search', {
            params: { q: query, limit }
        });
        return response.data.map(mapUser);
    },

    /**
     * Get users by IDs (batch lookup)
     */
    async getByIds(userIds: string[]): Promise<User[]> {
        const response = await axiosInstance.post<any[]>('/api/users/batch', userIds);
        return response.data.map(mapUser);
    },

    /**
     * Create a new user (Admin only)
     */
    async create(data: CreateUserRequest): Promise<User> {
        const response = await axiosInstance.post<any>('/api/admin/users', data);
        return mapUser(response.data);
    },

    /**
     * Update a user (Admin only)
     */
    async update(userId: string, data: UpdateUserRequest): Promise<User> {
        const response = await axiosInstance.put<any>(`/api/admin/users/${userId}`, data);
        return mapUser(response.data);
    },

    /**
     * Delete a user (Admin only)
     */
    async delete(userId: string): Promise<void> {
        await axiosInstance.delete(`/api/admin/users/${userId}`);
    },

    /**
     * Reset user password (Admin only)
     */
    async resetPassword(userId: string, newPassword: string): Promise<void> {
        await axiosInstance.post(`/api/admin/users/${userId}/reset-password`, { newPassword });
    },

    /**
     * Assign role to user (Admin only)
     */
    async assignRole(userId: string, role: 'CANDIDATE' | 'PROCTOR' | 'ADMIN'): Promise<User> {
        const response = await axiosInstance.post<any>(`/api/admin/users/${userId}/roles`, { role });
        return mapUser(response.data);
    },

    /**
     * Export users as CSV
     */
    async exportCsv(role?: string): Promise<Blob> {
        const response = await axiosInstance.get('/api/admin/users/export', {
            params: { role },
            responseType: 'blob'
        });
        return response.data;
    }
};
