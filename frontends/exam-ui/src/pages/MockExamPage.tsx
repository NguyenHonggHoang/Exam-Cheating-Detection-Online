import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { mockExamApi, type Question, type SubmitAnswer } from '@/api/mockExam';
import { ingestApi, generateIdempotencyKey } from '@/api/ingest';
import { useOpenCVWebcam } from '@/lib/hooks/useOpenCVWebcam';
import { useEventDetection, type EventType } from '@/lib/hooks/useEventDetection';
import { useTimer } from '@/lib/hooks/useTimer';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Label } from '@/ui/label';
import { RadioGroup, RadioGroupItem } from '@/ui/radio-group';
import { Textarea } from '@/ui/textarea';
import { Alert, AlertDescription } from '@/ui/alert';
import { AlertTriangle, Camera, Clock, Eye } from 'lucide-react';

export const MockExamPage = () => {
  const { examId } = useParams<{ examId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [examName, setExamName] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [violations, setViolations] = useState<{ type: EventType; time: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Initialize exam
  useEffect(() => {
    const initExam = async () => {
      if (!examId || !user) return;
      
      try {
        // Start session with real user ID from auth
        const sessionResponse = await mockExamApi.startSession({
          examId,
          userId: user.id
        });
        setSessionId(sessionResponse.sessionId);
        setExamName(sessionResponse.examName);

        // Get questions
        const questionsResponse = await mockExamApi.getQuestions(examId);
        setQuestions(questionsResponse.questions);
      } catch (error) {
        console.error('Error initializing exam:', error);
        alert('Failed to start exam. Please try again.');
        navigate('/');
      } finally {
        setLoading(false);
      }
    };

    initExam();
  }, [examId, navigate, user]);

  // Timer
  const handleTimeUp = async () => {
    await handleSubmit(true);
  };

  const { formatTime } = useTimer({
    durationMinutes: 45,
    onTimeUp: handleTimeUp,
    autoStart: !loading
  });

  // Webcam with auto snapshot using OpenCV
  const handleSnapshot = async (blob: Blob, detectedFaces?: number) => {
    if (!sessionId) return;
    
    try {
      await ingestApi.uploadSnapshot(sessionId, blob);
      console.log(`[MockExam] Snapshot uploaded, faces detected: ${detectedFaces}`);
    } catch (error) {
      console.error('Error uploading snapshot:', error);
    }
  };

  const { videoRef, canvasRef, faceCount, cvReady, error: cvError } = useOpenCVWebcam({
    onSnapshot: handleSnapshot,
    captureInterval: 3000,
    enabled: !!sessionId && !submitting,
    enableFaceDetection: true
  });

  // Event detection
  const handleEvent = async (eventType: EventType) => {
    if (!sessionId) return;

    const now = Date.now(); // milliseconds
    
    try {
      await ingestApi.ingestEvents({
        items: [{
          sessionId,
          ts: now,
          eventType,
          idempotencyKey: generateIdempotencyKey(sessionId, eventType, now)
        }]
      });

      // Track violation
      setViolations(prev => [...prev, {
        type: eventType,
        time: new Date().toLocaleTimeString()
      }]);
    } catch (error) {
      console.error('Error ingesting event:', error);
    }
  };

  useEventDetection({
    sessionId,
    onEvent: handleEvent,
    enabled: !!sessionId && !submitting
  });

  // Handle answer change
  const handleAnswerChange = (questionId: string, answer: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: answer }));
  };

  // Submit exam
  const handleSubmit = async (autoSubmit = false) => {
    if (!sessionId) return;
    
    if (!autoSubmit) {
      const confirmed = window.confirm(
        `Are you sure you want to submit? You have answered ${Object.keys(answers).length}/${questions.length} questions.`
      );
      if (!confirmed) return;
    }

    setSubmitting(true);

    try {
      const submitAnswers: SubmitAnswer[] = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer
      }));

      await mockExamApi.submitExam({
        sessionId,
        answers: submitAnswers
      });

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">{examName}</h1>
              <p className="text-sm text-gray-600">Session: {sessionId}</p>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Timer */}
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Clock className="w-5 h-5" />
                <span className={formatTime().startsWith('00:') ? 'text-red-600' : 'text-gray-900'}>
                  {formatTime()}
                </span>
              </div>

              {/* Camera preview with OpenCV processing */}
              <div className="flex flex-col gap-2">
                <div className="relative">
                  {/* Video element for camera stream - positioned absolutely to sync with canvas */}
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    style={{
                      position: 'absolute',
                      opacity: 0,
                      pointerEvents: 'none'
                    }}
                  />
                  
                  {/* Canvas with OpenCV processed output - visible */}
                  <canvas
                    ref={canvasRef}
                    className="w-40 h-30 rounded-lg border-2 border-gray-300 bg-black"
                    style={{ display: 'block' }}
                  />
                  
                  <div className="absolute top-1 right-1 bg-red-600 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
                    <Camera className="w-3 h-3" />
                    <span>REC</span>
                  </div>
                  
                  {/* Face detection indicator */}
                  {cvReady && (
                    <div className={`absolute top-1 left-1 text-white text-xs px-2 py-1 rounded flex items-center gap-1 ${
                      faceCount === 1 ? 'bg-green-600' : 
                      faceCount === 0 ? 'bg-yellow-600' : 
                      'bg-red-600'
                    }`}>
                      <Eye className="w-3 h-3" />
                      <span>{faceCount} {faceCount === 1 ? 'Face' : 'Faces'}</span>
                    </div>
                  )}
                  
                  {cvError && (
                    <div className="absolute bottom-1 left-1 bg-orange-600 text-white text-xs px-2 py-1 rounded">
                      {cvError}
                    </div>
                  )}
                </div>
                
                {!cvReady && (
                  <div className="text-xs text-gray-500 text-center">
                    Loading OpenCV...
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
                {violations.filter(v => v.type === 'TAB_SWITCH').length > 0 && (
                  <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded">
                    {violations.filter(v => v.type === 'TAB_SWITCH').length} Tab Switch{violations.filter(v => v.type === 'TAB_SWITCH').length > 1 ? 'es' : ''}
                  </span>
                )}
                {violations.filter(v => v.type === 'PASTE').length > 0 && (
                  <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded">
                    {violations.filter(v => v.type === 'PASTE').length} Paste{violations.filter(v => v.type === 'PASTE').length > 1 ? 's' : ''}
                  </span>
                )}
                {violations.filter(v => v.type === 'FOCUS').length > 0 && (
                  <span className="bg-yellow-100 text-yellow-800 text-xs px-2 py-1 rounded">
                    {violations.filter(v => v.type === 'FOCUS').length} Focus Event{violations.filter(v => v.type === 'FOCUS').length > 1 ? 's' : ''}
                  </span>
                )}
                {violations.filter(v => v.type === 'BLUR').length > 0 && (
                  <span className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded">
                    {violations.filter(v => v.type === 'BLUR').length} Blur Event{violations.filter(v => v.type === 'BLUR').length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Questions */}
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {questions.map((question, index) => (
            <Card key={question.id}>
              <CardHeader>
                <CardTitle className="text-lg">
                  Question {index + 1}: {question.text}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {question.type === 'MULTIPLE_CHOICE' && question.options ? (
                  <RadioGroup
                    value={answers[question.id] || ''}
                    onValueChange={(value) => handleAnswerChange(question.id, value)}
                  >
                    {question.options.map((option, optionIndex) => (
                      <div key={optionIndex} className="flex items-center space-x-2">
                        <RadioGroupItem value={option} id={`${question.id}-${optionIndex}`} />
                        <Label htmlFor={`${question.id}-${optionIndex}`} className="cursor-pointer">
                          {option}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <Textarea
                    value={answers[question.id] || ''}
                    onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                    placeholder="Type your answer here..."
                    rows={4}
                    className="w-full"
                  />
                )}
              </CardContent>
            </Card>
          ))}

          {/* Submit button */}
          <div className="flex justify-center pt-6">
            <Button
              size="lg"
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="min-w-48"
            >
              {submitting ? 'Submitting...' : 'Submit Exam'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};