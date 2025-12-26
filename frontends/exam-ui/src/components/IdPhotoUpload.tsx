import React, { useState, useRef, useCallback } from 'react';
import { uploadIdPhoto, getIdPhotoStatus, type StudentIdPhotoStatus } from '../api/identity';

interface IdPhotoUploadProps {
  onUploadSuccess?: (photoId: string) => void;
  onUploadError?: (error: Error) => void;
}

/**
 * Student ID Photo Upload Component
 * 
 * Allows students to upload their ID card photo for identity verification
 */
export function IdPhotoUpload({ onUploadSuccess, onUploadError }: IdPhotoUploadProps) {
  const [status, setStatus] = useState<StudentIdPhotoStatus | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load current status on mount
  React.useEffect(() => {
    getIdPhotoStatus()
      .then(setStatus)
      .catch(console.error);
  }, []);

  const handleFileSelect = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError('File size must be less than 10MB');
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);

    setError(null);
    setUploading(true);

    try {
      const result = await uploadIdPhoto(file);
      setStatus({
        hasPhoto: true,
        photoId: result.photoId,
        status: 'PENDING',
        message: 'Photo uploaded. Pending verification.'
      });
      onUploadSuccess?.(result.photoId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed';
      setError(errorMessage);
      onUploadError?.(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setUploading(false);
    }
  }, [onUploadSuccess, onUploadError]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (file && fileInputRef.current) {
      // Create a new DataTransfer to set files
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInputRef.current.files = dt.files;
      handleFileSelect({ target: fileInputRef.current } as React.ChangeEvent<HTMLInputElement>);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  }, []);

  const getStatusBadge = () => {
    if (!status) return null;
    
    const badges = {
      'NOT_UPLOADED': { color: 'bg-gray-500', text: 'Not Uploaded' },
      'PENDING': { color: 'bg-yellow-500', text: 'Pending Verification' },
      'VERIFIED': { color: 'bg-green-500', text: 'Verified' },
      'REJECTED': { color: 'bg-red-500', text: 'Rejected' }
    };

    const badge = badges[status.status] || badges['NOT_UPLOADED'];
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium text-white ${badge.color}`}>
        {badge.text}
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Student ID Photo
        </h3>
        {getStatusBadge()}
      </div>

      {status?.status === 'REJECTED' && status.rejectionReason && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">
            <strong>Rejection reason:</strong> {status.rejectionReason}
          </p>
          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
            Please upload a new photo that meets the requirements.
          </p>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-blue-500 transition-colors"
      >
        {preview ? (
          <div className="space-y-4">
            <img
              src={preview}
              alt="ID Photo Preview"
              className="max-w-xs mx-auto rounded-lg shadow"
            />
            {status?.status === 'VERIFIED' ? (
              <p className="text-green-600 dark:text-green-400">
                ✓ Your ID photo has been verified
              </p>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Change Photo'}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="text-gray-500 dark:text-gray-400">
              <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="mt-2 text-sm">
                Drag and drop your student ID photo here, or click to browse
              </p>
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {uploading ? 'Uploading...' : 'Select Photo'}
            </button>
          </div>
        )}
        
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        <p className="font-medium mb-1">Photo requirements:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Clear photo of your student ID card</li>
          <li>Face must be clearly visible</li>
          <li>Good lighting, no glare</li>
          <li>Maximum file size: 10MB</li>
          <li>Supported formats: JPEG, PNG</li>
        </ul>
      </div>
    </div>
  );
}

export default IdPhotoUpload;
