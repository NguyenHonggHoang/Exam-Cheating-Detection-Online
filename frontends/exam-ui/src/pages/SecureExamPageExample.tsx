/**
 * Secure Exam Page
 * 
 * Anti-screenshot protected exam with:
 * - One question at a time
 * - No backtracking
 * - Per-question timer
 * - Idle detection
 * - Screenshot prevention
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { secureExamApi, type SecureQuestion, type ExamMetadata } from '@/api/secureExam';
import { useSharedStream } from '@/lib/hooks/useSharedStream';
import { useOptimizedDetection } from '@/lib/hooks/useOptimizedDetection';
import { usePerQuestionTimer } from '@/lib/hooks/usePerQuestionTimer';
import { useIdleDetection } from '@/lib/hooks/useIdleDetection';
import { useHeartbeat } from '@/lib/hooks/useHeartbeat';
import { useAntiScreenshot } from '@/lib/hooks/useAntiScreenshot';
import { useLiveKitToken } from '@/lib/hooks/useLiveKitToken';
import { useAuth } from '@/auth/AuthContext';
import { ExamRoom } from '@/components/ExamRoom';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Progress } from '@/ui/progress';
import { Alert, AlertDescription } from '@/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/ui/radio-group';
import { Label } from '@/ui/label';
import { Input } from '@/ui/input';
import {
    Clock,
    AlertTriangle,
    Lock,
    CheckCircle,
    ArrowRight,
    Eye,
    Camera
} from 'lucide-react';

// ========== Types ==========

type ExamState = 'loading' | 'ready' | 'in_progress' | 'completed' | 'locked';

// ========== Component ==========

export function SecureExamPage() {
    const { examId } = useParams<{ examId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    // State
    const [examState, setExamState] = useState<ExamState>('loading');
    const [metadata, setMetadata] = useState<ExamMetadata | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [currentQuestion, setCurrentQuestion] = useState<SecureQuestion | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [lockReason, setLockReason] = useState<string | null>(null);
    const [finalScore, setFinalScore] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Camera stream for AI detection
    const { streams, isReady: streamReady } = useSharedStream({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
        audio: true,
        enabled: examState === 'in_progress'
    });

    // LiveKit token
    const { data: livekitData } = useLiveKitToken(sessionId);

    // AI detection
    const detection = useOptimizedDetection({
        sessionId: sessionId || '',
        stream: streams.tensorflow,
        enabled: examState === 'in_progress' && streamReady,
        enablePreSuspicion: true
    });

    // Anti-screenshot protection
    useAntiScreenshot({
        enabled: examState === 'in_progress',
        onScreenshotAttempt: () => {
            console.log('Screenshot attempt detected!');
            // Could report to server here
        }
    });

    // Heartbeat to keep session alive
    useHeartbeat({
        sessionId: sessionId || '',
        enabled: examState === 'in_progress',
        intervalMs: 5000,
        onSessionLocked: (reason) => {
            setExamState('locked');
            setLockReason(reason);
        }
    });

    // Idle detection - lock after 30 seconds
    const idle = useIdleDetection({
        enabled: examState === 'in_progress',
        timeoutMs: 30000,
        onIdle: async () => {
            if (sessionId) {
                try {
                    await secureExamApi.lockSession(sessionId, 'Idle timeout');
                    setExamState('locked');
                    setLockReason('Không hoạt động quá lâu');
                } catch (e) {
                    console.error('Failed to lock session:', e);
                }
            }
        }
    });

    // Handle time up for current question
    const handleQuestionTimeUp = useCallback(async () => {
        if (!sessionId || submitting) return;

        console.log('Question time up - auto submitting');
        await submitAnswer('');  // Submit empty answer
    }, [sessionId, submitting]);

    // Per-question timer
    const timer = usePerQuestionTimer({
        timeLimitSeconds: currentQuestion?.timeLimitSeconds || 60,
        startedAtEpochMs: currentQuestion?.startedAtEpochMs || Date.now(),
        onTimeUp: handleQuestionTimeUp,
        enabled: examState === 'in_progress' && !!currentQuestion
    });

    // Initialize exam
    useEffect(() => {
        const init = async () => {
            if (!examId || !user) return;

            try {
                // TODO: Create session first if needed
                // For now, assume sessionId comes from URL or is created elsewhere
                const tempSessionId = examId; // In real app, get from session creation

                // Start secure exam
                const meta = await secureExamApi.startExam(tempSessionId);
                setMetadata(meta);
                setSessionId(meta.sessionId);

                // Get first question
                const question = await secureExamApi.getCurrentQuestion(meta.sessionId);
                setCurrentQuestion(question);
                setExamState('in_progress');

            } catch (err: any) {
                console.error('Failed to start exam:', err);
                setError(err.message || 'Failed to start exam');
                setExamState('locked');
            }
        };

        init();
    }, [examId, user]);

    // Submit answer
    const submitAnswer = async (answer?: string) => {
        if (!sessionId || submitting) return;

        setSubmitting(true);
        try {
            const response = await secureExamApi.submitAnswer(
                sessionId,
                answer !== undefined ? answer : selectedAnswer
            );

            if (response.examComplete) {
                setExamState('completed');
                setFinalScore(response.finalScore);
                setCurrentQuestion(null);
            } else if (response.nextQuestion) {
                setCurrentQuestion(response.nextQuestion);
                setSelectedAnswer('');
            } else if (!response.accepted) {
                setError(response.message);
            }
        } catch (err: any) {
            console.error('Failed to submit answer:', err);
            setError(err.message || 'Failed to submit answer');
        } finally {
            setSubmitting(false);
        }
    };

    // Render loading state
    if (examState === 'loading') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <Card className="w-96">
                    <CardContent className="pt-6 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
                        <p>Đang tải bài thi...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Render locked state
    if (examState === 'locked') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-red-50">
                <Card className="w-96 border-red-200">
                    <CardHeader>
                        <CardTitle className="text-red-600 flex items-center gap-2">
                            <Lock className="h-6 w-6" />
                            Phiên thi đã bị khóa
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="mb-4">{lockReason || error || 'Phiên thi đã bị khóa.'}</p>
                        <Button onClick={() => navigate('/dashboard')} variant="outline" className="w-full">
                            Quay về Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Render completed state
    if (examState === 'completed') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-green-50">
                <Card className="w-96 border-green-200">
                    <CardHeader>
                        <CardTitle className="text-green-600 flex items-center gap-2">
                            <CheckCircle className="h-6 w-6" />
                            Hoàn thành bài thi!
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-center">
                        <div className="text-4xl font-bold text-green-600 mb-4">
                            {finalScore}%
                        </div>
                        <p className="text-gray-600 mb-4">
                            Đã trả lời {metadata?.totalQuestions} câu hỏi
                        </p>
                        <Button onClick={() => navigate('/dashboard')} className="w-full">
                            Quay về Dashboard
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Render exam in progress
    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <header className="bg-white shadow-sm border-b">
                <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <h1 className="text-lg font-semibold">{metadata?.examName}</h1>
                        <span className="text-sm text-gray-500">
                            Câu {(currentQuestion?.questionIndex || 0) + 1} / {currentQuestion?.totalQuestions}
                        </span>
                    </div>

                    {/* Timer */}
                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${timer.isCritical ? 'bg-red-100 text-red-600 animate-pulse' :
                        timer.isWarning ? 'bg-yellow-100 text-yellow-600' :
                            'bg-blue-100 text-blue-600'
                        }`}>
                        <Clock className="h-4 w-4" />
                        <span className="font-mono font-bold">{timer.formatTime()}</span>
                    </div>
                </div>

                {/* Progress bar */}
                <Progress
                    value={timer.percentLeft}
                    className="h-1"
                />
            </header>

            {/* Main content */}
            <main className="max-w-4xl mx-auto px-4 py-6 grid grid-cols-3 gap-6">
                {/* Question area */}
                <div className="col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                <span>Câu hỏi {(currentQuestion?.questionIndex || 0) + 1}</span>
                                <span className={`text-sm px-2 py-1 rounded ${currentQuestion?.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                                    currentQuestion?.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                                        'bg-yellow-100 text-yellow-700'
                                    }`}>
                                    {currentQuestion?.difficulty === 'easy' ? 'Dễ' :
                                        currentQuestion?.difficulty === 'hard' ? 'Khó' : 'Trung bình'}
                                </span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {/* Question text - protected from selection */}
                            <div className="question-content mb-6 text-lg">
                                {currentQuestion?.text}
                            </div>

                            {/* Answer options */}
                            {currentQuestion?.type === 'MULTIPLE_CHOICE' && currentQuestion.options && (
                                <RadioGroup
                                    value={selectedAnswer}
                                    onValueChange={setSelectedAnswer}
                                    className="space-y-3"
                                >
                                    {currentQuestion.options.map((option, index) => (
                                        <div key={index} className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-gray-50">
                                            <RadioGroupItem value={option} id={`option-${index}`} />
                                            <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer">
                                                {option}
                                            </Label>
                                        </div>
                                    ))}
                                </RadioGroup>
                            )}

                            {currentQuestion?.type === 'TEXT' && (
                                <Input
                                    type="text"
                                    value={selectedAnswer}
                                    onChange={(e) => setSelectedAnswer(e.target.value)}
                                    placeholder="Nhập câu trả lời..."
                                    className="text-lg"
                                    autoComplete="off"
                                />
                            )}

                            {currentQuestion?.type === 'TRUE_FALSE' && (
                                <RadioGroup
                                    value={selectedAnswer}
                                    onValueChange={setSelectedAnswer}
                                    className="flex gap-4"
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="true" id="true" />
                                        <Label htmlFor="true">Đúng</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="false" id="false" />
                                        <Label htmlFor="false">Sai</Label>
                                    </div>
                                </RadioGroup>
                            )}

                            {/* Submit button */}
                            <div className="mt-6 flex justify-end">
                                <Button
                                    onClick={() => submitAnswer()}
                                    disabled={submitting || !selectedAnswer}
                                    className="flex items-center gap-2"
                                >
                                    {submitting ? (
                                        <>Đang gửi...</>
                                    ) : currentQuestion?.questionIndex === (currentQuestion?.totalQuestions || 0) - 1 ? (
                                        <>Nộp bài</>
                                    ) : (
                                        <>Câu tiếp theo <ArrowRight className="h-4 w-4" /></>
                                    )}
                                </Button>
                            </div>

                            {/* No backtracking warning */}
                            <Alert className="mt-4 border-yellow-200 bg-yellow-50">
                                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                <AlertDescription className="text-yellow-700">
                                    Không thể quay lại câu hỏi trước. Hãy chắc chắn trước khi gửi!
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                    {/* Camera preview */}
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <Camera className="h-4 w-4" />
                                <span className="text-sm font-medium">Camera</span>
                            </div>
                            <div className="aspect-video bg-gray-900 rounded overflow-hidden">
                                {detection.videoRef && (
                                    <video
                                        ref={detection.videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="w-full h-full object-cover"
                                    />
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Status */}
                    <Card>
                        <CardContent className="p-4 space-y-3">
                            <div className="flex items-center gap-2">
                                <Eye className="h-4 w-4 text-green-500" />
                                <span className="text-sm">Đang giám sát</span>
                            </div>

                            <div className="text-xs text-gray-500">
                                <div>Đã trả lời: {currentQuestion?.questionIndex || 0} / {currentQuestion?.totalQuestions}</div>
                                <div>Thời gian còn lại: {timer.formatTime()}</div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>

            {/* LiveKit Room for video streaming */}
            {livekitData && sessionId && (
                <ExamRoom
                    sessionId={sessionId}
                    token={livekitData.token}
                    wsUrl={livekitData.wsUrl}
                    stream={streams.livekit}
                    onRoomConnected={() => console.log('LiveKit connected')}
                    onRoomDisconnected={() => console.log('LiveKit disconnected')}
                />
            )}
        </div>
    );
}

export default SecureExamPage;
