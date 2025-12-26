import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  requestVerification,
  waitForVerificationResult,
  getIdPhotoStatus,
  type IdentityVerificationResult
} from '../api/identity';

interface IdentityVerificationModalProps {
  sessionId: string;
  isOpen: boolean;
  onVerified: () => void;
  onSkip?: () => void;
  onClose: () => void;
  allowSkip?: boolean;
}

type VerificationStep = 'checking' | 'no-id' | 'capture' | 'verifying' | 'success' | 'failed';

/**
 * Identity Verification Modal
 * 
 * Captures student snapshot and verifies against ID photo before exam starts
 */
export function IdentityVerificationModal({
  sessionId,
  isOpen,
  onVerified,
  onSkip,
  onClose,
  allowSkip = false
}: IdentityVerificationModalProps) {
  const [step, setStep] = useState<VerificationStep>('checking');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IdentityVerificationResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check ID photo status on mount
  useEffect(() => {
    if (!isOpen) return;

    checkIdPhotoStatus();

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  const checkIdPhotoStatus = async () => {
    setStep('checking');
    try {
      const status = await getIdPhotoStatus();

      if (!status.hasPhoto || status.status === 'NOT_UPLOADED') {
        setStep('no-id');
        return;
      }

      if (status.status === 'REJECTED') {
        setError('Your ID photo was rejected. Please upload a new one.');
        setStep('no-id');
        return;
      }

      // ID photo exists, start camera
      await startCamera();
      setStep('capture');
    } catch (err) {
      setError('Failed to check ID photo status');
      setStep('no-id');
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Wait for video to be ready with actual frames
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current!;

          const onLoadedData = () => {
            video.removeEventListener('loadeddata', onLoadedData);
            console.log('[IdentityVerification] Video ready:', video.videoWidth, 'x', video.videoHeight);
            resolve();
          };

          video.addEventListener('loadeddata', onLoadedData);
          video.play().catch(reject);

          // Timeout fallback
          setTimeout(() => {
            video.removeEventListener('loadeddata', onLoadedData);
            resolve();
          }, 3000);
        });
      }
    } catch (err) {
      setError('Failed to access camera. Please allow camera permissions.');
      throw err;
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  };

  const captureSnapshot = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Ensure video has actual frames
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      setError('Camera not ready. Please wait a moment and try again.');
      console.error('[IdentityVerification] Video not ready:', video.videoWidth, video.videoHeight);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame
    ctx.drawImage(video, 0, 0);

    // Get image data URL for preview
    const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedImage(imageDataUrl);

    // Convert to blob and upload
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setError('Failed to capture image');
        return;
      }

      setStep('verifying');

      try {
        // Upload snapshot to MinIO
        const objectKey = await uploadSnapshot(blob);

        // Request verification
        const verifyResponse = await requestVerification({
          sessionId,
          snapshotObjectKey: objectKey
        });

        if (!verifyResponse.success) {
          throw new Error(verifyResponse.message || 'Verification request failed');
        }

        // Wait for result
        const verificationResult = await waitForVerificationResult(sessionId, {
          timeoutMs: 30000,
          pollIntervalMs: 1000
        });

        setResult(verificationResult);

        if (verificationResult.verified) {
          setStep('success');
          // Auto-proceed after short delay
          setTimeout(() => {
            stopCamera();
            onVerified();
          }, 2000);
        } else {
          setStep('failed');
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Verification failed';
        setError(message);
        setStep('failed');
      }
    }, 'image/jpeg', 0.9);
  }, [sessionId, onVerified]);

  const uploadSnapshot = async (blob: Blob): Promise<string> => {
    // Get presigned URL
    const response = await fetch('/api/identity/id-photo/presigned-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({ contentType: 'image/jpeg' })
    });

    if (!response.ok) {
      throw new Error('Failed to get upload URL');
    }

    const presigned = await response.json();

    // Upload to MinIO
    const uploadResponse = await fetch(presigned.uploadUrl, {
      method: 'PUT',
      body: blob,
      headers: {
        'Content-Type': 'image/jpeg'
      }
    });

    if (!uploadResponse.ok) {
      throw new Error('Failed to upload snapshot');
    }

    return presigned.objectKey;
  };

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    setCapturedImage(null);
    setError(null);
    setResult(null);
    setStep('capture');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-lg w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Identity Verification
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Please verify your identity before starting the exam
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Checking status */}
          {step === 'checking' && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                Checking your ID photo status...
              </p>
            </div>
          )}

          {/* No ID photo */}
          {step === 'no-id' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                ID Photo Required
              </h3>
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                {error || 'Please upload your student ID photo before proceeding.'}
              </p>
            </div>
          )}

          {/* Capture step */}
          {step === 'capture' && (
            <div className="space-y-4">
              <div className="relative rounded-lg overflow-hidden bg-black aspect-video">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover mirror"
                  style={{ transform: 'scaleX(-1)' }}
                />
                {/* Face guide overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-56 border-2 border-dashed border-white/50 rounded-full"></div>
                </div>
              </div>
              <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                Position your face within the oval guide and look directly at the camera
              </p>
              <canvas ref={canvasRef} className="hidden" />
            </div>
          )}

          {/* Verifying step */}
          {step === 'verifying' && (
            <div className="space-y-4">
              {capturedImage && (
                <div className="rounded-lg overflow-hidden">
                  <img
                    src={capturedImage}
                    alt="Captured"
                    className="w-full"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                </div>
              )}
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-3 text-gray-600 dark:text-gray-400">
                  Verifying your identity...
                </p>
              </div>
            </div>
          )}

          {/* Success step */}
          {step === 'success' && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-medium text-green-600">
                Identity Verified!
              </h3>
              {result && (
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                  Confidence: {Math.round((result.confidence || 0) * 100)}%
                </p>
              )}
              <p className="mt-2 text-gray-500 dark:text-gray-400">
                Starting exam...
              </p>
            </div>
          )}

          {/* Failed step */}
          {step === 'failed' && (
            <div className="space-y-4">
              {capturedImage && (
                <div className="rounded-lg overflow-hidden">
                  <img
                    src={capturedImage}
                    alt="Captured"
                    className="w-full opacity-50"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                </div>
              )}
              <div className="text-center py-4">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-medium text-red-600">
                  Verification Failed
                </h3>
                <p className="mt-2 text-gray-500 dark:text-gray-400">
                  {error || result?.message || 'Face did not match. Please try again.'}
                </p>
                {result && !result.probeFaceDetected && (
                  <p className="mt-1 text-sm text-gray-500">
                    Tip: Make sure your face is clearly visible and well-lit.
                  </p>
                )}
                {retryCount < 3 && (
                  <p className="mt-1 text-sm text-gray-500">
                    Attempts remaining: {3 - retryCount}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Error display */}
          {error && step !== 'failed' && step !== 'no-id' && (
            <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          {step === 'no-id' && (
            <>
              {allowSkip && onSkip && (
                <button
                  onClick={onSkip}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  Skip for now
                </button>
              )}
              <button
                onClick={() => window.location.href = '/profile'}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Upload ID Photo
              </button>
            </>
          )}

          {step === 'capture' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={captureSnapshot}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Capture & Verify
              </button>
            </>
          )}

          {step === 'failed' && (
            <>
              {allowSkip && onSkip && (
                <button
                  onClick={onSkip}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
                >
                  Skip
                </button>
              )}
              {retryCount < 3 ? (
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Try Again
                </button>
              ) : (
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
                >
                  Contact Support
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default IdentityVerificationModal;
