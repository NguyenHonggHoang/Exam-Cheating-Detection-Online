import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { examsApi } from '@/api/exams';
import { useSEBContext } from '@/lib/hooks/useSEBContext';
import { mockExamApi, type Question, type SubmitAnswer } from '@/api/mockExam';
import { sessionsApi } from '@/api/sessions';
import { incidentsApi } from '@/api/incidents';
import { useSharedStream } from '@/lib/hooks/useSharedStream';
import { useLiveKitToken } from '@/lib/hooks/useLiveKitToken';
import { useOptimizedDetection } from '@/lib/hooks/useOptimizedDetection';
import { useAnswerBehavior, type BehaviorAnomaly } from '@/lib/hooks/useAnswerBehavior';
import { useEventDetection, type EventType } from '@/lib/hooks/useEventDetection';
import { useServerTimer } from '@/lib/hooks/useServerTimer';
import { useAIViolationNotifications, type AIViolationNotification } from '@/lib/hooks/useWebSocket';
import { useWindowMonitor } from '@/lib/hooks/useWindowMonitor';
import { useAntiScreenshot } from '@/lib/hooks/useAntiScreenshot';
import { useHeartbeat } from '@/lib/hooks/useHeartbeat';
import { useIdleDetection } from '@/lib/hooks/useIdleDetection';
import { usePerQuestionTimer } from '@/lib/hooks/usePerQuestionTimer';
import { compositeDetector, type CompositeViolation } from '@/lib/utils/compositeViolationDetector';
import { triggerEgressRecording } from '@/lib/utils/minioUpload';
import { getViolationWarningMessage, isCriticalViolation } from '@/lib/utils/violationLabels';
import { useAuth } from '@/auth/AuthContext';
import { ExamRoom } from '@/components/ExamRoom';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Label } from '@/ui/label';
import { RadioGroup, RadioGroupItem } from '@/ui/radio-group';
import { Textarea } from '@/ui/textarea';
import { Alert, AlertDescription } from '@/ui/alert';
import { AlertTriangle, Camera, Clock, Eye, Wifi, WifiOff, XCircle, AlertOctagon, ChevronLeft, ChevronRight, Grid, Check } from 'lucide-react';

/**
 * MockExamPage - STATE-BASED Question Navigation
 * 
 * KEY CHANGE: Uses useState for currentQuestionIndex (NOT URL)
 * This prevents component remount when changing questions
 * and keeps LiveKit connection stable
 */
