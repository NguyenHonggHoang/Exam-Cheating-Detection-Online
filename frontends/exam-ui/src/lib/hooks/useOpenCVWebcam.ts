import { useEffect, useRef, useState } from 'react';
import cv from '@techstark/opencv-js';

export interface UseOpenCVWebcamOptions {
  onSnapshot?: (blob: Blob, faceCount?: number) => void;
  captureInterval?: number;
  enabled?: boolean;
  enableFaceDetection?: boolean;
  onFaceCountChange?: (count: number) => void;
}

export const useOpenCVWebcam = (options: UseOpenCVWebcamOptions = {}) => {
  const {
    onSnapshot,
    captureInterval = 3000,
    enabled = true,
    enableFaceDetection = true,
    onFaceCountChange
  } = options;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const classifierRef = useRef<any>(null);
  const animationIdRef = useRef<number | null>(null);

  const [cvReady, setCvReady] = useState(false);
  const [faceCount, setFaceCount] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);

  // Initialize OpenCV
  useEffect(() => {
    let isMounted = true;
    
    const initOpenCV = async () => {
      try {
        // Wait for OpenCV to be ready
        if (cv && typeof cv.Mat === 'function') {
          console.log('OpenCV.js is ready');
          
          if (!isMounted) return;
          setCvReady(true);
          
          // Load face cascade classifier if face detection enabled
          if (enableFaceDetection) {
            try {
              const cascadeFile = '/haarcascade_frontalface_default.xml';
              
              // Load cascade from URL
              const response = await fetch(cascadeFile);
              if (!response.ok) {
                throw new Error('Failed to fetch cascade file');
              }
              
              const buffer = await response.arrayBuffer();
              const data = new Uint8Array(buffer);
              
              // Create file in OpenCV virtual filesystem
              // @ts-ignore - OpenCV FS methods not in type definitions
              const cvFS = cv.FS;
              
              try {
                // Try to delete existing file
                if (cvFS && typeof cvFS.unlink === 'function') {
                  cvFS.unlink('/haarcascade_frontalface_default.xml');
                }
              } catch (e) {
                // File doesn't exist yet, ignore
              }
              
              // @ts-ignore - FS_createDataFile not in type definitions
              if (cv.FS_createDataFile) {
                cv.FS_createDataFile('/', 'haarcascade_frontalface_default.xml', data, true, false, false);
              } else {
                throw new Error('OpenCV filesystem not available');
              }
              
              // Create and load classifier
              const classifier = new cv.CascadeClassifier();
              const success = classifier.load('haarcascade_frontalface_default.xml');
              
              if (success && isMounted) {
                classifierRef.current = classifier;
                console.log('Face cascade classifier loaded');
              } else {
                throw new Error('Failed to load cascade classifier');
              }
            } catch (err) {
              console.warn('Face detection cascade not loaded:', err);
              if (isMounted) {
                setError('Face detection unavailable');
              }
            }
          }
        } else {
          // OpenCV not ready yet, wait
          setTimeout(initOpenCV, 100);
        }
      } catch (err) {
        console.error('Error initializing OpenCV:', err);
        if (isMounted) {
          setError('Failed to initialize OpenCV');
        }
      }
    };

    initOpenCV();

    return () => {
      isMounted = false;
      // Don't delete classifier here - will be handled when component fully unmounts
    };
  }, [enableFaceDetection]);

  // Initialize webcam
  useEffect(() => {
    if (!enabled || !cvReady) return;

    let isMounted = true;

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

        if (!isMounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          
          // Wait for video to be loaded
          videoRef.current.onloadedmetadata = () => {
            console.log('Video metadata loaded:', {
              width: videoRef.current?.videoWidth,
              height: videoRef.current?.videoHeight,
              readyState: videoRef.current?.readyState
            });
          };
          
          // Ensure video plays
          videoRef.current.play().catch((e: Error) => {
            console.error('Error playing video:', e);
          });
        }
      } catch (error) {
        console.error('Error accessing webcam:', error);
        if (isMounted) {
          setError('Cannot access webcam');
          alert('Cannot access webcam. Please grant camera permissions.');
        }
      }
    };

    startWebcam();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
    };
  }, [enabled, cvReady]);

  // Continuous canvas update for live preview
  useEffect(() => {
    if (!enabled || !cvReady) return;

    let isMounted = true;
    
    const updateCanvas = () => {
      if (!isMounted || !videoRef.current || !canvasRef.current) {
        return;
      }

      const video = videoRef.current;
      const canvas = canvasRef.current;

      // Only process if video is ready
      if (video.readyState < video.HAVE_CURRENT_DATA) {
        animationIdRef.current = requestAnimationFrame(updateCanvas);
        return;
      }

      // Set canvas size to match video (only once when dimensions change)
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      
      if (canvas.width !== vw || canvas.height !== vh) {
        canvas.width = vw;
        canvas.height = vh;
        console.log(`Canvas sized to ${vw}x${vh}`);
      }

      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        animationIdRef.current = requestAnimationFrame(updateCanvas);
        return;
      }

      // Clear canvas first
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Draw video frame to canvas
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      } catch (e) {
        console.error('Error drawing video to canvas:', e);
        animationIdRef.current = requestAnimationFrame(updateCanvas);
        return;
      }

      // Process with OpenCV if enabled and classifier is ready
      if (enableFaceDetection && cv && typeof cv.Mat === 'function' && classifierRef.current) {
        let src: any = null;
        let gray: any = null;
        let faces: any = null;

        try {
          // Verify classifier is still valid
          if (!classifierRef.current || typeof classifierRef.current.detectMultiScale !== 'function') {
            // Classifier not ready, skip face detection but keep video feed
            animationIdRef.current = requestAnimationFrame(updateCanvas);
            return;
          }

          // Read from canvas
          src = cv.imread(canvas);
          gray = new cv.Mat();
          
          // Convert to grayscale
          cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY, 0);
          
          // Enhance
          cv.equalizeHist(gray, gray);

          // Detect faces
          faces = new cv.RectVector();
          const msize = new cv.Size(30, 30); // Min face size
          
          classifierRef.current.detectMultiScale(
            gray,
            faces,
            1.1,
            3,
            0,
            msize,
            new cv.Size(0, 0)
          );

          const detectedFaces = faces.size();
          if (isMounted) {
            setFaceCount(detectedFaces);
          }

          // Draw rectangles on canvas directly (don't use imshow to avoid overwriting)
          ctx.strokeStyle = '#00FF00';
          ctx.lineWidth = 2;
          
          for (let i = 0; i < faces.size(); i++) {
            const face = faces.get(i);
            ctx.strokeRect(face.x, face.y, face.width, face.height);
          }

        } catch (error) {
          console.error('OpenCV processing error:', error);
          // Continue showing video even if face detection fails
        } finally {
          // Cleanup OpenCV objects
          try {
            if (src) src.delete();
            if (gray) gray.delete();
            if (faces) faces.delete();
          } catch (e) {
            // Ignore cleanup errors
          }
        }
      }

      if (isMounted) {
        animationIdRef.current = requestAnimationFrame(updateCanvas);
      }
    };

    // Wait a bit for video to be ready
    const startTimeout = setTimeout(() => {
      animationIdRef.current = requestAnimationFrame(updateCanvas);
    }, 500);

    return () => {
      isMounted = false;
      clearTimeout(startTimeout);
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
        animationIdRef.current = null;
      }
    };
  }, [enabled, cvReady, enableFaceDetection]);

  // Capture snapshots at intervals
  useEffect(() => {
    if (!enabled || !onSnapshot || !cvReady) return;

    const captureSnapshot = () => {
      if (!canvasRef.current) return;

      const canvas = canvasRef.current;

      // Convert current canvas to blob
      canvas.toBlob(
        (blob: Blob | null) => {
          if (blob) {
            onSnapshot(blob, faceCount);
            if (onFaceCountChange && faceCount !== undefined) {
              onFaceCountChange(faceCount);
            }
            console.log(`Detected ${faceCount} face(s)`);
          }
        },
        'image/jpeg',
        0.85
      );
    };

    // Start interval
    intervalRef.current = setInterval(captureSnapshot, captureInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, onSnapshot, captureInterval, cvReady, faceCount, onFaceCountChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clean up animation frame
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      
      // Clean up interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      
      // Clean up camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      
      // Clean up classifier
      if (classifierRef.current) {
        try {
          classifierRef.current.delete();
          classifierRef.current = null;
        } catch (e) {
          // Ignore errors during cleanup
        }
      }
    };
  }, []);

  return {
    videoRef,
    canvasRef,
    faceCount,
    cvReady,
    error
  };
};