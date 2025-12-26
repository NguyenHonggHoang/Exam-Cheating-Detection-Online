import { useState, useCallback } from 'react';

export interface PresignedUploadOptions {
    onProgress?: (progress: number) => void;
    onSuccess?: (url: string) => void;
    onError?: (error: Error) => void;
}

export interface PresignedUrlResponse {
    uploadUrl: string;
    publicUrl: string;
    expiresIn: number;
}

/**
 * Hook for uploading files using MinIO presigned URLs
 * 
 * Flow:
 * 1. Request presigned URL from backend
 * 2. Upload file directly to MinIO using PUT
 * 3. Return public URL for access
 */
export function usePresignedUpload() {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<Error | null>(null);

    /**
     * Request a presigned upload URL from the backend
     */
    const getPresignedUrl = useCallback(async (
        type: 'snapshot' | 'clip' | 'identity',
        sessionId?: string
    ): Promise<PresignedUrlResponse> => {
        const params = new URLSearchParams({
            type,
            ...(sessionId && { sessionId })
        });

        const response = await fetch(`/api/storage/presigned-url?${params}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to get presigned URL: ${response.statusText}`);
        }

        return response.json();
    }, []);

    /**
     * Upload file directly to MinIO using presigned URL
     */
    const uploadFile = useCallback(async (
        blob: Blob,
        type: 'snapshot' | 'clip' | 'identity',
        sessionId?: string,
        options?: PresignedUploadOptions
    ): Promise<string> => {
        setUploading(true);
        setProgress(0);
        setError(null);

        try {
            // Step 1: Get presigned URL
            const { uploadUrl, publicUrl } = await getPresignedUrl(type, sessionId);

            // Step 2: Upload directly to MinIO
            const xhr = new XMLHttpRequest();

            return new Promise((resolve, reject) => {
                // Progress tracking
                xhr.upload.addEventListener('progress', (e) => {
                    if (e.lengthComputable) {
                        const percentComplete = (e.loaded / e.total) * 100;
                        setProgress(percentComplete);
                        options?.onProgress?.(percentComplete);
                    }
                });

                // Success
                xhr.addEventListener('load', () => {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        setUploading(false);
                        setProgress(100);
                        options?.onSuccess?.(publicUrl);
                        resolve(publicUrl);
                    } else {
                        const err = new Error(`Upload failed: ${xhr.statusText}`);
                        setError(err);
                        setUploading(false);
                        options?.onError?.(err);
                        reject(err);
                    }
                });

                // Error
                xhr.addEventListener('error', () => {
                    const err = new Error('Upload failed: Network error');
                    setError(err);
                    setUploading(false);
                    options?.onError?.(err);
                    reject(err);
                });

                // Send PUT request to MinIO
                xhr.open('PUT', uploadUrl);
                xhr.setRequestHeader('Content-Type', blob.type || 'application/octet-stream');
                xhr.send(blob);
            });
        } catch (err) {
            const error = err as Error;
            setError(error);
            setUploading(false);
            options?.onError?.(error);
            throw error;
        }
    }, [getPresignedUrl]);

    /**
     * Capture canvas and upload as snapshot
     */
    const uploadCanvas = useCallback(async (
        canvas: HTMLCanvasElement,
        sessionId: string,
        options?: PresignedUploadOptions
    ): Promise<string> => {
        return new Promise((resolve, reject) => {
            canvas.toBlob(async (blob) => {
                if (!blob) {
                    reject(new Error('Failed to create blob from canvas'));
                    return;
                }

                try {
                    const url = await uploadFile(blob, 'snapshot', sessionId, options);
                    resolve(url);
                } catch (error) {
                    reject(error);
                }
            }, 'image/jpeg', 0.85);
        });
    }, [uploadFile]);

    return {
        uploading,
        progress,
        error,
        uploadFile,
        uploadCanvas,
        getPresignedUrl
    };
}
