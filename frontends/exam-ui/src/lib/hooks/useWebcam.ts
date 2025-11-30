import { useEffect, useRef, useState } from 'react';
import cv from '@techstark/opencv-js';

export interface UseWebcamOptions {
  onSnapshot?: (blob: Blob) => void;
  captureInterval?: number; // milliseconds
  enabled?: boolean;
  enableFaceDetection?: boolean; // Client-side face detection preview
}

export const useWebcam = (options: UseWebcamOptions = {}) => {
  const {
    onSnapshot,
    captureInterval = 3000,
    enabled = true,
    enableFaceDetection = false
  } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [cvReady, setCvReady] = useState(false);
  const [faceCount, setFaceCount] = useState<number>(0);

  // Initialize OpenCV
  useEffect(() => {
    if (!enableFaceDetection) {
      setCvReady(true);
      return;
    }

    // Wait for OpenCV to be ready
    if (cv && typeof cv.Mat === 'function') {
      // OpenCV.js is ready
      setCvReady(true);
    } else {
      // Waiting for OpenCV.js to load
      const checkInterval = setInterval(() => {
        if (cv && typeof cv.Mat === 'function') {
          // OpenCV.js loaded
          setCvReady(true);
          clearInterval(checkInterval);
        }
      }, 100);

      return () => clearInterval(checkInterval);
    }
  }, [enableFaceDetection]);

  // Initialize webcam
  useEffect(() => {
    if (!enabled || !cvReady) return;

    const startWebcam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
          audio: false
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
        }
      } catch (error) {
        console.error('Error accessing webcam:', error);
        alert('Cannot access webcam. Please grant camera permissions.');
      }
    };

    startWebcam();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
    };
  }, [enabled, cvReady]);

  // Auto capture snapshots with OpenCV processing
  useEffect(() => {
    if (!enabled || !onSnapshot || !cvReady) return;

    const captureSnapshot = () => {
      if (!videoRef.current) return;

      // Create canvas if not exists
      if (!canvasRef.current) {
        canvasRef.current = document.createElement('canvas');
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Set canvas size to video dimensions
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      // Draw current video frame to canvas using OpenCV
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Process with OpenCV if enabled
      if (enableFaceDetection && cv && typeof cv.Mat === 'function') {
        try {
          // Convert canvas to OpenCV Mat
          const src = cv.imread(canvas);
          const gray = new cv.Mat();
          
          // Convert to grayscale for better face detection
          cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
          
          // Optional: Apply histogram equalization for better contrast
          cv.equalizeHist(gray, gray);
          
          // Detect faces using Haar Cascade (if loaded)
          // Note: You need to load haarcascade_frontalface_default.xml
          // This is a placeholder - actual face detection would require cascade classifier
          
          // For now, we'll just apply some image processing
          // Apply Gaussian blur to reduce noise
          cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);
          
          // Convert back to canvas for display/upload
          cv.imshow(canvas, gray);
          
          // Cleanup OpenCV matrices
          src.delete();
          gray.delete();
          
          // OpenCV image processing applied
        } catch (error) {
          console.error('OpenCV processing error:', error);
          // Fallback to regular canvas if OpenCV fails
        }
      }

      // Convert canvas to blob
      canvas.toBlob(
        (blob: Blob | null) => {
          if (blob) {
            onSnapshot(blob);
          }
        },
        'image/jpeg',
        0.8 // Quality 80%
      );
    };

    // Start interval
    intervalRef.current = setInterval(captureSnapshot, captureInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, onSnapshot, captureInterval, cvReady, enableFaceDetection]);

  return {
    videoRef,
    faceCount,
    cvReady
  };
};