export const MockExamPage = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { isInSEB } = useSEBContext();

  // STATE-BASED navigation to prevent remount
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(() => {
    if (examId) {
      const stored = sessionStorage.getItem(`exam_question_index_${examId}`);
      return stored ? parseInt(stored, 10) : 0;
    }
    return 0;
  });

  // State
  const [loading, setLoading] = useState(true);  // Only for initial exam load
  const [isQuestionLoading, setIsQuestionLoading] = useState(false);  // For question navigation (doesn't trigger early return)
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [examName, setExamName] = useState('');
  const [examDuration, setExamDuration] = useState(45);
  const [examStartedAt, setExamStartedAt] = useState<string | null>(null);

  // Current question data
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [totalQuestions, setTotalQuestions] = useState(0);

  // Answers stored in sessionStorage for persistence across navigation
  // Initialize from sessionStorage to persist across URL changes
  const [answers, setAnswers] = useState<Record<string, string>>(() => {
    if (examId) {
      const storedAnswers = sessionStorage.getItem(`exam_answers_${examId}`);
      if (storedAnswers) {
        try {
          const parsed = JSON.parse(storedAnswers);
          console.log(`[Answers] Loaded ${Object.keys(parsed).length} answers from sessionStorage:`, parsed);
          return parsed;
        } catch {
          return {};
        }
      }
    }
    console.log(`[Answers] No stored answers found for exam ${examId}`);
    return {};
  });
  const [showQuestionNav, setShowQuestionNav] = useState(false);
  const [violations, setViolations] = useState<{ type: EventType; time: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [liveKitConnected, setLiveKitConnected] = useState(false);

  // Violation warning state
  const [currentViolation, setCurrentViolation] = useState<{
    type: EventType;
    severity: string;
    message: string;
  } | null>(null);
  const [showWarningOverlay, setShowWarningOverlay] = useState(false);

  // Fullscreen enforcement state
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenRequested, setFullscreenRequested] = useState(false);
  const [showFullscreenPrompt, setShowFullscreenPrompt] = useState(true);

  // Shared stream (single getUserMedia call)
  const { streams, isReady: streamReady, error: streamError, retry: retryStream } = useSharedStream({
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      facingMode: 'user',
      frameRate: { ideal: 30 }
    },
    audio: true,
    enabled: !!sessionId && !submitting
  });

  // LiveKit token
  const { data: livekitData, loading: livekitLoading, error: livekitError } = useLiveKitToken(sessionId);

  // Optimized TensorFlow detection
  const {
    videoRef,  // Hidden video element ref - REQUIRED for stream
    displayCanvasRef,
    inferenceCanvasRef,
    detectionResult,
    uploading,
    bufferStatus,
    tfReady,
    error: tfError,
    preSuspicion, // Destructure preSuspicion
    captureSnapshot // Destructure captureSnapshot
  } = useOptimizedDetection({
    sessionId: sessionId || '',
    stream: streams.tensorflow,
    roomName: (() => {
      const room = sessionId; // LiveKit room name is sessionId
      console.log('[DEBUG] MockExamPage passing roomName to Detect:', room);
      return room || undefined;
    })(),
    useEgress: true,  // Enable server-side video recording via LiveKit Egress
    enablePreSuspicion: true, // Enable pre-suspicion detection (phone-prep patterns)
    enabled: !!sessionId && streamReady && !submitting,
    config: {
      mode: 'balanced',
      enabledViolations: ['MULTIPLE_FACES', 'NO_FACE', 'LOOKING_AWAY', 'TAB_SWITCH']
    },
    onViolation: (type, severity) => {
      console.log(`[Detection] Violation state changed: ${type} â†’ ${severity}`);

      // Only add to violation list if severity is WARN or higher
      if (severity !== 'OK') {
        setViolations(prev => {
          // Avoid duplicates in short time window
          const lastSame = prev.filter(v => v.type === type).slice(-1)[0];
          if (lastSame) {
            const lastTime = new Date(`1970-01-01 ${lastSame.time}`).getTime();
            const now = new Date(`1970-01-01 ${new Date().toLocaleTimeString()}`).getTime();
            if (now - lastTime < 5000) return prev; // Skip if last same violation < 5s ago
          }
          return [...prev, {
            type: type as EventType,
            time: new Date().toLocaleTimeString()
          }];
        });
      }

      // Show warning overlay for serious violations
      // Use centralized Vietnamese warning messages
      const message = getViolationWarningMessage(type);

      // Show overlay for WARN, SUSPICIOUS, or ESCALATED
      if (severity !== 'OK') {
        setCurrentViolation({
          type: type as EventType,
          severity,
          message
        });
        setShowWarningOverlay(true);

        // Critical violations (like SCREENSHOT_ATTEMPT) should stay visible until acknowledged
        // NO_FACE should stay visible until camera is back (no auto-hide)
        // Other violations auto-hide based on severity
        if (type !== 'NO_FACE' && !isCriticalViolation(type)) {
          const hideDelay = severity === 'WARN' ? 3000 : severity === 'SUSPICIOUS' ? 5000 : 0;
          if (hideDelay > 0) {
            setTimeout(() => {
              // Only hide if still showing this same violation
              setCurrentViolation(prev => {
                if (prev?.type === type) {
                  setShowWarningOverlay(false);
                  return null;
                }
                return prev;
              });
            }, hideDelay);
          }
        }
        // For NO_FACE at ESCALATED level, warning stays until face is detected
        // For critical violations, warning stays until acknowledged
      }
    },
    onEvidenceUploaded: (type, url) => {
      console.log(`[Evidence] Uploaded: ${type} â†’ ${url}`);
    }
  });






  // Answer behavior tracking for pattern analysis
  const answerBehavior = useAnswerBehavior({
    sessionId: sessionId || '',
    examId: examId || '',
    enabled: !!sessionId && !submitting,
    onAnomalyDetected: (anomalies: BehaviorAnomaly[]) => {
      console.log('[AnswerBehavior] Anomalies detected:', anomalies);
      // Report medium and high severity anomalies to proctor
      const reportableAnomalies = anomalies.filter(a => a.severity === 'high' || a.severity === 'medium');
      if (reportableAnomalies.length > 0 && sessionId) {
        incidentsApi.sendClientEvent({
          sessionId,
          eventType: 'ANSWER_BEHAVIOR_ANOMALY',
          violationType: 'BEHAVIOR_ANALYSIS' as any,
          violationState: reportableAnomalies.some(a => a.severity === 'high') ? 'HIGH' : 'MEDIUM',
          timestamp: Date.now(),
          source: 'ANSWER_BEHAVIOR_ANALYZER',
          metadata: {
            anomalies: reportableAnomalies,
            totalAnomalies: anomalies.length,
            highSeverityCount: anomalies.filter(a => a.severity === 'high').length,
          }
        }).catch(err => console.error('Failed to report answer anomaly:', err));
      }
    },
    onRiskScoreChange: (score: number) => {
      console.log('[AnswerBehavior] Risk score changed:', score);
      // Report significant risk score changes (above 50%) to proctor
      if (score >= 50 && sessionId) {
        incidentsApi.sendClientEvent({
          sessionId,
          eventType: 'BEHAVIOR_RISK_SCORE',
          violationType: 'BEHAVIOR_ANALYSIS' as any,
          violationState: score >= 70 ? 'HIGH' : 'MEDIUM',
          timestamp: Date.now(),
          source: 'ANSWER_BEHAVIOR_ANALYZER',
          metadata: { riskScore: score }
        }).catch(err => console.error('Failed to report risk score:', err));
      }
    }
  });



  // Anti-Screenshot Protection
  useAntiScreenshot({
    enabled: !!sessionId,
    onScreenshotAttempt: () => {
      console.warn('[Security] Screenshot attempt detected');

      // Show warning overlay with Vietnamese message
      setCurrentViolation({
        type: 'SCREENSHOT_ATTEMPT' as EventType,
        severity: 'HIGH',
        message: getViolationWarningMessage('SCREENSHOT_ATTEMPT')
      });
      setShowWarningOverlay(true);

      // Report incident
      if (sessionId) {
        incidentsApi.sendClientEvent({
          sessionId,
          eventType: 'SCREENSHOT_ATTEMPT',
          violationType: 'SCREEN_CAPTURE' as any,
          violationState: 'HIGH',
          timestamp: Date.now(),
          source: 'ANTI_SCREENSHOT'
        }).catch(err => console.error('Failed to report screenshot attempt:', err));
      }

      // Critical violations stay visible until acknowledged (no auto-hide)
    }
  });

  // Idle Detection removed as per user request
  // const idle = useIdleDetection({ ... });

  // Session Heartbeat
  useHeartbeat({
    sessionId: sessionId || '',
    enabled: !!sessionId,
    onSessionLocked: (reason) => {
      alert(`Exam session locked: ${reason}`);
      navigate('/');
    },
    onError: (err) => {
      console.error('[Heartbeat] Failed:', err);
    }
  });

  // Track question start times in a ref to persist across re-renders
  const questionStartTimes = useRef<{ [key: string]: number }>({});

  // Initialize start time for current question if not exists
  if (currentQuestion && !questionStartTimes.current[currentQuestion.id]) {
    questionStartTimes.current[currentQuestion.id] = Date.now();
  }

  // Per-Question Timer (Default 5 minutes heuristic since data lacks limits)
  const questionTimer = usePerQuestionTimer({
    enabled: !!currentQuestion && !loading,
    timeLimitSeconds: 300, // 5 minutes soft limit
    startedAtEpochMs: currentQuestion ? (questionStartTimes.current[currentQuestion.id] || Date.now()) : Date.now(),
    onTimeUp: () => {
      // Soft warning only
      if (currentQuestionIndex === totalQuestions - 1) return;
      console.log('[Timer] Question time soft limit reached');
    }
  });

  // Track typing speed
  const lastTypingRef = useRef<{ [key: string]: { time: number; length: number } }>({});

  // Track pre-suspicion flag for each question
  const preSuspicionDuringCurrentRef = useRef<boolean>(false);

  // Auto-hide warning when face is back or looking straight
  useEffect(() => {
    if (!detectionResult || !currentViolation) return;

    // If current violation is NO_FACE and face is back
    if (currentViolation.type === 'NO_FACE' && detectionResult.faceCount === 1) {
      setShowWarningOverlay(false);
      setCurrentViolation(null);
    }

    // If current violation is LOOKING_AWAY and now looking straight
    if (currentViolation.type === 'LOOKING_AWAY' && detectionResult.headPose) {
      const { pitch, yaw } = detectionResult.headPose;
      if (Math.abs(pitch) < 20 && Math.abs(yaw) < 25) {
        setShowWarningOverlay(false);
        setCurrentViolation(null);
      }
    }
  }, [detectionResult, currentViolation]);

  // Fullscreen enforcement - request fullscreen when exam loads
  useEffect(() => {
    if (loading || !sessionId || submitting) return;

    const requestFullscreen = async () => {
      const elem = document.documentElement;
      try {
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if ((elem as any).webkitRequestFullscreen) {
          await (elem as any).webkitRequestFullscreen();
        } else if ((elem as any).msRequestFullscreen) {
          await (elem as any).msRequestFullscreen();
        }
        setIsFullscreen(true);
        setFullscreenRequested(true);
        setShowFullscreenPrompt(false);
        console.log('[Fullscreen] Entered fullscreen mode');
      } catch (err) {
        console.warn('[Fullscreen] Could not enter fullscreen:', err);
        // Will show prompt to user
      }
    };

    // Fullscreen change handler
    const handleFullscreenChange = () => {
      const isNowFullscreen = !!document.fullscreenElement;
      setIsFullscreen(isNowFullscreen);

      if (!isNowFullscreen && fullscreenRequested && !submitting) {
        console.warn('[Fullscreen] User exited fullscreen - violation!');

        // Record violation
        setCurrentViolation({
          type: 'BLUR' as EventType,
          severity: 'SUSPICIOUS',
          message: 'Fullscreen mode exited! Please return to fullscreen mode to continue the exam.'
        });
        setShowWarningOverlay(true);
        setShowFullscreenPrompt(true);

        // Record event for composite detection
        compositeDetector.recordEvent('FULLSCREEN_EXIT');

        setViolations(prev => [...prev, {
          type: 'BLUR' as EventType,
          time: new Date().toLocaleTimeString()
        }]);

        // Send to backend
        if (sessionId) {
          incidentsApi.sendClientEvent({
            sessionId,
            eventType: 'FULLSCREEN_EXIT',
            violationType: 'BEHAVIOR_ANALYSIS' as any,
            timestamp: Date.now(),
            source: 'FULLSCREEN_MONITOR'
          }).catch(err => console.error('Failed to report fullscreen exit:', err));
        }
      }
    };

    // Auto-request fullscreen on load (after a short delay)
    const timeout = setTimeout(() => {
      if (!document.fullscreenElement) {
        requestFullscreen();
      }
    }, 500);

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [loading, sessionId, fullscreenRequested, submitting]);

  // Function to request fullscreen (for UI button)
  const enterFullscreen = async () => {
    const elem = document.documentElement;
    try {
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if ((elem as any).webkitRequestFullscreen) {
        await (elem as any).webkitRequestFullscreen();
      }
      setIsFullscreen(true);
      setFullscreenRequested(true);
      setShowFullscreenPrompt(false);
    } catch (err) {
      console.error('[Fullscreen] Failed to enter fullscreen:', err);
    }
  };

  // Initialize exam session (only once)
  useEffect(() => {
    const initExam = async () => {
      if (!examId || !user) return;

      try {
        // Check if session already exists in sessionStorage
        const storedSessionId = sessionStorage.getItem(`exam_session_${examId}`);
        const storedExamData = sessionStorage.getItem(`exam_data_${examId}`);

        if (storedSessionId && storedExamData) {
          // Resume existing session
          const examData = JSON.parse(storedExamData);
          setSessionId(storedSessionId);
          setExamName(examData.examName);
          setExamDuration(examData.durationMinutes);
          setExamStartedAt(examData.startedAt);
          setTotalQuestions(examData.totalQuestions);

          // Load answers from sessionStorage
          const storedAnswers = sessionStorage.getItem(`exam_answers_${examId}`);
          if (storedAnswers) {
            setAnswers(JSON.parse(storedAnswers));
          }

          console.log('[Exam] Resumed session:', storedSessionId);
        } else {
          // Start new session
          const sessionResponse = await mockExamApi.startSession({
            examId,
            userId: user.id
          });

          setSessionId(sessionResponse.sessionId);
          setExamName(sessionResponse.examName);
          setExamDuration(sessionResponse.durationMinutes || 45);
          setExamStartedAt(sessionResponse.startedAt);

          // Get total questions count (we need this for navigation)
          const questionsResponse = await mockExamApi.getQuestions(examId);
          setTotalQuestions(questionsResponse.questions.length);

          // Store session info in sessionStorage
          sessionStorage.setItem(`exam_session_${examId}`, sessionResponse.sessionId);
          sessionStorage.setItem(`exam_data_${examId}`, JSON.stringify({
            examName: sessionResponse.examName,
            durationMinutes: sessionResponse.durationMinutes,
            startedAt: sessionResponse.startedAt,
            totalQuestions: questionsResponse.questions.length
          }));

          console.log('[Exam] Started new session:', sessionResponse.sessionId);
        }
      } catch (error) {
        console.error('Error initializing exam:', error);
        alert('Failed to start exam. Please try again.');
        navigate('/');
      }
    };

    initExam();
  }, [examId, user, navigate]);

  // Load current question when questionIndex changes
  useEffect(() => {
    const loadQuestion = async () => {
      if (!examId || !sessionId) return;

      // Use isQuestionLoading (not loading) to prevent early return which unmounts ExamRoom
      setIsQuestionLoading(true);
      try {
        const response = await mockExamApi.getQuestion(examId, currentQuestionIndex);
        setCurrentQuestion(response.question);
        setTotalQuestions(response.totalQuestions);

        // Start tracking this question ONLY if not already tracked
        // This prevents resetting the timer when user navigates back to a question
        const allAnswerEvents = answerBehavior.getAnswers();
        const alreadyTracked = allAnswerEvents.some(event => event.questionId === response.question.id);

        if (!alreadyTracked) {
          answerBehavior.startQuestion(response.question.id);
          console.log(`[Question] Started tracking question ${currentQuestionIndex + 1}/${response.totalQuestions}`);
        } else {
          console.log(`[Question] Question ${currentQuestionIndex + 1} already tracked - preserving timer`);
        }

        console.log(`[Question] Loaded question ${currentQuestionIndex + 1}/${response.totalQuestions}`);

        // Clear initial loading state (only on first question load)
        if (loading) {
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading question:', error);
        alert('Failed to load question. Please try again.');
      } finally {
        setIsQuestionLoading(false);
      }
    };

    loadQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Note: answerBehavior deliberately excluded - it changes reference due to inline callbacks
    // but its methods (getAnswers, startQuestion) are stable
  }, [examId, sessionId, currentQuestionIndex]);

  // Save answers to sessionStorage whenever they change
  useEffect(() => {
    if (examId && Object.keys(answers).length > 0) {
      sessionStorage.setItem(`exam_answers_${examId}`, JSON.stringify(answers));
    }
  }, [answers, examId]);

  // Timer
  const handleTimeUp = async () => {
    await handleSubmit(true);
  };

  // SEB Enforcement Gatekeeper - Strict State Based
  // MOVED ABOVE useServerTimer to avoid temporal dead zone
  const [sebVerification, setSebVerification] = useState<'CHECKING' | 'AUTHORIZED' | 'UNAUTHORIZED'>('CHECKING');
  const isAuthorized = sebVerification === 'AUTHORIZED';

  const { formatTime, secondsLeft, isWarning, isCritical, progressPercent } = useServerTimer({
    serverStartedAt: examStartedAt,
    durationMinutes: examDuration,
    onTimeUp: handleTimeUp,
    enabled: isAuthorized && !loading && !!sessionId && !submitting
  });

  // SEB verification effect (state declared above)
  useEffect(() => {
    if (!examId) return;

    const checkSebRequirement = async () => {
      try {
        const exam = await examsApi.getById(examId);
        // If SEB is required AND we are NOT in SEB => UNAUTHORIZED
        if (exam.browserMode === 'SEB_REQUIRED' && !isInSEB) {
          console.warn('[SEB] Ejecting user: Exam requires SEB but not detected');
          setSebVerification('UNAUTHORIZED');
        } else {
          setSebVerification('AUTHORIZED');
        }
      } catch (err) {
        console.error('Failed to verify exam config:', err);
        // Default to unauthorized on error for safety
        setSebVerification('UNAUTHORIZED');
      }
    };

    checkSebRequirement();
  }, [examId, isInSEB]);

  // Event detection (tab switch, paste, blur, focus)
  const handleBrowserEvent = async (eventType: EventType) => {
    if (!sessionId) return;

    try {
      // Send to Incident Service
      await incidentsApi.sendClientEvent({
        sessionId,
        eventType: `EVIDENCE_${eventType}`,
        violationType: eventType as any,
        timestamp: Date.now(),
        source: 'BROWSER_EVENT'
      });

      setViolations(prev => [...prev, {
        type: eventType,
        time: new Date().toLocaleTimeString()
      }]);
    } catch (error) {
      console.error('Error sending event:', error);
    }
  };


  useEventDetection({
    sessionId,
    onEvent: (eventType) => {
      handleBrowserEvent(eventType);

      // Track for temporal analysis
      // Note: These methods exist in useTemporalAnalysis but TS cache may need refresh
      if (eventType === 'TAB_SWITCH') {
        (preSuspicion.temporal as any).recordTabSwitch?.();
        preSuspicion.temporal.recordMicroPause(2000);
        compositeDetector.recordEvent('TAB_SWITCH');
      } else if (eventType === 'BLUR') {
        (preSuspicion.temporal as any).recordBlur?.();
        compositeDetector.recordEvent('BLUR');
      } else if (eventType === 'FOCUS') {
        (preSuspicion.temporal as any).recordFocus?.();
        compositeDetector.recordEvent('FOCUS');
      } else if (eventType === 'PASTE') {
        compositeDetector.recordEvent('PASTE');
      } else if (eventType === 'SCREENSHOT_ATTEMPT') {
        // ADDED: Track screenshot attempts - highest priority signal
        compositeDetector.recordEvent('SCREENSHOT_ATTEMPT');

        // Show immediate warning for screenshot attempt with Vietnamese message
        setCurrentViolation({
          type: 'TAB_SWITCH' as EventType, // Map to existing type for UI
          severity: 'ESCALATED',
          message: getViolationWarningMessage('SCREENSHOT_ATTEMPT')
        });
        setShowWarningOverlay(true);
      }

      // Note: recordEvent already checks for composite patterns internally
      // and calls the violation callback if set
    },
    enabled: !!sessionId && !submitting
  });

  // Window size monitoring for split-screen detection
  const { isAcceptable: windowSizeAcceptable, violationCount: windowViolations } = useWindowMonitor({
    enabled: !!sessionId && !submitting,
    onViolation: (violation) => {
      console.log('[WindowMonitor] 🚨 Violation:', violation.message);
      (preSuspicion.temporal as any).recordWindowResize?.(violation.state.widthRatio, violation.state.heightRatio);
      compositeDetector.recordEvent('WINDOW_RESIZE', violation.state as unknown as Record<string, unknown>);

      // Report as violation - use Vietnamese message
      setCurrentViolation({
        type: 'TAB_SWITCH' as EventType, // Map to existing high-severity type
        severity: 'SUSPICIOUS',
        message: getViolationWarningMessage('WINDOW_RESIZE')
      });
      setShowWarningOverlay(true);

      setViolations(prev => [...prev, {
        type: 'TAB_SWITCH' as EventType, // Track as TAB_SWITCH for visibility
        time: new Date().toLocaleTimeString()
      }]);
    }
  });

  // AI Violation Notifications (from Python AI Worker via WebSocket)
  useAIViolationNotifications(sessionId, {
    enabled: !!sessionId && !submitting,
    onViolation: (violation: AIViolationNotification) => {
      console.log('[AI Violation] Received:', violation);

      // Use centralized Vietnamese warning messages
      const message = getViolationWarningMessage(violation.violationType);

      const severityMap: Record<string, string> = {
        'HIGH': 'ESCALATED',
        'MEDIUM': 'SUSPICIOUS',
        'LOW': 'WARN',
      };

      const mappedSeverity = severityMap[violation.severity] || 'SUSPICIOUS';

      setCurrentViolation({
        type: 'BLUR' as EventType,
        severity: mappedSeverity,
        message: `${message}\n${violation.reasons.join(', ')}`
      });
      setShowWarningOverlay(true);

      setViolations(prev => [...prev, {
        type: 'BLUR' as EventType,
        time: new Date().toLocaleTimeString()
      }]);
    }
  });

  // Handle answer change
  const handleAnswerChange = (questionId: string, answer: string) => {
    // Guard against undefined/null answer (RadioGroup can pass undefined)
    if (answer === undefined || answer === null) return;

    const prevAnswer = answers[questionId] || '';
    const now = Date.now();

    // Track answer change for behavior analysis
    answerBehavior.recordAnswerChange(questionId, answer);

    // Check if pre-suspicion is active during this answer
    if (preSuspicion?.isActive) {
      answerBehavior.markPreSuspicionDuring();
    }

    // Initialize ref for this question if needed
    if (!lastTypingRef.current[questionId]) {
      lastTypingRef.current[questionId] = { time: now, length: prevAnswer.length };
    }

    const last = lastTypingRef.current[questionId];
    const timeDiff = (now - last.time) / 1000;

    // Calculate typing speed if adding characters (only for text answers)
    if (typeof answer === 'string' && answer.length > prevAnswer.length && timeDiff > 0.2) {
      const charsAdded = answer.length - prevAnswer.length;
      const speed = charsAdded / timeDiff;

      // Record speed
      preSuspicion?.temporal?.recordTypingSpeed(speed);

      // Update ref
      lastTypingRef.current[questionId] = { time: now, length: answer.length };
    } else if (timeDiff > 2) {
      // Reset if pause > 2s
      lastTypingRef.current[questionId] = { time: now, length: answer.length };
    }

    setAnswers(prev => {
      const newAnswers = { ...prev, [questionId]: answer };
      console.log(`[Answers] Setting answer for ${questionId}: "${answer}" | Total answers: ${Object.keys(newAnswers).length}`, newAnswers);
      return newAnswers;
    });
  };

  // Navigate to specific question (using state, not URL)
  const goToQuestion = (index: number) => {
    if (index < 0 || index >= totalQuestions) return;

    // Submit behavior analysis for CURRENT question before moving
    if (currentQuestion) {
      const currentAns = answers[currentQuestion.id];
      // Even if skipped (no answer), we might want to record it? 
      // For now, only if answered or if we want to track "Seen but not answered"
      if (currentAns) {
        console.log(`[Navigation] Submitting analysis for Question ${currentQuestionIndex + 1} before moving`);
        const difficulty = (currentQuestion.difficulty?.toLowerCase() || 'medium') as 'easy' | 'medium' | 'hard';
        answerBehavior.submitAnswer(
          currentQuestion.id,
          currentQuestionIndex,
          difficulty,
          currentAns
        );
      }
    }

    // Save answers to sessionStorage
    if (examId && Object.keys(answers).length > 0) {
      sessionStorage.setItem(`exam_answers_${examId}`, JSON.stringify(answers));
      console.log(`[Answers] Saved ${Object.keys(answers).length} answers:`, answers);
    }

    // Save question index to sessionStorage for persistence
    if (examId) {
      sessionStorage.setItem(`exam_question_index_${examId}`, String(index));
    }

    // Use state change (no URL change = no remount)
    setCurrentQuestionIndex(index);
    console.log(`[Navigation] Moved to question ${index + 1}/${totalQuestions}`);
  };

  // Navigate to next question
  const goToNextQuestion = () => {
    if (currentQuestionIndex < totalQuestions - 1) {
      goToQuestion(currentQuestionIndex + 1);
    }
  };

  // Navigate to previous question
  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      goToQuestion(currentQuestionIndex - 1);
    }
  };

  // Monitor Temporal Risk Score
  useEffect(() => {
    if (!preSuspicion?.temporal || !sessionId) return;

    const { riskScore, redFlags } = preSuspicion.temporal;

    // Report if risk is high (throttle handled by risk score changing)
    if (riskScore >= 70) {
      console.warn('[Temporal] High risk detected:', riskScore, redFlags);

      // Capture snapshot for evidence
      captureSnapshot().then(result => {
        const { url: evidenceUrl, objectKey } = result;
        incidentsApi.sendClientEvent({
          sessionId,
          eventType: 'TEMPORAL_ANOMALY',
          violationType: 'BEHAVIOR_ANALYSIS' as any,
          timestamp: Date.now(),
          source: 'TEMPORAL_ANALYZER',
          evidenceUrl,
          objectKey, // Add objectKey
          metadata: { score: riskScore, flags: redFlags }
        }).catch(err => console.error('Failed to report temporal anomaly:', err));
      });

      // Also show warning to user
      if (!currentViolation || currentViolation.severity !== 'ESCALATED') {
        setCurrentViolation({
          type: 'BLUR' as EventType, // Use generic type
          severity: 'ESCALATED',
          message: `${getViolationWarningMessage('BEHAVIOR_ANALYSIS')}: ${redFlags[0] || 'Nhiều bất thường'}`
        });
        setShowWarningOverlay(true);
      }
    }
  }, [preSuspicion.temporal.riskScore, sessionId, currentViolation]);

  const prevPreSuspicionPatternRef = useRef<string | null>(null);
  const lastPreSuspicionReportRef = useRef<number>(0); // Throttle incident reporting

  // Pre-suspicion incident throttle: 30 seconds between reports for same pattern
  const PRE_SUSPICION_REPORT_COOLDOWN_MS = 30000;

  useEffect(() => {
    console.log('[PreSuspicion useEffect] Triggered with:', {
      isActive: preSuspicion?.isActive,
      pattern: preSuspicion?.result?.pattern,
      prevPattern: prevPreSuspicionPatternRef.current
    });

    if (preSuspicion?.isActive) {
      const pattern = preSuspicion.result?.pattern;
      const now = Date.now();
      const timeSinceLastReport = now - lastPreSuspicionReportRef.current;

      // Normalize pattern for throttle tracking - strip ESCALATED_ prefix
      // so phone_below and ESCALATED_phone_below share the same cooldown
      const basePattern = pattern?.replace('ESCALATED_', '');

      // STRICT THROTTLE: Only process if cooldown has passed (30s)
      // This prevents multiple incidents regardless of pattern changes
      const cooldownPassed = timeSinceLastReport >= PRE_SUSPICION_REPORT_COOLDOWN_MS;

      if (pattern && pattern !== 'none' && cooldownPassed) {
        console.log(`[PreSuspicion] 🚨 Processing pattern: ${pattern} (base=${basePattern}, timeSinceLastReport=${(timeSinceLastReport / 1000).toFixed(1)}s)`);

        compositeDetector.recordEvent('PRE_SUSPICION', {
          pattern: pattern,
          confidence: preSuspicion.result?.confidence
        });

        let violationType: string | null = null;

        // Normalize pattern for violationType - use base pattern without ESCALATED_ prefix
        // phone_beside is now handled by Look Away Detection, not pre-suspicion
        if (basePattern === 'phone_below') {
          violationType = 'PRE_SUSPICIOUS_phone_below';
        }

        if (violationType) {
          console.log(`[PreSuspicion] Showing warning for pattern: ${pattern} (base=${basePattern}) -> ${violationType}`);

          setCurrentViolation({
            type: 'BLUR' as EventType,
            severity: 'SUSPICIOUS',
            message: getViolationWarningMessage(violationType)
          });
          setShowWarningOverlay(true);

          // Add to violations list
          setViolations(prev => [...prev, {
            type: 'BLUR' as EventType,
            time: new Date().toLocaleTimeString()
          }]);

          // Capture screenshot for phone_below pattern (phone_beside is now disabled)
          if (basePattern === 'phone_below' && sessionId) {
            console.log(`[PreSuspicion] 📸 Capturing screenshot for ${pattern} pattern`);
            captureSnapshot()
              .then(result => {
                const { url: evidenceUrl, objectKey } = result;
                console.log(`[PreSuspicion] ✅ Screenshot captured and uploaded successfully`);
                console.log(`[PreSuspicion] 📦 Evidence Details:`, {
                  pattern,
                  evidenceUrl,
                  objectKey,
                  urlLength: evidenceUrl?.length,
                  isProxyUrl: evidenceUrl?.includes('/api/proxy'),
                  confidence: preSuspicion.result?.confidence
                });

                // Report to backend with screenshot evidence
                incidentsApi.sendClientEvent({
                  sessionId,
                  eventType: violationType!,
                  violationType: violationType as any,
                  violationState: 'SUSPICIOUS',
                  evidenceUrl,
                  objectKey,
                  timestamp: Date.now(),
                  source: 'PRE_SUSPICION_DETECTOR',
                  metadata: {
                    pattern: pattern,
                    confidence: preSuspicion.result?.confidence,
                    hasScreenshot: true
                  }
                }).then(() => {
                  console.log(`[PreSuspicion] 🚀 Incident reported to backend with evidence`);
                }).catch(err => console.error('[PreSuspicion] ❌ Failed to report pre-suspicion with screenshot:', err));
              })
              .catch(err => {
                // Screenshot capture failed - log error but don't block (Requirement 3.5)
                console.error('[PreSuspicion] ❌ Screenshot capture failed:', err);

                // Still report the incident without screenshot
                incidentsApi.sendClientEvent({
                  sessionId,
                  eventType: violationType!,
                  violationType: violationType as any,
                  violationState: 'SUSPICIOUS',
                  timestamp: Date.now(),
                  source: 'PRE_SUSPICION_DETECTOR',
                  metadata: {
                    pattern: pattern,
                    confidence: preSuspicion.result?.confidence,
                    hasScreenshot: false,
                    screenshotError: err?.message || 'Unknown error'
                  }
                }).catch(reportErr => console.error('Failed to report pre-suspicion:', reportErr));
              });
          } else if (sessionId) {
            // Report to backend without screenshot for other patterns (if any in future)
            incidentsApi.sendClientEvent({
              sessionId,
              eventType: violationType!,
              violationType: 'BEHAVIOR_ANALYSIS' as any,
              violationState: 'SUSPICIOUS',
              timestamp: Date.now(),
              source: 'PRE_SUSPICION_DETECTOR',
              metadata: {
                pattern: pattern,
                confidence: preSuspicion.result?.confidence
              }
            }).catch(err => console.error('Failed to report pre-suspicion:', err));
          }

          // Update pattern tracking and throttle timestamp
          prevPreSuspicionPatternRef.current = pattern;
          lastPreSuspicionReportRef.current = now; // Enable throttle for next report

          // Auto-hide after 5 seconds for non-critical violations
          setTimeout(() => {
            setCurrentViolation(prev => {
              if (prev?.message === getViolationWarningMessage(violationType!)) {
                setShowWarningOverlay(false);
                return null;
              }
              return prev;
            });
          }, 5000);
        }
      } else if (!cooldownPassed) {
        // Log throttle skip
        console.log(`[PreSuspicion] ⏳ Throttled: ${((PRE_SUSPICION_REPORT_COOLDOWN_MS - timeSinceLastReport) / 1000).toFixed(1)}s remaining`);
      }
    } else {
      // Reset pattern tracking when pre-suspicion becomes inactive
      // BUT DO NOT reset lastPreSuspicionReportRef - keep throttle active!
      prevPreSuspicionPatternRef.current = null;
    }
  }, [preSuspicion?.isActive, preSuspicion?.result?.pattern, sessionId, captureSnapshot]); // Removed confidence from deps

  // Set up composite violation callback
  useEffect(() => {
    compositeDetector.setViolationCallback((violation: CompositeViolation) => {
      console.error(`[CompositeDetector] Description:`, violation.description);

      if (!sessionId) return;

      // Send to backend
      incidentsApi.sendClientEvent({
        sessionId,
        eventType: 'COMPOSITE_PATTERN',
        violationType: violation.pattern as any,
        violationState: violation.severity,  // MEDIUM, HIGH, or CRITICAL
        timestamp: Date.now(),
        source: 'COMPOSITE_DETECTOR',
        metadata: {
          pattern: violation.pattern,
          confidence: violation.confidence,
          description: violation.description,
          eventCount: violation.events.length,
          events: violation.events.map(e => ({ type: e.type, timestamp: e.timestamp }))
        }
      }).catch(err => console.error('Failed to report composite violation:', err));

      // Trigger Egress recording for HIGH/CRITICAL composite patterns
      if ((violation.severity === 'HIGH' || violation.severity === 'CRITICAL') && livekitData?.roomName) {
        console.log(`[CompositeDetector] 📹 Triggering Egress recording for ${violation.pattern}`);
        triggerEgressRecording({
          sessionId,
          roomName: livekitData.roomName,
          violationType: violation.pattern,
          durationSeconds: 15 // Record 15 seconds for composite patterns
        }).then(result => {
          if (result.success) {
            console.log(`[CompositeDetector] ✅ Egress started: ${result.egressId}`);
          } else {
            console.warn(`[CompositeDetector] ❌ Egress failed: ${result.error}`);
          }
        }).catch(err => console.error('Failed to trigger Egress for composite:', err));
      }

      // Show critical warning for high-confidence patterns
      if (violation.confidence >= 90 || violation.severity === 'CRITICAL') {
        setCurrentViolation({
          type: 'TAB_SWITCH' as EventType, // Map to existing type
          severity: 'ESCALATED',
          message: `⚠️ NGHIÊM TRỌNG: ${violation.description}`
        });
        setShowWarningOverlay(true);
      }
    });

    return () => {
      compositeDetector.setViolationCallback(() => { });
    };
  }, [sessionId]);

  // Submit exam
  const handleSubmit = async (autoSubmit = false) => {
    if (!sessionId || !examId) return;

    if (!autoSubmit) {
      const confirmed = window.confirm(
        `Are you sure you want to submit? You have answered ${Object.keys(answers).length}/${totalQuestions} questions.`
      );
      if (!confirmed) return;
    }

    setSubmitting(true);

    try {
      // IMPORTANT: Submit current question's answer before getting all answers
      // This ensures the timing data for the current question is captured
      if (currentQuestion) {
        const currentAnswer = answers[currentQuestion.id];
        if (currentAnswer) {
          console.log(`[Behavior] Finalizing current question ${currentQuestion.id} before exam submission`);
          // Map difficulty to lowercase format expected by hook
          const difficulty = (currentQuestion.difficulty?.toLowerCase() || 'medium') as 'easy' | 'medium' | 'hard';
          answerBehavior.submitAnswer(
            currentQuestion.id,
            currentQuestionIndex,
            difficulty,
            currentAnswer
          );
        }
      }

      // Get all answer events from behavior analyzer
      const allAnswerEvents = answerBehavior.getAnswers();
      console.log('[AnswerBehavior] All Answer Events:', allAnswerEvents);

      // Get average typing speed from temporal analyzer
      const averageTypingSpeed = preSuspicion?.temporal?.getAverageTypingSpeed?.();
      console.log('[AnswerBehavior] Average Typing Speed:', averageTypingSpeed);

      // Submit answers to backend with detailed behavior metrics from answerBehavior
      const submitAnswers: SubmitAnswer[] = allAnswerEvents.map(event => ({
        questionId: event.questionId,
        answer: event.selectedAnswer,
        timeSpentMs: event.timeToAnswerMs,
        revisionCount: event.revisionCount,
        answerChanges: event.answerChanges,
        averageTypingSpeed: averageTypingSpeed || 0,
        hadPreSuspicionDuring: event.hadPreSuspicionDuring,
        difficulty: event.difficulty
      }));

      // Get final analysis for logging
      const finalAnalysis = answerBehavior.getAnalysis();
      console.log('[AnswerBehavior DEBUG] Final Analysis:', finalAnalysis);
      console.log('[AnswerBehavior DEBUG] Events Count:', allAnswerEvents.length);
      console.log('[AnswerBehavior DEBUG] Anomalies:', finalAnalysis?.anomalies);


      await mockExamApi.submitExam({
        sessionId,
        answers: submitAnswers
      });

      // Clear sessionStorage after successful submission
      sessionStorage.removeItem(`exam_session_${examId}`);
      sessionStorage.removeItem(`exam_data_${examId}`);
      sessionStorage.removeItem(`exam_answers_${examId}`);
      sessionStorage.removeItem(`answer_behavior_${sessionId}`);

      // Submit behavior analysis to backend if available
      if (finalAnalysis && sessionId) {
        try {
          const analysisResult = await mockExamApi.submitBehaviorAnalysis({
            sessionId,
            overallScore: finalAnalysis.overallScore,
            anomalies: finalAnalysis.anomalies.map(a => ({
              type: a.type,
              severity: a.severity,
              score: a.score,
              description: a.description,
              evidence: a.evidence
            })),
            statistics: {
              totalQuestions: allAnswerEvents.length,
              answered: allAnswerEvents.length,
              correct: 0, // Not tracked in mock exam
              accuracy: 0 // Not tracked in mock exam
            },
            patterns: [
              {
                name: 'pre_suspicion_pattern',
                detected: finalAnalysis.patterns.preSuspicionCount > 0,
                confidence: finalAnalysis.patterns.preSuspicionCount / Math.max(1, allAnswerEvents.length),
                description: `${finalAnalysis.patterns.preSuspicionCount} answers with pre-suspicion detected`
              }
            ]
          });
          console.log('[AnswerBehavior] Analysis submitted:', analysisResult);
          if (analysisResult.incidentCreated) {
            console.warn('[AnswerBehavior] High risk detected - incident created');
          }
        } catch (analysisError) {
          console.error('[AnswerBehavior] Failed to submit analysis:', analysisError);
          // Don't block exam submission if analysis fails
        }
      }


      // Note: Session is already marked as ENDED by submitExam endpoint

      alert(autoSubmit
        ? 'Time is up! Your exam has been submitted automatically.'
        : 'Exam submitted successfully!'
      );

      navigate('/my-results');
    } catch (error) {
      console.error('Error submitting exam:', error);
      alert('Failed to submit exam. Please try again.');
      setSubmitting(false);
    }
  };

  // Loading state - Still render ExamRoom underneath to prevent disconnect!
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading exam...</p>
        </div>
      </div>
    );
  }

  // Stream error - show detailed warning
  if (streamError) {
    const isCameraBlocked = streamError.name === 'NotAllowedError' ||
      streamError.message.toLowerCase().includes('permission') ||
      streamError.message.toLowerCase().includes('denied');

    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
        <div className="text-center max-w-lg p-8 bg-white rounded-2xl shadow-xl">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Camera className="w-10 h-10 text-red-500" />
          </div>

          <h2 className="text-2xl font-bold text-red-600 mb-3">
            {isCameraBlocked ? 'Camera Access Blocked' : 'Camera Error'}
          </h2>

          <p className="text-gray-600 mb-6">
            {isCameraBlocked
              ? 'You have denied camera access. Camera is required for exam proctoring.'
              : streamError.message}
          </p>

          {isCameraBlocked && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-semibold text-yellow-800 mb-2">How to enable camera:</h3>
              <ol className="text-sm text-yellow-700 list-decimal list-inside space-y-1">
                <li>Click the camera/lock icon in browser address bar</li>
                <li>Select "Allow" for camera permissions</li>
                <li>Refresh the page or click "Retry" below</li>
              </ol>
            </div>
          )}

          <Alert variant="destructive" className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> You cannot take this exam without camera access.
              All exam sessions require video proctoring for integrity.
            </AlertDescription>
          </Alert>

          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate('/candidate/exams')}>
              Go Back
            </Button>
            <Button onClick={retryStream} className="bg-blue-600 hover:bg-blue-700">
              Retry Camera Access
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 relative">
      {/* Fullscreen Prompt Overlay */}
      {showFullscreenPrompt && !isFullscreen && !submitting && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/95">
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <svg className="w-12 h-12 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Yêu cầu chế độ toàn màn hình
            </h2>

            <p className="text-gray-600 mb-4">
              Để đảm bảo tính công bằng của bài thi, bạn cần bật chế độ toàn màn hình.
            </p>

            <p className="text-sm text-gray-500 mb-6">
              Việc thoát khỏi chế độ toàn màn hình sẽ được ghi nhận như một vi phạm.
            </p>

            <Button
              onClick={enterFullscreen}
              className="w-full h-12 text-lg bg-blue-600 hover:bg-blue-700"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
              Vào chế độ toàn màn hình
            </Button>
          </div>
        </div>
      )}

      {/* Warning Overlay */}
      {showWarningOverlay && currentViolation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className={`absolute inset-0 ${currentViolation.severity === 'ESCALATED'
              ? 'bg-red-900/80'
              : currentViolation.severity === 'SUSPICIOUS'
                ? 'bg-orange-900/70'
                : 'bg-yellow-900/60'
              }`}
          />

          {/* Warning Card */}
          <div className="relative bg-white rounded-xl shadow-2xl p-8 max-w-md mx-4 text-center">
            <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4 ${currentViolation.severity === 'ESCALATED'
              ? 'bg-red-100'
              : currentViolation.severity === 'SUSPICIOUS'
                ? 'bg-orange-100'
                : 'bg-yellow-100'
              }`}>
              {currentViolation.severity === 'ESCALATED' ? (
                <XCircle className={`w-12 h-12 text-red-600`} />
              ) : currentViolation.severity === 'SUSPICIOUS' ? (
                <AlertOctagon className={`w-12 h-12 text-orange-600`} />
              ) : (
                <AlertTriangle className={`w-12 h-12 text-yellow-600`} />
              )}
            </div>

            <h2 className={`text-2xl font-bold mb-2 ${currentViolation.severity === 'ESCALATED'
              ? 'text-red-600'
              : currentViolation.severity === 'SUSPICIOUS'
                ? 'text-orange-600'
                : 'text-yellow-600'
              }`}>
              {currentViolation.severity === 'ESCALATED'
                ? 'SERIOUS VIOLATION'
                : currentViolation.severity === 'SUSPICIOUS'
                  ? 'Warning'
                  : 'Caution'}
            </h2>

            <p className="text-gray-700 text-lg mb-4">
              {currentViolation.message}
            </p>

            <p className="text-sm text-gray-500 mb-6">
              {currentViolation.type === 'NO_FACE'
                ? 'Please enable your camera and face it to continue the exam.'
                : currentViolation.severity === 'ESCALATED'
                  ? 'This incident has been recorded. Repeated violations may result in exam termination.'
                  : currentViolation.severity === 'SUSPICIOUS'
                    ? 'Please correct this immediately to continue.'
                    : 'This warning will disappear shortly.'}
            </p>

            {/* NO_FACE - Cannot dismiss, must fix camera */}
            {currentViolation.type === 'NO_FACE' && (
              <div className="text-center">
                <div className="animate-pulse text-red-500 text-sm mb-2">
                  â³ Waiting for camera...
                </div>
                <p className="text-xs text-gray-400">
                  The exam is paused until your face is visible.
                </p>
              </div>
            )}

            {/* Acknowledge button for SUSPICIOUS and ESCALATED (except NO_FACE) */}
            {currentViolation.type !== 'NO_FACE' &&
              (currentViolation.severity === 'SUSPICIOUS' || currentViolation.severity === 'ESCALATED') && (
                <Button
                  onClick={() => {
                    setShowWarningOverlay(false);
                    setCurrentViolation(null);
                  }}
                  className={
                    currentViolation.severity === 'ESCALATED'
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-orange-600 hover:bg-orange-700'
                  }
                >
                  I Understand
                </Button>
              )}

            {/* Auto-dismiss countdown for WARN (except NO_FACE) */}
            {currentViolation.type !== 'NO_FACE' && currentViolation.severity === 'WARN' && (
              <p className="text-xs text-gray-400">Auto-dismissing...</p>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{examName}</h1>
              <p className="text-sm text-gray-600">Session: {sessionId}</p>
            </div>

            <div className="flex items-center gap-6">
              {/* Connection status */}
              <div className="flex items-center gap-2">
                {liveKitConnected ? (
                  <><Wifi className="w-4 h-4 text-green-600" /><span className="text-sm text-green-600">Connected</span></>
                ) : (
                  <><WifiOff className="w-4 h-4 text-gray-400" /><span className="text-sm text-gray-400">Connecting...</span></>
                )}
              </div>

              {/* Timer */}
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Clock className="w-5 h-5" />
                <span className={formatTime().startsWith('00:') ? 'text-red-600' : 'text-gray-900'}>
                  {formatTime()}
                </span>
              </div>

              {/* Camera preview + Detection Metrics */}
              <div className="flex items-start gap-3">
                {/* Camera preview */}
                <div className="flex flex-col gap-2">
                  <div className="relative">
                    {/* Hidden video element - receives stream from useSharedStream */}
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="hidden"
                    />

                    {/* Display canvas */}
                    <canvas
                      ref={displayCanvasRef}
                      className="w-40 h-30 rounded-lg border-2 border-gray-300 bg-black"
                    />

                    {/* Recording indicator */}
                    <div className="absolute top-1 right-1 bg-red-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                      <Camera className="w-3 h-3" />
                      <span>REC</span>
                    </div>

                    {/* Face detection badge (stays on camera) */}
                    {tfReady && detectionResult && (
                      <div className={`absolute top-1 left-1 text-white text-xs px-2 py-1 rounded flex items-center gap-1 ${detectionResult.faceCount === 1 ? 'bg-green-600' :
                        detectionResult.faceCount === 0 ? 'bg-yellow-600' : 'bg-red-600'
                        }`}>
                        <Eye className="w-3 h-3" />
                        <span>{detectionResult.faceCount} {detectionResult.faceCount === 1 ? 'Face' : 'Faces'}</span>
                      </div>
                    )}

                    {/* Upload indicator */}
                    {uploading && (
                      <div className="absolute bottom-1 right-1 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                        📤
                      </div>
                    )}

                    {tfError && (
                      <div className="absolute bottom-1 right-1 bg-orange-600 text-white text-xs px-2 py-1 rounded">
                        {tfError}
                      </div>
                    )}
                  </div>
                </div>

                {/* Detection Metrics Panel (beside camera) - Enhanced with new Gaze Estimation */}
                {tfReady && detectionResult && detectionResult.headPose && (
                  <div className="bg-slate-800 text-white text-xs p-2 rounded-lg font-mono leading-relaxed min-w-56 max-w-64">
                    <div className="text-slate-400 font-semibold mb-1 text-[10px]">GAZE ESTIMATION</div>
                    <div className="space-y-0.5">
                      {/* Head Pose with threshold indicators */}
                      <div className="flex justify-between">
                        <span className="text-slate-400">Pitch:</span>
                        <span className={
                          detectionResult.headPose.pitch > 12 ? 'text-yellow-400' :
                            detectionResult.headPose.pitch > 20 ? 'text-red-400' : ''
                        }>
                          {detectionResult.headPose.pitch.toFixed(1)}°
                          <span className="text-slate-500 text-[9px]"> /12°P /20°V</span>
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Yaw:</span>
                        <span className={
                          Math.abs(detectionResult.headPose.yaw) > 15 ? 'text-yellow-400' :
                            Math.abs(detectionResult.headPose.yaw) > 25 ? 'text-red-400' : ''
                        }>
                          {detectionResult.headPose.yaw.toFixed(1)}°
                          <span className="text-slate-500 text-[9px]"> /15°P /25°V</span>
                        </span>
                      </div>

                      {/* Iris Gaze (Kappa-corrected) */}
                      {detectionResult.irisGaze && (
                        <>
                          <div className="border-t border-slate-600 my-1"></div>
                          <div className="text-slate-500 text-[9px]">IRIS (Kappa ±5%)</div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Horiz:</span>
                            <span className={Math.abs(detectionResult.irisGaze.horizontalGaze) > 0.35 ? 'text-red-400' : ''}>
                              {detectionResult.irisGaze.horizontalGaze.toFixed(2)}
                              <span className="text-slate-500 text-[9px]"> /±0.35</span>
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Vert:</span>
                            <span className={Math.abs(detectionResult.irisGaze.verticalGaze) > 0.25 ? 'text-yellow-400' : ''}>
                              {detectionResult.irisGaze.verticalGaze.toFixed(2)}
                              <span className="text-slate-500 text-[9px]"> /±0.25</span>
                            </span>
                          </div>
                        </>
                      )}

                      {/* Effective Gaze (Combined) */}
                      {detectionResult.effectiveGaze && (
                        <>
                          <div className="border-t border-slate-600 my-1"></div>
                          <div className="text-cyan-500 text-[9px]">COMBINED GAZE</div>
                          <div className="flex justify-between text-cyan-400">
                            <span>Eff.Pitch:</span>
                            <span>{detectionResult.effectiveGaze.pitch.toFixed(1)}°</span>
                          </div>
                          <div className="flex justify-between text-cyan-400">
                            <span>Eff.Yaw:</span>
                            <span>{detectionResult.effectiveGaze.yaw.toFixed(1)}°</span>
                          </div>
                        </>
                      )}

                      {/* Face Distance & Depth */}
                      {detectionResult.faceDistance && (
                        <>
                          <div className="border-t border-slate-600 my-1"></div>
                          <div className="flex justify-between">
                            <span className="text-slate-400">Distance:</span>
                            <span className={
                              detectionResult.faceDistance.relative > 1.2 ? 'text-green-400' :
                                detectionResult.faceDistance.relative < 0.8 ? 'text-orange-400' : ''
                            }>
                              {detectionResult.faceDistance.relative.toFixed(2)}x
                            </span>
                          </div>
                        </>
                      )}

                      {/* Pre-Suspicion Status */}
                      {preSuspicion && (
                        <>
                          <div className="border-t border-slate-600 my-1"></div>
                          <div className={`flex justify-between ${preSuspicion.isActive ? 'text-orange-400' : 'text-slate-500'}`}>
                            <span>PreSusp:</span>
                            <span>
                              {preSuspicion.isActive
                                ? `⚠️ ${preSuspicion.result?.pattern || 'detecting'}`
                                : '✓ OK'}
                            </span>
                          </div>
                          {preSuspicion.result?.confidence && preSuspicion.isActive && (
                            <div className="flex justify-between text-orange-300">
                              <span className="text-[9px]">Conf:</span>
                              <span>{preSuspicion.result.confidence.toFixed(0)}/40</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Violations warning */}
      {violations.length > 0 && (
        <div className="container mx-auto px-4 mt-4">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div>
                <strong>Warning:</strong> {violations.length} violation(s) detected
              </div>
              <div className="flex gap-2 mt-2 flex-wrap">
                {['TAB_SWITCH', 'PASTE', 'MULTIPLE_FACES', 'NO_FACE', 'LOOKING_AWAY', 'BLUR', 'FOCUS', 'SCREENSHOT_ATTEMPT', 'PHONE_DETECTED', 'BROWSER_EXTENSION'].map(type => {
                  const count = violations.filter(v => v.type === type).length;
                  if (count === 0) return null;

                  const colors: Record<string, string> = {
                    TAB_SWITCH: 'bg-orange-100 text-orange-800',
                    PASTE: 'bg-red-100 text-red-800',
                    MULTIPLE_FACES: 'bg-red-100 text-red-800',
                    NO_FACE: 'bg-yellow-100 text-yellow-800',
                    LOOKING_AWAY: 'bg-purple-100 text-purple-800',
                    BLUR: 'bg-gray-100 text-gray-800',
                    FOCUS: 'bg-blue-100 text-blue-800',
                    SCREENSHOT_ATTEMPT: 'bg-red-100 text-red-800',
                    PHONE_DETECTED: 'bg-red-100 text-red-800',
                    BROWSER_EXTENSION: 'bg-orange-100 text-orange-800'
                  };

                  return (
                    <span key={type} className={`text-xs px-2 py-1 rounded ${colors[type] || 'bg-gray-100'}`}>
                      {count} {type.replace('_', ' ')}
                    </span>
                  );
                })}
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )
      }

      {/* Questions */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Question Progress Bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <span className="text-sm font-medium text-gray-600">
                Câu hỏi {currentQuestionIndex + 1} / {totalQuestions}
              </span>
              <span className="text-sm text-gray-500">
                Đã trả lời: {Object.keys(answers).filter(k => answers[k]).length} / {totalQuestions}
              </span>
              {/* Per-Question Timer Display */}
              <div className={`flex items-center gap-1 font-mono text-sm px-2 py-1 rounded bg-slate-100 ${questionTimer.isCritical ? 'text-red-600 bg-red-50' : questionTimer.isWarning ? 'text-amber-600 bg-amber-50' : 'text-slate-600'}`}>
                <Clock className="w-4 h-4" />
                <span>{questionTimer.formatTime()}</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowQuestionNav(!showQuestionNav)}
            >
              <Grid className="w-4 h-4 mr-2" />
              Danh sách câu hỏi
            </Button>
          </div>

          {/* Question Navigator Grid */}
          {showQuestionNav && (
            <div className="bg-white rounded-lg border p-4 mb-4">
              <div className="grid grid-cols-10 gap-2">
                {Array.from({ length: totalQuestions }, (_, idx) => {
                  const isAnswered = Object.keys(answers).some(key => {
                    // Check if any answer exists for this question index
                    // We need to map question ID back to index somehow
                    return answers[key]; // Simplified check
                  });
                  const isCurrent = idx === currentQuestionIndex;
                  return (
                    <button
                      key={idx}
                      onClick={() => {
                        goToQuestion(idx);
                        setShowQuestionNav(false);
                      }}
                      className={`w-10 h-10 rounded-lg text-sm font-medium transition-colors
                        ${isCurrent
                          ? 'bg-blue-600 text-white'
                          : isAnswered
                            ? 'bg-green-100 text-green-800 border-2 border-green-400'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                      {idx + 1}
                      {isAnswered && !isCurrent && (
                        <Check className="w-3 h-3 inline ml-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex justify-center gap-4 mt-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-blue-600 rounded"></span> Câu hiện tại
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-green-100 border-2 border-green-400 rounded"></span> Đã trả lời
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-gray-100 rounded"></span> Chưa trả lời
                </span>
              </div>
            </div>
          )}

          {/* Current Question */}
          {currentQuestion && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Câu {currentQuestionIndex + 1}: {currentQuestion.text}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(currentQuestion.type === 'MULTIPLE_CHOICE' || currentQuestion.type === 'TRUE_FALSE') && currentQuestion.options ? (
                  <RadioGroup
                    key={`question-${currentQuestion.id}`}
                    value={answers[currentQuestion.id] || ''}
                    onValueChange={(value) => handleAnswerChange(currentQuestion.id, value)}
                  >
                    {currentQuestion.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50">
                        <RadioGroupItem value={option} id={`${currentQuestion.id}-${optionIndex}`} />
                        <Label htmlFor={`${currentQuestion.id}-${optionIndex}`} className="cursor-pointer flex-1">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <Textarea
                    value={answers[currentQuestion.id] || ''}
                    onChange={(e) => handleAnswerChange(currentQuestion.id, e.target.value)}
                    placeholder="Nhập câu trả lời của bạn..."
                    rows={4}
                    className="w-full"
                  />
                )}
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center pt-4">
            <Button
              variant="outline"
              onClick={goToPreviousQuestion}
              disabled={currentQuestionIndex === 0 || loading}
            >
              <ChevronLeft className="w-4 h-4 mr-2" />
              Câu trước
            </Button>

            <div className="flex items-center gap-2 text-sm text-gray-600">
              {answers[currentQuestion?.id || ''] ? (
                <span className="text-green-600 font-medium flex items-center gap-1">
                  <Check className="w-4 h-4" />
                  Đã trả lời
                </span>
              ) : (
                <span className="text-gray-400">Chưa trả lời</span>
              )}
            </div>

            {currentQuestionIndex === totalQuestions - 1 ? (
              <Button
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="bg-green-600 hover:bg-green-700"
              >
                {submitting ? 'Đang nộp...' : 'Nộp bài'}
              </Button>
            ) : (
              <Button
                onClick={goToNextQuestion}
                disabled={currentQuestionIndex === totalQuestions - 1 || loading}
              >
                Câu tiếp theo
                <ChevronRight className="w-4 h-4 ml-2" />
              </Button>
            )}
          </div>

          {/* Submit button - always visible at bottom */}
          {currentQuestionIndex !== totalQuestions - 1 && (
            <div className="flex justify-center pt-6 border-t">
              <Button
                size="lg"
                variant="outline"
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="min-w-48"
              >
                {submitting ? 'Đang nộp...' : 'Nộp bài sớm'}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* LiveKit Room (hidden, for WebRTC) - ALWAYS render once we have livekit data */}
      {/* Key=sessionId ensures stable identity, preventing unmount */}
      {
        livekitData && sessionId && (
          <div style={{ display: 'none' }} key={`examroom-${sessionId}`}>
            <ExamRoom
              key={`room-${sessionId}`}
              sessionId={sessionId}
              stream={streams.livekit}
              token={livekitData.token}
              wsUrl={livekitData.wsUrl}
              onRoomConnected={() => setLiveKitConnected(true)}
              onRoomDisconnected={() => setLiveKitConnected(false)}
            />
          </div>
        )
      }

      {/* Hidden inference canvas */}
      <canvas
        ref={inferenceCanvasRef}
        width={320}
        height={240}
        style={{ display: 'none' }}
      />
    </div >
  );
};

