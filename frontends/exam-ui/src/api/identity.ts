import { axiosInstance as api } from './client';
import type {
  StudentIdPhotoStatus,
  PresignedUploadResponse,
  IdentityVerificationRequest,
  IdentityVerificationResponse,
  IdentityVerificationResult,
  IdentityVerificationHistory
} from './types';

/**
 * Identity Verification API
 * 
 * Endpoints for student ID photo management and face verification
 */

// ========== Student ID Photo Management ==========

/**
 * Get presigned URL for uploading student ID photo to MinIO
 */
export async function getIdPhotoUploadUrl(contentType: string = 'image/jpeg'): Promise<PresignedUploadResponse> {
  const response = await api.post<PresignedUploadResponse>('/api/identity/id-photo/presigned-url', {
    contentType
  });
  return response.data;
}

/**
 * Confirm ID photo upload after uploading to MinIO
 */
export async function confirmIdPhotoUpload(params: {
  objectKey: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
}): Promise<{ success: boolean; photoId: string; status: string; message: string }> {
  const response = await api.post('/api/identity/id-photo/confirm', params);
  return response.data;
}

/**
 * Get current user's ID photo status
 */
export async function getIdPhotoStatus(): Promise<StudentIdPhotoStatus> {
  const response = await api.get<StudentIdPhotoStatus>('/api/identity/id-photo/status');
  return response.data;
}

/**
 * Upload ID photo via direct backend upload
 * This bypasses presigned URL signature issues in Docker environment
 */
export async function uploadIdPhoto(file: File): Promise<{ success: boolean; photoId: string }> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post<{ success: boolean; photoId: string; objectKey: string; status: string }>(
    '/api/identity/id-photo/upload',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );

  return {
    success: response.data.success,
    photoId: response.data.photoId,
  };
}

// ========== Face Verification During Exam ==========

/**
 * Request identity verification with a captured snapshot
 */
export async function requestVerification(
  request: IdentityVerificationRequest
): Promise<IdentityVerificationResponse> {
  const response = await api.post<IdentityVerificationResponse>('/api/identity/verify', request);
  return response.data;
}

/**
 * Get verification result for a session
 */
export async function getVerificationResult(sessionId: string): Promise<IdentityVerificationResult> {
  const response = await api.get<IdentityVerificationResult>(`/api/identity/verify/result/${sessionId}`);
  return response.data;
}

/**
 * Get verification history for a session
 */
export async function getVerificationHistory(sessionId: string): Promise<IdentityVerificationHistory[]> {
  const response = await api.get<IdentityVerificationHistory[]>(`/api/identity/verify/history/${sessionId}`);
  return response.data;
}

/**
 * Poll for verification result until complete or timeout
 */
export async function waitForVerificationResult(
  sessionId: string,
  options: { timeoutMs?: number; pollIntervalMs?: number } = {}
): Promise<IdentityVerificationResult> {
  const { timeoutMs = 30000, pollIntervalMs = 1000 } = options;
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const result = await getVerificationResult(sessionId);

    if (result.hasResult) {
      return result;
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error('Verification timeout - please try again');
}

// ========== Capture Snapshot for Verification ==========

/**
 * Capture webcam snapshot and upload for verification
 */
export async function captureAndUploadVerificationSnapshot(
  videoElement: HTMLVideoElement,
  sessionId: string
): Promise<{ objectKey: string; blob: Blob }> {
  // Create canvas and capture frame
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth || 640;
  canvas.height = videoElement.videoHeight || 480;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  ctx.drawImage(videoElement, 0, 0);

  // Convert to blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => b ? resolve(b) : reject(new Error('Failed to create blob')),
      'image/jpeg',
      0.9
    );
  });

  // Get presigned URL
  const presigned = await getIdPhotoUploadUrl('image/jpeg');

  // Upload snapshot
  const uploadResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: {
      'Content-Type': 'image/jpeg'
    }
  });

  if (!uploadResponse.ok) {
    throw new Error('Failed to upload verification snapshot');
  }

  return {
    objectKey: presigned.objectKey,
    blob
  };
}

/**
 * Upload an already-captured blob for verification
 * Use this when you already have a blob from useFaceQuality.capture()
 */
export async function uploadVerificationBlob(
  blob: Blob
): Promise<{ objectKey: string }> {
  // Get presigned URL
  const presigned = await getIdPhotoUploadUrl('image/jpeg');

  console.log('[Identity] Uploading verification blob to:', presigned.uploadUrl);
  console.log('[Identity] Object key:', presigned.objectKey);
  console.log('[Identity] Blob size:', blob.size);

  // Upload snapshot
  const uploadResponse = await fetch(presigned.uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: {
      'Content-Type': 'image/jpeg'
    }
  });

  if (!uploadResponse.ok) {
    console.error('[Identity] Upload failed:', uploadResponse.status, uploadResponse.statusText);
    throw new Error(`Failed to upload verification snapshot: ${uploadResponse.status}`);
  }

  console.log('[Identity] ✅ Upload successful');
  return {
    objectKey: presigned.objectKey
  };
}

// Export all functions
export default {
  getIdPhotoUploadUrl,
  confirmIdPhotoUpload,
  getIdPhotoStatus,
  uploadIdPhoto,
  requestVerification,
  getVerificationResult,
  getVerificationHistory,
  waitForVerificationResult,
  captureAndUploadVerificationSnapshot
};
