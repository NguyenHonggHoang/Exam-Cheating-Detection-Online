/**
 * ExamWaitingRoom
 * 
 * Queue page after face verification, waiting for proctor to start exam.
 * Shows queue position and handles WebSocket updates for exam start signal.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { examsApi, type Exam } from '@/api/exams';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui/card';
import { Button } from '@/ui/button';
import { Alert, AlertDescription } from '@/ui/alert';
import {
    Clock,
    Users,
    CheckCircle,
    Loader2,
    ArrowLeft,
} from 'lucide-react';

type WaitingStatus = 'waiting' | 'approved' | 'starting' | 'error';

export function ExamWaitingRoom() {
    const { examId } = useParams<{ examId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    const [exam, setExam] = useState<Exam | null>(null);
    const [status, setStatus] = useState<WaitingStatus>('waiting');
    const [queuePosition, setQueuePosition] = useState<number | null>(null);
    const [totalInQueue, setTotalInQueue] = useState<number>(0);
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);

    // Load exam info
    useEffect(() => {
        if (examId) {
            examsApi.getById(examId)
                .then(setExam)
                .catch(err => {
                    console.error('Failed to load exam:', err);
                    setError('Không thể tải thông tin kỳ thi');
                });
        }
    }, [examId]);

    // Join waiting queue
    useEffect(() => {
        if (!examId || !user) return;

        const joinQueue = async () => {
            try {
                // Call API to join waiting queue
                const res = await fetch(`/api/proxy/exams/${examId}/queue/join`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: user.id }),
                    credentials: 'include',
                });

                if (!res.ok) {
                    throw new Error('Failed to join queue');
                }

                const data = await res.json();
                setQueuePosition(data.position ?? 1);
                setTotalInQueue(data.totalInQueue ?? 1);
            } catch (err) {
                console.error('Failed to join queue:', err);
                // Don't show error, just use fallback
                setQueuePosition(1);
                setTotalInQueue(1);
            }
        };

        joinQueue();
    }, [examId, user]);

    // Poll for exam start signal (fallback when WebSocket is not available)
    useEffect(() => {
        if (!examId || status !== 'waiting') return;

        const pollInterval = setInterval(async () => {
            try {
                const res = await fetch(`/api/proxy/exams/${examId}/queue/status`, {
                    credentials: 'include',
                });

                if (res.ok) {
                    const data = await res.json();
                    setTotalInQueue(data.totalInQueue ?? totalInQueue);

                    if (data.examStarted) {
                        setStatus('approved');
                        clearInterval(pollInterval);
                        startCountdown();
                    }
                }
            } catch (err) {
                // Ignore poll errors
            }
        }, 3000);

        return () => clearInterval(pollInterval);
    }, [examId, status, totalInQueue]);

    // WebSocket connection for real-time updates
    useEffect(() => {
        if (!examId) return;

        // Try to connect to WebSocket for real-time updates
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${wsProtocol}//${window.location.host}/api/ws/exam/${examId}`;

        try {
            const ws = new WebSocket(wsUrl);

            ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);

                    if (message.type === 'EXAM_STARTED') {
                        setStatus('approved');
                        startCountdown();
                    } else if (message.type === 'QUEUE_UPDATE') {
                        setQueuePosition(message.position);
                        setTotalInQueue(message.totalInQueue);
                    }
                } catch (err) {
                    console.warn('Failed to parse WS message:', err);
                }
            };

            ws.onerror = () => {
                console.log('[WaitingRoom] WebSocket not available, using polling');
            };

            return () => {
                ws.close();
            };
        } catch (err) {
            console.log('[WaitingRoom] WebSocket connection failed, using polling');
        }
    }, [examId]);

    // Start countdown before opening exam in fullscreen popup
    const startCountdown = useCallback(() => {
        setCountdown(5);

        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev === null || prev <= 1) {
                    clearInterval(timer);
                    setStatus('starting');

                    // Open exam in a new fullscreen popup window
                    const examUrl = `/exam-start/${examId}`;
                    const screenWidth = window.screen.width;
                    const screenHeight = window.screen.height;

                    // Popup window features for fullscreen
                    const features = [
                        `width=${screenWidth}`,
                        `height=${screenHeight}`,
                        'left=0',
                        'top=0',
                        'menubar=no',
                        'toolbar=no',
                        'location=no',
                        'status=no',
                        'resizable=yes',
                        'scrollbars=yes'
                    ].join(',');

                    const examWindow = window.open(examUrl, 'ExamWindow', features);

                    if (examWindow) {
                        console.log('[WaitingRoom] Exam window opened successfully');
                        // Close current waiting room or redirect to dashboard
                        setTimeout(() => {
                            navigate('/dashboard');
                        }, 1000);
                    } else {
                        // Popup blocked - fallback to navigate
                        console.warn('[WaitingRoom] Popup blocked, falling back to navigation');
                        navigate(examUrl);
                    }

                    return null;
                }
                return prev - 1;
            });
        }, 1000);
    }, [examId, navigate]);

    // Handle leave queue
    const handleLeaveQueue = async () => {
        try {
            await fetch(`/api/proxy/exams/${examId}/queue/leave`, {
                method: 'POST',
                credentials: 'include',
            });
        } catch (err) {
            // Ignore errors
        }
        navigate('/exams');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white flex items-center justify-center p-4">
            <div className="max-w-lg w-full">
                <Card className="bg-slate-800/50 border-slate-700 backdrop-blur">
                    <CardHeader className="text-center">
                        <div className="w-20 h-20 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                            {status === 'waiting' && <Loader2 className="w-10 h-10 text-white animate-spin" />}
                            {status === 'approved' && <CheckCircle className="w-10 h-10 text-white" />}
                        </div>

                        <CardTitle className="text-2xl text-white">
                            {status === 'waiting' && 'Đang chờ giám thị'}
                            {status === 'approved' && 'Phiên thi đã mở!'}
                            {status === 'starting' && 'Đang bắt đầu...'}
                        </CardTitle>

                        {exam && (
                            <CardDescription className="text-gray-300">
                                {exam.name}
                            </CardDescription>
                        )}
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {error && (
                            <Alert variant="destructive">
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {status === 'waiting' && (
                            <>
                                {/* Queue Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                                        <Users className="w-6 h-6 mx-auto mb-2 text-blue-400" />
                                        <p className="text-sm text-gray-400">Trong hàng chờ</p>
                                        <p className="text-2xl font-bold">{totalInQueue}</p>
                                    </div>
                                    <div className="bg-slate-700/50 rounded-lg p-4 text-center">
                                        <Clock className="w-6 h-6 mx-auto mb-2 text-green-400" />
                                        <p className="text-sm text-gray-400">Vị trí của bạn</p>
                                        <p className="text-2xl font-bold">{queuePosition ?? '-'}</p>
                                    </div>
                                </div>

                                {/* Waiting Message */}
                                <div className="text-center py-4">
                                    <p className="text-gray-300">
                                        Vui lòng chờ giám thị bắt đầu phiên thi.
                                    </p>
                                    <p className="text-sm text-gray-400 mt-2">
                                        Đừng tắt hoặc refresh trang này.
                                    </p>
                                </div>

                                {/* Pulse animation */}
                                <div className="flex justify-center">
                                    <div className="flex space-x-1">
                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                </div>
                            </>
                        )}

                        {status === 'approved' && countdown !== null && (
                            <div className="text-center py-8">
                                <p className="text-lg text-green-400 mb-4">
                                    Giám thị đã cho phép bắt đầu phiên thi!
                                </p>
                                <div className="text-6xl font-bold text-white animate-pulse">
                                    {countdown}
                                </div>
                                <p className="text-sm text-gray-400 mt-4">
                                    Tự động chuyển hướng...
                                </p>
                            </div>
                        )}

                        {/* Back button */}
                        {status === 'waiting' && (
                            <Button
                                variant="outline"
                                onClick={handleLeaveQueue}
                                className="w-full border-slate-600 text-gray-300 hover:bg-slate-700"
                            >
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Rời hàng chờ
                            </Button>
                        )}

                        {/* Instructions */}
                        <div className="text-xs text-gray-500 text-center">
                            <p>Nếu chờ quá lâu, vui lòng liên hệ giám thị.</p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default ExamWaitingRoom;
