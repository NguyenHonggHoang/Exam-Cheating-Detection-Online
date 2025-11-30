import { useState, useRef, useCallback, useEffect } from 'react';

export interface WebcamCaptureOptions {
  width?: number;
  height?: number;
  quality?: number;
  facingMode?: 'user' | 'environment';
}

export const useWebcam = (options: WebcamCaptureOptions = {}) => {
  const {
    width = 640,
    height = 480,
    quality = 0.8,
    facingMode = 'user',
  } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startWebcam = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: width },
          height: { ideal: height },
          facingMode,
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsActive(true);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to access webcam';
      setError(errorMessage);
      console.error('Webcam error:', err);
    }
  }, [width, height, facingMode]);

  const stopWebcam = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
  }, []);

  const captureSnapshot = useCallback((): string | null => {
    if (!videoRef.current || !isActive) {
      return null;
    }

    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }

    ctx.drawImage(videoRef.current, 0, 0, width, height);
    const dataUrl = canvas.toDataURL('image/jpeg', quality);

    canvasRef.current = canvas;
    return dataUrl;
  }, [isActive, width, height, quality]);

  useEffect(() => {
    return () => {
      stopWebcam();
    };
  }, [stopWebcam]);

  return {
    videoRef,
    isActive,
    error,
    startWebcam,
    stopWebcam,
    captureSnapshot,
  };
};
