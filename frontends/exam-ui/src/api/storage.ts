import { axiosInstance } from './client';

/**
 * Storage metadata returned from backend
 * Matches StorageMetadataDto from session-service
 */
export interface StorageMetadata {
  objectKey: string;
  fileSize: number;
  contentType: string;
  lastModified: string;
  durationMs: number | null;
}

/**
 * Storage Service API
 * 
 * Handles storage metadata and presigned URL operations
 */
export const storageApi = {
  /**
   * Get metadata for a storage object
   * 
   * @param objectKey The object key (path) in MinIO
   * @returns StorageMetadata with file size, content type, last modified, and duration (for video files)
   * @throws 404 if object not found
   */
  async getStorageMetadata(objectKey: string): Promise<StorageMetadata> {
    const response = await axiosInstance.get<StorageMetadata>('/storage/metadata', {
      params: { objectKey }
    });
    return response.data;
  }
};

// Named export for direct function import
export const getStorageMetadata = storageApi.getStorageMetadata;
