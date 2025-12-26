import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { sessionsApi, type Session } from '@/api/sessions';
import { AnswerBehaviorDashboard } from '@/components/AnswerBehaviorDashboard';
import { AnswerLogsPanel } from '@/components/AnswerLogsPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Button } from '@/ui/button';
import { Alert, AlertDescription } from '@/ui/alert';
import { Badge } from '@/ui/badge';
import {
  ArrowLeft,
  BarChart3,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Calendar,
  User,
  FileText,
  Clock
} from 'lucide-react';

/**
 * ProctorBehaviorAnalysisPage
 * 
 * Dedicated page for viewing answer behavior analysis and answer logs for a specific session.
 * 
 * Features:
 * - Load session details by ID from route param
 * - Load behavior analysis data from backend
 * - Display AnswerBehaviorDashboard with risk score and anomalies
 * - Display AnswerLogsPanel with sortable answer history
 * - Provide back navigation to violations list
 * - Handle loading and error states appropriately
 * 
 * **Validates: Requirements 5.1-5.10**
 */
const ProctorBehaviorAnalysisPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load session details from API
   */
  const loadSession = useCallback(async () => {
    if (!sessionId) {
      setError('Không tìm thấy Session ID');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await sessionsApi.getById(sessionId);
      console.log('[BehaviorAnalysisPage] Loaded session:', {
        id: data.id,
        examId: data.examId,
        status: data.status
      });
      setSession(data);
    } catch (err: any) {
      console.error('[BehaviorAnalysisPage] Failed to load session:', err);
      if (err.response?.status === 404) {
        setError('Không tìm thấy session');
      } else if (err.response?.status === 401) {
        setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
      } else {
        setError('Không thể tải thông tin session. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  /**
   * Navigate back to violations list
   */
  const handleBack = () => {
    navigate('/proctor/violations');
  };

  /**
   * Get status badge variant
   */
  const getStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'ACTIVE':
        return 'default';
      case 'ENDED':
        return 'secondary';
      case 'ABORTED':
        return 'destructive';
      case 'PAUSED':
        return 'outline';
      default:
        return 'outline';
    }
  };

  /**
   * Get status label in Vietnamese
   */
  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'ACTIVE':
        return 'Đang diễn ra';
      case 'ENDED':
        return 'Đã kết thúc';
      case 'ABORTED':
        return 'Đã hủy';
      case 'PAUSED':
        return 'Tạm dừng';
      default:
        return status;
    }
  };

  /**
   * Format datetime in Vietnamese locale
   */
  const formatDateTime = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  /**
   * Calculate session duration
   */
  const getSessionDuration = (startedAt: string, endedAt: string | null): string => {
    const start = new Date(startedAt).getTime();
    const end = endedAt ? new Date(endedAt).getTime() : Date.now();
    const durationMs = end - start;
    
    const minutes = Math.floor(durationMs / 60000);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    
    if (hours > 0) {
      return `${hours} giờ ${remainingMinutes} phút`;
    }
    return `${minutes} phút`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-2 text-gray-600">Đang tải thông tin phân tích...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        {/* Back button */}
        <Button
          onClick={handleBack}
          variant="outline"
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </Button>

        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>

        <div className="text-center">
          <Button onClick={loadSession} className="flex items-center gap-2 mx-auto">
            <RefreshCw className="w-4 h-4" />
            Thử lại
          </Button>
        </div>
      </div>
    );
  }

  // No session found - still show analysis components with sessionId
  // The child components will handle their own loading/error states

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            onClick={handleBack}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BarChart3 className="w-6 h-6" />
              Phân tích Hành vi
            </h1>
            <p className="text-gray-600 mt-1">
              Xem phân tích hành vi trả lời và lịch sử câu trả lời của thí sinh
            </p>
          </div>
        </div>
        <Button onClick={loadSession} variant="outline" className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Làm mới
        </Button>
      </div>

      {/* Session info card - Requirements 5.1 */}
      {session && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <User className="w-5 h-5 text-gray-500" />
                  <div>
                    <span className="text-sm text-gray-500">User ID</span>
                    <p className="font-mono text-sm truncate max-w-[150px]" title={session.userId}>
                      {session.userId.substring(0, 12)}...
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-gray-500" />
                  <div>
                    <span className="text-sm text-gray-500">Exam ID</span>
                    <p className="font-mono text-sm truncate max-w-[150px]" title={session.examId}>
                      {session.examId.substring(0, 12)}...
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-gray-500" />
                  <div>
                    <span className="text-sm text-gray-500">Bắt đầu</span>
                    <p className="text-sm">{formatDateTime(session.startedAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-500" />
                  <div>
                    <span className="text-sm text-gray-500">Thời lượng</span>
                    <p className="text-sm">{getSessionDuration(session.startedAt, session.endedAt)}</p>
                  </div>
                </div>
              </div>
              <Badge variant={getStatusVariant(session.status)}>
                {getStatusLabel(session.status)}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main content - Requirements 5.2-5.10 */}
      {sessionId && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Behavior Analysis Dashboard - Requirements 5.3-5.6 */}
          <div className="space-y-4">
            <AnswerBehaviorDashboard sessionId={sessionId} />
          </div>

          {/* Answer Logs Panel - Requirements 5.7-5.9 */}
          <div className="space-y-4">
            <AnswerLogsPanel sessionId={sessionId} />
          </div>
        </div>
      )}

      {/* Link to video analysis if available */}
      {session && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Liên kết nhanh
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                onClick={() => navigate('/proctor/violations')}
                variant="outline"
                className="flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4" />
                Xem danh sách vi phạm
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProctorBehaviorAnalysisPage;
