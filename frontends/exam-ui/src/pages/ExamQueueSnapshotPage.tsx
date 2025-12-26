/**
 * ExamQueueSnapshotPage
 * 
 * Face verification page before entering exam waiting room.
 * 
 * Features:
 * - Live camera with oval face guide frame
 * - Real-time face quality indicators
 * - 5 retry attempts for automatic verification
 * - Escalation to proctor after 5 failed attempts
 * - Countdown timer for capture
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useFaceQuality } from '@/lib/hooks/useFaceQuality';
import { useSharedStream } from '@/lib/hooks/useSharedStream';
import {
    requestVerification,
    waitForVerificationResult,
    uploadVerificationBlob,
    getIdPhotoStatus,
} from '@/api/identity';
import { examsApi, type Exam } from '@/api/exams';
import { QUALITY_THRESHOLDS } from '@/lib/utils/faceQuality';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui/card';
import { Button } from '@/ui/button';
import { Alert, AlertDescription } from '@/ui/alert';
import { Progress } from '@/ui/progress';
import {
    Camera,
    Check,
    X,
    AlertCircle,
    Loader2,
    RefreshCw,
    UserCheck,
    Sun,
    Focus,
    Eye,
    Move,
    Clock,
} from 'lucide-react';

const MAX_RETRY_ATTEMPTS = 5;

type VerificationStatus =
    | 'initializing'
    | 'ready'
    | 'capturing'
    | 'verifying'
    | 'verified'
    | 'failed'
    | 'escalated'
    | 'awaiting_proctor'
    | 'proctor_approved'
    | 'proctor_rejected';

interface QualityIndicatorProps {
    label: string;
    isOk: boolean;
    icon: React.ReactNode;
}

function QualityIndicator({ label, isOk, icon }: QualityIndicatorProps) {
    return (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isOk
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
            : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
            }`}>
            <span className="w-5 h-5">{icon}</span>
            <span className="text-sm font-medium">{label}</span>
            {isOk ? (
                <Check className="w-4 h-4 ml-auto text-green-600" />
            ) : (
                <X className="w-4 h-4 ml-auto opacity-40" />
            )}
        </div>
    );
}

export function ExamQueueSnapshotPage() {
    const { examId } = useParams<{ examId: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // State
    const [exam, setExam] = useState<Exam | null>(null);
    const [status, setStatus] = useState<VerificationStatus>('initializing');
    const [retryCount, setRetryCount] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [countdown, setCountdown] = useState<number | null>(null);
    const [verificationMessage, setVerificationMessage] = useState<string>('');
    const [idPhotoUrl, setIdPhotoUrl] = useState<string | null>(null);
    const [capturedSnapshotUrl, setCapturedSnapshotUrl] = useState<string | null>(null);

    // Camera stream - enable when status allows camera
    const cameraEnabled = status === 'initializing' || status === 'ready' || status === 'failed';
    const { streams, isReady: streamReady, error: streamError } = useSharedStream({
        enabled: cameraEnabled,
    });

    // Update status when stream is ready
    useEffect(() => {
        if (streamReady && status === 'initializing') {
            setStatus('ready');
        }
    }, [streamReady, status]);

    // Face quality detection
    const {
        metrics,
        isReady: qualityReady,
        isQualityOk,
        qualityLevel,
        suggestions,
        capture,
        error: qualityError,
    } = useFaceQuality({
        videoRef,
        canvasRef,
        enabled: (status === 'ready' || status === 'failed') && streamReady,
        targetFPS: 12,
        showGuideFrame: true,
        showDimmedOverlay: true,
    });

    // Load exam info
    useEffect(() => {
        if (examId) {
            examsApi.getById(examId)
                .then(setExam)
                .catch(err => {
                    console.error('Failed to load exam:', err);
                    setError('Không thể tải thông tin bài thi');
                });
        }
    }, [examId]);

    // Load ID photo status
    useEffect(() => {
        getIdPhotoStatus()
            .then(photoStatus => {
                if (photoStatus.hasPhoto && photoStatus.photoUrl) {
                    setIdPhotoUrl(photoStatus.photoUrl);
                }
            })
            .catch(console.error);
    }, []);

    // Connect video element to stream
    useEffect(() => {
        if (videoRef.current && streams.source) {
            videoRef.current.srcObject = streams.source;
        }
    }, [streams.source]);

    // Handle capture with countdown
    const handleCapture = useCallback(async () => {
        if (!isQualityOk) return;

        // Start countdown
        setCountdown(3);

        for (let i = 3; i > 0; i--) {
            setCountdown(i);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        setCountdown(null);
        setStatus('capturing');

        try {
            // Capture image
            const blob = await capture();
            if (!blob) {
                throw new Error('Không thể chụp ảnh');
            }

            // Show captured preview
            setCapturedSnapshotUrl(URL.createObjectURL(blob));

            setStatus('verifying');
            setVerificationMessage('Đang xác thực danh tính...');

            // Upload the already-captured blob (don't re-capture from video)
            const { objectKey } = await uploadVerificationBlob(blob);

            const verifyResponse = await requestVerification({
                sessionId: examId!,
                snapshotObjectKey: objectKey,
            });

            // Wait for result from Python worker
            const result = await waitForVerificationResult(examId!, {
                timeoutMs: 30000,
                pollIntervalMs: 1000,
            });

            console.log('[Verification] Result received:', result);
            console.log('[Verification] verified =', result.verified, typeof result.verified);

            if (result.verified) {
                console.log('[Verification] ✅ Success - navigating to waiting room');
                setStatus('verified');
                setVerificationMessage('Xác thực thành công! Đang chuyển hướng...');

                // Navigate to exam waiting room after delay
                setTimeout(() => {
                    console.log('[Verification] Navigating to:', `/exam/${examId}/waiting-room`);
                    navigate(`/exam/${examId}/waiting-room`);
                }, 2000);
            } else {
                const newRetryCount = retryCount + 1;
                setRetryCount(newRetryCount);

                if (newRetryCount >= MAX_RETRY_ATTEMPTS) {
                    // Escalate to proctor
                    setStatus('escalated');
                    setVerificationMessage(
                        'Đã vượt quá số lần thử. Yêu cầu đã được gửi đến giám thị để xác thực thủ công.'
                    );

                    // TODO: Send escalation request to proctor
                    await escalateToProctor(objectKey);
                } else {
                    setStatus('failed');
                    setVerificationMessage(
                        `Xác thực không thành công. Còn ${MAX_RETRY_ATTEMPTS - newRetryCount} lần thử.`
                    );
                }
            }

        } catch (err) {
            console.error('Verification error:', err);
            const newRetryCount = retryCount + 1;
            setRetryCount(newRetryCount);

            if (newRetryCount >= MAX_RETRY_ATTEMPTS) {
                setStatus('escalated');
                setVerificationMessage(
                    'Đã xảy ra lỗi nhiều lần. Yêu cầu đã được gửi đến giám thị.'
                );
            } else {
                setStatus('failed');
                setError('Có lỗi xảy ra. Vui lòng thử lại.');
            }
        }
    }, [isQualityOk, capture, examId, retryCount, navigate]);

    // Escalate to proctor for manual review
    const escalateToProctor = async (snapshotObjectKey: string) => {
        try {
            // Call API to create manual verification request
            // Proctor will see this in their dashboard
            await fetch('/api/identity/verify/escalate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: examId,
                    userId: user?.id,
                    snapshotObjectKey,
                    reason: 'Automatic verification failed after 5 attempts',
                }),
            });

            setStatus('awaiting_proctor');

            // Poll for proctor decision
            pollProctorDecision();
        } catch (err) {
            console.error('Escalation failed:', err);
        }
    };

    // Poll for proctor decision
    const pollProctorDecision = async () => {
        const maxWait = 5 * 60 * 1000; // 5 minutes
        const pollInterval = 3000; // 3 seconds
        const startTime = Date.now();

        const poll = async () => {
            if (Date.now() - startTime > maxWait) {
                setVerificationMessage('Hết thời gian chờ giám thị. Vui lòng liên hệ hỗ trợ.');
                return;
            }

            try {
                const response = await fetch(`/api/identity/verify/escalation-status/${examId}`);
                const data = await response.json();

                if (data.status === 'APPROVED') {
                    setStatus('proctor_approved');
                    setVerificationMessage('Giám thị đã xác nhận danh tính. Đang chuyển hướng...');
                    setTimeout(() => {
                        navigate(`/exam/${examId}/waiting-room`);
                    }, 2000);
                    return;
                } else if (data.status === 'REJECTED') {
                    setStatus('proctor_rejected');
                    setVerificationMessage('Giám thị từ chối xác thực. Vui lòng liên hệ hỗ trợ.');
                    return;
                }

                // Continue polling
                setTimeout(poll, pollInterval);
            } catch (err) {
                console.error('Poll error:', err);
                setTimeout(poll, pollInterval);
            }
        };

        poll();
    };

    // Retry verification
    const handleRetry = () => {
        setStatus('ready');
        setError(null);
        setCapturedSnapshotUrl(null);
    };

    // Get quality color for UI
    const getQualityColor = () => {
        switch (qualityLevel) {
            case 'excellent': return 'text-green-600';
            case 'good': return 'text-green-500';
            case 'acceptable': return 'text-yellow-500';
            default: return 'text-gray-400';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white p-4">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold mb-2">Xác Thực Danh Tính</h1>
                    {exam && (
                        <p className="text-gray-400">
                            Phiên thi: {exam.name}
                        </p>
                    )}
                </div>

                {/* Error Alert */}
                {(error || streamError || qualityError) && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                            {error || streamError?.message || qualityError}
                        </AlertDescription>
                    </Alert>
                )}

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Camera Preview */}
                    <div className="lg:col-span-2">
                        <Card className="bg-slate-800/50 border-slate-700">
                            <CardContent className="p-4">
                                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                                    {/* Video element (hidden, used by canvas) */}
                                    <video
                                        ref={videoRef}
                                        autoPlay
                                        playsInline
                                        muted
                                        className="absolute inset-0 w-full h-full object-cover opacity-0"
                                    />

                                    {/* Canvas with overlays */}
                                    <canvas
                                        ref={canvasRef}
                                        className="absolute inset-0 w-full h-full object-cover"
                                    />

                                    {/* Countdown Overlay */}
                                    {countdown !== null && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                                            <div className="text-8xl font-bold text-white animate-pulse">
                                                {countdown}
                                            </div>
                                        </div>
                                    )}

                                    {/* Verification Status Overlay */}
                                    {status === 'verifying' && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
                                            <div className="text-center">
                                                <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-blue-400" />
                                                <p className="text-lg">{verificationMessage}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Verified Overlay */}
                                    {status === 'verified' && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-green-900/70">
                                            <div className="text-center">
                                                <Check className="w-16 h-16 mx-auto mb-4 text-green-400" />
                                                <p className="text-xl font-semibold">{verificationMessage}</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Awaiting Proctor Overlay */}
                                    {(status === 'escalated' || status === 'awaiting_proctor') && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-yellow-900/70">
                                            <div className="text-center px-4">
                                                <UserCheck className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
                                                <p className="text-xl font-semibold mb-2">Chờ Giám Thị Xác Thực</p>
                                                <p className="text-sm text-yellow-200">{verificationMessage}</p>
                                                <div className="mt-4">
                                                    <Loader2 className="w-6 h-6 mx-auto animate-spin" />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Proctor Approved Overlay */}
                                    {status === 'proctor_approved' && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-green-900/70">
                                            <div className="text-center">
                                                <UserCheck className="w-16 h-16 mx-auto mb-4 text-green-400" />
                                                <p className="text-xl font-semibold">{verificationMessage}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Quality Score Bar */}
                                {metrics && status === 'ready' && (
                                    <div className="mt-4">
                                        <div className="flex justify-between text-sm mb-1">
                                            <span>Chất lượng ảnh</span>
                                            <span className={getQualityColor()}>
                                                {metrics.qualityScore}/100
                                            </span>
                                        </div>
                                        <Progress
                                            value={metrics.qualityScore}
                                            className="h-2"
                                        />
                                    </div>
                                )}

                                {/* Retry Count */}
                                {retryCount > 0 && status !== 'escalated' && (
                                    <div className="mt-4 text-center text-sm text-yellow-400">
                                        Số lần thử: {retryCount}/{MAX_RETRY_ATTEMPTS}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    {/* Quality Indicators & Actions */}
                    <div className="space-y-4">
                        {/* Quality Indicators */}
                        <Card className="bg-slate-800/50 border-slate-700">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg">Kiểm Tra Chất Lượng</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                <QualityIndicator
                                    label="Khuôn mặt trong khung"
                                    isOk={metrics?.faceInFrame ?? false}
                                    icon={<Move className="w-4 h-4" />}
                                />
                                <QualityIndicator
                                    label="Ánh sáng đủ"
                                    isOk={metrics?.lightingOk ?? false}
                                    icon={<Sun className="w-4 h-4" />}
                                />
                                <QualityIndicator
                                    label="Hình ảnh rõ nét"
                                    isOk={metrics?.sharpnessOk ?? false}
                                    icon={<Focus className="w-4 h-4" />}
                                />
                                <QualityIndicator
                                    label="Nhìn thẳng camera"
                                    isOk={metrics?.faceFrontal ?? false}
                                    icon={<Eye className="w-4 h-4" />}
                                />
                            </CardContent>
                        </Card>

                        {/* Suggestions */}
                        {suggestions.length > 0 && status === 'ready' && (
                            <Card className="bg-slate-800/50 border-slate-700">
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-lg">Gợi ý</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <ul className="space-y-1 text-sm text-gray-300">
                                        {suggestions.slice(0, 3).map((s, i) => (
                                            <li key={i} className="flex items-start gap-2">
                                                <span className="text-yellow-400 mt-0.5">•</span>
                                                {s}
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        )}

                        {/* Actions */}
                        <div className="space-y-3">
                            {status === 'ready' && (
                                <Button
                                    onClick={handleCapture}
                                    disabled={!isQualityOk || !qualityReady}
                                    className="w-full h-14 text-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                                >
                                    <Camera className="w-5 h-5 mr-2" />
                                    {isQualityOk ? 'Chụp Ảnh Xác Thực' : 'Điều chỉnh theo gợi ý'}
                                </Button>
                            )}

                            {status === 'failed' && (
                                <Button
                                    onClick={handleRetry}
                                    className="w-full h-14 text-lg bg-gradient-to-r from-yellow-600 to-yellow-700"
                                >
                                    <RefreshCw className="w-5 h-5 mr-2" />
                                    Thử Lại ({MAX_RETRY_ATTEMPTS - retryCount} lần còn lại)
                                </Button>
                            )}

                            <Button
                                variant="outline"
                                onClick={() => navigate('/exams')}
                                className="w-full border-slate-600 text-gray-300 hover:bg-slate-700"
                            >
                                Quay lại danh sách bài thi
                            </Button>
                        </div>

                        {/* Instructions */}
                        <Card className="bg-slate-800/50 border-slate-700">
                            <CardContent className="p-4 text-sm text-gray-400">
                                <p className="font-medium text-white mb-2">Hướng dẫn:</p>
                                <ul className="space-y-1">
                                    <li>• Đặt mặt vào trong khung oval</li>
                                    <li>• Đảm bảo đủ ánh sáng</li>
                                    <li>• Nhìn thẳng vào camera</li>
                                    <li>• Mở mắt và giữ yên</li>
                                </ul>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ExamQueueSnapshotPage;
