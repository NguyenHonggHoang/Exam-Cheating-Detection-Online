/**
 * VerificationEscalationPanel
 * 
 * Component for proctors to review identity verification escalations.
 * Shows side-by-side comparison of ID photo and captured snapshot.
 * Supports realtime WebSocket notifications for new escalations.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui/card';
import { Button } from '@/ui/button';
import { Alert, AlertDescription } from '@/ui/alert';
import { Badge } from '@/ui/badge';
import { useEscalationNotifications } from '@/lib/hooks/useWebSocket';
import {
    UserCheck,
    UserX,
    RefreshCw,
    Clock,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Image,
    User,
    ChevronDown,
    ChevronUp,
    Bell,
    Wifi,
    WifiOff,
} from 'lucide-react';

interface Escalation {
    id: string;
    sessionId: string;
    userId: string;
    snapshotUrl: string | null;
    idPhotoUrl: string | null;
    reason: string;
    attemptCount: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
    createdAt: string;
    expiresAt: string;
}

interface Props {
    onEscalationReviewed?: (escalationId: string, approved: boolean) => void;
}

export function VerificationEscalationPanel({ onEscalationReviewed }: Props) {
    const [escalations, setEscalations] = useState<Escalation[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [reviewNote, setReviewNote] = useState('');
    const [newEscalationAlert, setNewEscalationAlert] = useState(false);

    // WebSocket for realtime notifications
    const { isConnected: wsConnected, latestEscalation } = useEscalationNotifications((data) => {
        console.log('[WS] New escalation received:', data);
        // Play notification sound
        try {
            const audio = new Audio('/notification.mp3');
            audio.volume = 0.5;
            audio.play().catch(() => { });
        } catch (e) {
            console.log('Audio notification not available');
        }
        // Show alert
        setNewEscalationAlert(true);
        // Reload escalations
        loadEscalations();
        // Auto-hide alert after 5 seconds
        setTimeout(() => setNewEscalationAlert(false), 5000);
    });

    // Load pending escalations
    const loadEscalations = useCallback(async () => {
        try {
            const response = await fetch('/api/identity/verify/escalations/pending', {
                credentials: 'include',
            });

            if (!response.ok) {
                throw new Error('Failed to fetch escalations');
            }

            const data = await response.json();
            setEscalations(data);
            setError(null);
        } catch (err) {
            console.error('Failed to load escalations:', err);
            setError('Không thể tải danh sách xác thực');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadEscalations();

        // Auto-refresh every 30 seconds (less frequent since we have WebSocket)
        const interval = setInterval(loadEscalations, 30000);
        return () => clearInterval(interval);
    }, [loadEscalations]);

    // Handle approve
    const handleApprove = async (escalationId: string) => {
        setProcessingId(escalationId);

        try {
            const response = await fetch(`/api/identity/verify/escalations/${escalationId}/approve`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note: reviewNote || 'Approved by proctor' }),
            });

            if (!response.ok) {
                throw new Error('Failed to approve');
            }

            // Remove from list
            setEscalations(prev => prev.filter(e => e.id !== escalationId));
            setExpandedId(null);
            setReviewNote('');
            onEscalationReviewed?.(escalationId, true);
        } catch (err) {
            console.error('Failed to approve:', err);
            setError('Không thể xác nhận');
        } finally {
            setProcessingId(null);
        }
    };

    // Handle reject
    const handleReject = async (escalationId: string) => {
        setProcessingId(escalationId);

        try {
            const response = await fetch(`/api/identity/verify/escalations/${escalationId}/reject`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ note: reviewNote || 'Rejected by proctor' }),
            });

            if (!response.ok) {
                throw new Error('Failed to reject');
            }

            // Remove from list
            setEscalations(prev => prev.filter(e => e.id !== escalationId));
            setExpandedId(null);
            setReviewNote('');
            onEscalationReviewed?.(escalationId, false);
        } catch (err) {
            console.error('Failed to reject:', err);
            setError('Không thể từ chối');
        } finally {
            setProcessingId(null);
        }
    };

    // Calculate time remaining
    const getTimeRemaining = (expiresAt: string) => {
        const now = new Date();
        const expires = new Date(expiresAt);
        const diff = expires.getTime() - now.getTime();

        if (diff <= 0) return 'Hết hạn';

        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);

        return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };

    if (loading && escalations.length === 0) {
        return (
            <Card>
                <CardContent className="py-8 text-center">
                    <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-gray-400" />
                    <p className="text-gray-500">Đang tải...</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            {/* New Escalation Alert */}
            {newEscalationAlert && (
                <div className="bg-orange-500 text-white px-4 py-2 flex items-center gap-2 animate-pulse">
                    <Bell className="w-4 h-4" />
                    <span className="font-medium">Có yêu cầu xác thực mới!</span>
                </div>
            )}

            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle className="flex items-center gap-2">
                        <UserCheck className="w-5 h-5" />
                        Xác Thực Thủ Công
                        {escalations.length > 0 && (
                            <Badge variant="destructive" className="ml-2">
                                {escalations.length}
                            </Badge>
                        )}
                        {/* WebSocket Status */}
                        <span className={`ml-2 flex items-center gap-1 text-xs ${wsConnected ? 'text-green-600' : 'text-gray-400'}`}>
                            {wsConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                            {wsConnected ? 'Live' : 'Offline'}
                        </span>
                    </CardTitle>
                    <CardDescription>
                        Sinh viên cần xác thực danh tính thủ công
                    </CardDescription>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={loadEscalations}
                    disabled={loading}
                >
                    <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                    Làm mới
                </Button>
            </CardHeader>

            <CardContent>
                {error && (
                    <Alert variant="destructive" className="mb-4">
                        <AlertTriangle className="w-4 h-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {escalations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                        <p>Không có yêu cầu xác thực nào đang chờ</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {escalations.map(escalation => {
                            const isExpanded = expandedId === escalation.id;
                            const isProcessing = processingId === escalation.id;

                            return (
                                <div
                                    key={escalation.id}
                                    className="border rounded-lg overflow-hidden"
                                >
                                    {/* Header */}
                                    <button
                                        onClick={() => setExpandedId(isExpanded ? null : escalation.id)}
                                        className="w-full p-4 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                                                <User className="w-5 h-5 text-orange-600" />
                                            </div>
                                            <div className="text-left">
                                                <p className="font-medium">
                                                    Sinh viên: {escalation.userId.substring(0, 8)}...
                                                </p>
                                                <p className="text-sm text-gray-500">
                                                    Số lần thử: {escalation.attemptCount}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <div className="flex items-center gap-1 text-sm text-orange-600">
                                                <Clock className="w-4 h-4" />
                                                {getTimeRemaining(escalation.expiresAt)}
                                            </div>
                                            {isExpanded ? (
                                                <ChevronUp className="w-5 h-5 text-gray-400" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5 text-gray-400" />
                                            )}
                                        </div>
                                    </button>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div className="p-4 border-t">
                                            {/* Side-by-side Photo Comparison */}
                                            <div className="grid grid-cols-2 gap-4 mb-4">
                                                {/* ID Photo */}
                                                <div className="text-center">
                                                    <p className="text-sm font-medium text-gray-600 mb-2">
                                                        Ảnh CMND/CCCD
                                                    </p>
                                                    <div className="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden border-2 border-blue-200">
                                                        {escalation.idPhotoUrl ? (
                                                            <img
                                                                src={escalation.idPhotoUrl}
                                                                alt="ID Photo"
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="flex items-center justify-center h-full text-gray-400">
                                                                <Image className="w-8 h-8" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Captured Snapshot */}
                                                <div className="text-center">
                                                    <p className="text-sm font-medium text-gray-600 mb-2">
                                                        Ảnh Chụp Webcam
                                                    </p>
                                                    <div className="aspect-[3/4] bg-gray-100 rounded-lg overflow-hidden border-2 border-orange-200">
                                                        {escalation.snapshotUrl ? (
                                                            <img
                                                                src={escalation.snapshotUrl}
                                                                alt="Snapshot"
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="flex items-center justify-center h-full text-gray-400">
                                                                <Image className="w-8 h-8" />
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Reason */}
                                            <div className="mb-4 p-3 bg-yellow-50 rounded-lg">
                                                <p className="text-sm text-yellow-800">
                                                    <strong>Lý do:</strong> {escalation.reason}
                                                </p>
                                            </div>

                                            {/* Review Note */}
                                            <div className="mb-4">
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    Ghi chú (tùy chọn)
                                                </label>
                                                <textarea
                                                    value={reviewNote}
                                                    onChange={(e) => setReviewNote(e.target.value)}
                                                    placeholder="Nhập ghi chú xác thực..."
                                                    className="w-full px-3 py-2 border rounded-lg text-sm resize-none"
                                                    rows={2}
                                                />
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="flex gap-3">
                                                <Button
                                                    onClick={() => handleApprove(escalation.id)}
                                                    disabled={isProcessing}
                                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                                >
                                                    {isProcessing ? (
                                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                                    ) : (
                                                        <CheckCircle className="w-4 h-4 mr-2" />
                                                    )}
                                                    Xác Nhận Đúng
                                                </Button>

                                                <Button
                                                    onClick={() => handleReject(escalation.id)}
                                                    disabled={isProcessing}
                                                    variant="destructive"
                                                    className="flex-1"
                                                >
                                                    {isProcessing ? (
                                                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                                    ) : (
                                                        <XCircle className="w-4 h-4 mr-2" />
                                                    )}
                                                    Từ Chối
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default VerificationEscalationPanel;
