import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { incidentsApi, type IncidentDetailed } from '@/api/incidents';
import { EvidenceViewer } from '@/components/EvidenceViewer';
import { VideoMetadataPanel } from '@/components/VideoMetadataPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Button } from '@/ui/button';
import { Alert, AlertDescription } from '@/ui/alert';
import { Badge } from '@/ui/badge';
import { getViolationLabel } from '@/lib/utils/violationLabels';
import {
  ArrowLeft,
  Video,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Calendar,
  User,
  FileText
} from 'lucide-react';

/**
 * ProctorVideoAnalysisPage
 * 
 * Dedicated page for viewing evidence videos and analysis for a specific incident.
 * 
 * Features:
 * - Load incident details by ID from route param
 * - Display video with EvidenceViewer component
 * - Display video metadata with VideoMetadataPanel
 * - Show violation type in Vietnamese
 * - Provide back navigation to violations list
 * - Handle loading and error states appropriately
 * 
 * **Validates: Requirements 4.1-4.7**
 */
const ProctorVideoAnalysisPage: React.FC = () => {
  const { incidentId } = useParams<{ incidentId: string }>();
  const navigate = useNavigate();

  const [incident, setIncident] = useState<IncidentDetailed | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load incident details from API
   */
  const loadIncident = useCallback(async () => {
    if (!incidentId) {
      setError('Không tìm thấy ID vi phạm');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await incidentsApi.getById(incidentId);
      console.log('[VideoAnalysisPage] Loaded incident:', {
        id: data.id,
        type: data.type,
        evidenceUrl: data.evidenceUrl,
        objectKey: data.objectKey
      });
      setIncident(data);
    } catch (err: any) {
      console.error('[VideoAnalysisPage] Failed to load incident:', err);
      if (err.response?.status === 404) {
        setError('Không tìm thấy vi phạm');
      } else {
        setError('Không thể tải thông tin vi phạm. Vui lòng thử lại.');
      }
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    loadIncident();
  }, [loadIncident]);

  /**
   * Navigate back to violations list
   */
  const handleBack = () => {
    navigate('/proctor/violations');
  };

  /**
   * Get severity badge color
   */
  const getSeverityVariant = (severity: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (severity) {
      case 'HIGH':
        return 'destructive';
      case 'MEDIUM':
        return 'default';
      case 'LOW':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  /**
   * Get severity label in Vietnamese
   */
  const getSeverityLabel = (severity: string): string => {
    switch (severity) {
      case 'HIGH':
        return 'Nghiêm trọng';
      case 'MEDIUM':
        return 'Trung bình';
      case 'LOW':
        return 'Nhẹ';
      default:
        return severity;
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

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-2 text-gray-600">Đang tải thông tin vi phạm...</p>
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
          <Button onClick={loadIncident} className="flex items-center gap-2 mx-auto">
            <RefreshCw className="w-4 h-4" />
            Thử lại
          </Button>
        </div>
      </div>
    );
  }

  // No incident found
  if (!incident) {
    return (
      <div className="space-y-6">
        <Button
          onClick={handleBack}
          variant="outline"
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Quay lại
        </Button>

        <div className="text-center py-12">
          <AlertTriangle className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <p className="text-lg text-gray-600">Không tìm thấy vi phạm</p>
        </div>
      </div>
    );
  }

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
              <Video className="w-6 h-6" />
              Video & Phân tích
            </h1>
            <p className="text-gray-600 mt-1">
              Xem video bằng chứng và thông tin chi tiết vi phạm
            </p>
          </div>
        </div>
        <Button onClick={loadIncident} variant="outline" className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4" />
          Làm mới
        </Button>
      </div>

      {/* Violation type badge - Requirements 4.5 */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <div>
                <span className="text-sm text-gray-500">Loại vi phạm</span>
                <p className="font-semibold text-lg">
                  {getViolationLabel(incident.type)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={getSeverityVariant(incident.severity)}>
                {getSeverityLabel(incident.severity)}
              </Badge>
              <Badge variant="outline">
                {incident.status}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Video section - takes 2/3 on large screens */}
        <div className="lg:col-span-2 space-y-4">
          {/* Video player - Requirements 4.2, 4.3 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5" />
                Bằng chứng vi phạm
              </CardTitle>
            </CardHeader>
            <CardContent>
              <EvidenceViewer
                url={incident.evidenceUrl}
                objectKey={incident.objectKey}
              />
            </CardContent>
          </Card>
        </div>

        {/* Metadata section - takes 1/3 on large screens */}
        <div className="space-y-4">
          {/* Video metadata panel - Requirements 4.4 */}
          {incident.objectKey && incident.sessionId && (
            <VideoMetadataPanel
              objectKey={incident.objectKey}
              sessionId={incident.sessionId}
              violationType={incident.type}
            />
          )}

          {/* Additional incident info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Thông tin bổ sung
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {/* Detection time */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">Thời gian phát hiện</span>
                  </div>
                  <span className="font-medium text-sm">
                    {formatDateTime(incident.detectedAt)}
                  </span>
                </div>

                {/* Detected by */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="w-4 h-4" />
                    <span className="text-sm">Phát hiện bởi</span>
                  </div>
                  <span className="font-medium text-sm">
                    {incident.detectedBy === 'FRONTEND_AI' ? '🤖 AI Frontend' :
                      incident.detectedBy === 'SERVER_AI' ? '🖥️ AI Server' : '👤 Giám thị'}
                  </span>
                </div>

                {/* Session ID */}
                {incident.sessionId && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Session ID</span>
                    <span className="font-mono text-xs text-gray-700 truncate max-w-[150px]" title={incident.sessionId}>
                      {incident.sessionId.substring(0, 12)}...
                    </span>
                  </div>
                )}

                {/* Exam ID */}
                {incident.examId && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Exam ID</span>
                    <span className="font-mono text-xs text-gray-700 truncate max-w-[150px]" title={incident.examId}>
                      {incident.examId.substring(0, 12)}...
                    </span>
                  </div>
                )}

                {/* Consecutive count */}
                {incident.consecutiveCount && incident.consecutiveCount > 1 && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Số lần liên tiếp</span>
                    <span className="font-medium text-red-600">
                      {incident.consecutiveCount} lần
                    </span>
                  </div>
                )}

                {/* Reviewed info */}
                {incident.reviewedAt && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Đã duyệt lúc</span>
                    <span className="font-medium text-sm">
                      {formatDateTime(incident.reviewedAt)}
                    </span>
                  </div>
                )}

                {incident.reviewedBy && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Người duyệt</span>
                    <span className="font-medium text-sm">
                      {incident.reviewedBy}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Link to behavior analysis if session exists */}
          {incident.sessionId && (
            <Card>
              <CardContent className="p-4">
                <Button
                  onClick={() => navigate(`/proctor/behavior-analysis/${incident.sessionId}`)}
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Xem Phân tích Hành vi
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProctorVideoAnalysisPage;
