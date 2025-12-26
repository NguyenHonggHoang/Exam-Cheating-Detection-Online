import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { incidentsApi, type Incident, type IncidentDetailed, type IncidentSummary, type IncidentStatus } from '@/api/incidents';
import { EvidenceViewer } from '@/components/EvidenceViewer';
import { AnswerBehaviorDashboard } from '@/components/AnswerBehaviorDashboard';
import { VideoMetadataPanel } from '@/components/VideoMetadataPanel';
import { AnswerLogsPanel } from '@/components/AnswerLogsPanel';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Button } from '@/ui/button';
import { Alert, AlertDescription } from '@/ui/alert';
import {
    Clock, CheckCircle, XCircle, Eye,
    Filter, RefreshCw, ChevronDown, ChevronUp, ImageIcon,
    User, Calendar, FileText, AlertTriangle, Video, Wifi, List, BarChart3, ExternalLink
} from 'lucide-react';
import useIncidentSSE from '@/lib/hooks/useIncidentSSE';
import { getViolationLabel } from '@/lib/utils/violationLabels';

/**
 * Proctor Violations Page
 * 
 * Shows all violations with filtering, evidence viewing, and review capabilities
 */
const ProctorViolationsPage: React.FC = () => {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [summary, setSummary] = useState<IncidentSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
    const [detailedIncident, setDetailedIncident] = useState<IncidentDetailed | null>(null);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [updating, setUpdating] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [severityFilter, setSeverityFilter] = useState<string>('');
    const [showFilters, setShowFilters] = useState(false);

    // SSE Real-time updates
    const { isConnected } = useIncidentSSE({
        enabled: true,
        onNewIncident: (newIncident) => {
            console.log('⚡ New incident received via SSE:', newIncident.id);
            setIncidents(prev => [newIncident, ...prev].slice(0, 50)); // Keep 50 items max

            // Reload summary stats to update counts
            incidentsApi.getSummary({}).then(setSummary).catch(console.error);
        }
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const [incidentsData, summaryData] = await Promise.all([
                incidentsApi.list({
                    status: statusFilter as IncidentStatus || undefined,
                    severity: severityFilter as any || undefined,
                    size: 50
                }),
                incidentsApi.getSummary({})
            ]);

            // Debug: Log violation types to verify Vietnamese labels
            console.log('[Violations] Loaded incidents:', incidentsData.content.map(i => ({
                id: i.id,
                type: i.type,
                label: getViolationLabel(i.type)
            })));

            setIncidents(incidentsData.content);
            setSummary(summaryData);
        } catch (err) {
            console.error('Failed to load violations:', err);
            setError('Không thể tải danh sách vi phạm');
        } finally {
            setLoading(false);
        }
    }, [statusFilter, severityFilter]);

    // Load detailed incident when selected
    const loadIncidentDetail = useCallback(async (incidentId: string) => {
        setLoadingDetail(true);
        try {
            const detail = await incidentsApi.getById(incidentId);
            console.log('[Violations] Incident detail:', {
                id: detail.id,
                evidenceUrl: detail.evidenceUrl,
                objectKey: detail.objectKey,
                type: detail.type
            });
            setDetailedIncident(detail);
        } catch (err) {
            console.error('Failed to load incident detail:', err);
        } finally {
            setLoadingDetail(false);
        }
    }, []);

    useEffect(() => {
        loadData();
    }, [loadData]);

    useEffect(() => {
        if (selectedIncidentId) {
            loadIncidentDetail(selectedIncidentId);
        } else {
            setDetailedIncident(null);
        }
    }, [selectedIncidentId, loadIncidentDetail]);

    const handleSelectIncident = (incident: Incident) => {
        setSelectedIncidentId(incident.id);
    };

    const handleUpdateStatus = async (incidentId: string, newStatus: IncidentStatus) => {
        setUpdating(true);
        try {
            await incidentsApi.updateStatus(incidentId, newStatus);
            await loadData();
            // Reload detail
            if (selectedIncidentId === incidentId) {
                await loadIncidentDetail(incidentId);
            }
        } catch (err) {
            console.error('Failed to update status:', err);
        } finally {
            setUpdating(false);
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'HIGH': return 'bg-red-100 text-red-700 border-red-300';
            case 'MEDIUM': return 'bg-yellow-100 text-yellow-700 border-yellow-300';
            case 'LOW': return 'bg-blue-100 text-blue-700 border-blue-300';
            default: return 'bg-gray-100 text-gray-700 border-gray-300';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PENDING': return 'bg-orange-100 text-orange-700';
            case 'REVIEWED': return 'bg-green-100 text-green-700';
            case 'DISMISSED': return 'bg-gray-100 text-gray-600';
            case 'ESCALATED': return 'bg-red-100 text-red-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const formatDateTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-600">Đang tải danh sách vi phạm...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">🚨 Danh Sách Vi Phạm</h1>
                    <p className="text-gray-600 mt-1">Xem chi tiết và duyệt các vi phạm được phát hiện</p>
                </div>
                <div className="flex gap-2">
                    <div className={`flex items-center gap-1 text-xs px-2 rounded-full border ${isConnected ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        <Wifi className="w-3 h-3" />
                        {isConnected ? 'Real-time' : 'Offline'}
                    </div>
                    <Button
                        onClick={() => setShowFilters(!showFilters)}
                        variant="outline"
                        className="flex items-center gap-2"
                    >
                        <Filter className="w-4 h-4" />
                        Bộ lọc
                        {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                    <Button onClick={loadData} variant="outline" className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Làm mới
                    </Button>
                </div>
            </div>

            {/* Summary Cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="p-4 text-center">
                            <div className="text-3xl font-bold text-orange-600">{summary.pendingIncidents}</div>
                            <div className="text-sm text-gray-600">Chờ duyệt</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 text-center">
                            <div className="text-3xl font-bold text-green-600">{summary.reviewedIncidents}</div>
                            <div className="text-sm text-gray-600">Đã duyệt</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 text-center">
                            <div className="text-3xl font-bold text-red-600">{summary.highSeverityCount}</div>
                            <div className="text-sm text-gray-600">Nghiêm trọng</div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="p-4 text-center">
                            <div className="text-3xl font-bold text-blue-600">{summary.totalIncidents}</div>
                            <div className="text-sm text-gray-600">Tổng cộng</div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Filters */}
            {showFilters && (
                <Card>
                    <CardContent className="p-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg"
                                >
                                    <option value="">Tất cả</option>
                                    <option value="PENDING">Chờ duyệt</option>
                                    <option value="REVIEWED">Đã duyệt</option>
                                    <option value="DISMISSED">Đã bỏ qua</option>
                                    <option value="ESCALATED">Leo thang</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Mức độ</label>
                                <select
                                    value={severityFilter}
                                    onChange={(e) => setSeverityFilter(e.target.value)}
                                    className="w-full px-3 py-2 border rounded-lg"
                                >
                                    <option value="">Tất cả</option>
                                    <option value="HIGH">Nghiêm trọng</option>
                                    <option value="MEDIUM">Trung bình</option>
                                    <option value="LOW">Nhẹ</option>
                                </select>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {/* Incidents List and Detail */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* List - takes 1/3 */}
                <Card className="lg:col-span-1">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base">Vi phạm ({incidents.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 max-h-[650px] overflow-y-auto">
                        {incidents.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                Không có vi phạm nào
                            </div>
                        ) : (
                            <div className="divide-y">
                                {incidents.map((incident) => (
                                    <div
                                        key={incident.id}
                                        onClick={() => handleSelectIncident(incident)}
                                        className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors ${selectedIncidentId === incident.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${getSeverityColor(incident.severity)}`}>
                                                {incident.severity}
                                            </span>
                                            <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getStatusColor(incident.status)}`}>
                                                {incident.status}
                                            </span>
                                        </div>
                                        <div className="font-medium text-gray-900 text-sm">
                                            {getViolationLabel(incident.type)}
                                        </div>
                                        <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                            <Clock className="w-3 h-3" />
                                            {formatTime(incident.detectedAt)}
                                            {incident.evidenceUrl && <ImageIcon className="w-3 h-3 ml-2 text-blue-500" />}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Detail Panel - takes 2/3 */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                            <Eye className="w-5 h-5" />
                            Chi tiết vi phạm
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {loadingDetail ? (
                            <div className="flex items-center justify-center py-12">
                                <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            </div>
                        ) : detailedIncident ? (
                            <div className="space-y-6">
                                {/* Evidence (Image or Video) */}
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                        <Video className="w-4 h-4" />
                                        Bằng chứng vi phạm
                                    </h4>
                                    <EvidenceViewer
                                        url={detailedIncident.evidenceUrl}
                                        objectKey={detailedIncident.objectKey}
                                    />
                                </div>

                                {/* Answer Analysis Details (Legacy - can be removed if dashboard covers this) */}
                                {detailedIncident.type === 'ANSWER_BEHAVIOR_ANOMALY' && detailedIncident.metadata?.anomalies && (
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                            <FileText className="w-4 h-4" />
                                            Chi tiết phân tích hành vi
                                        </h4>
                                        <div className="bg-white border rounded-lg overflow-hidden">
                                            <table className="min-w-full text-sm">
                                                <thead className="bg-gray-50">
                                                    <tr>
                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Phương pháp (Method)</th>
                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Kết quả (Result)</th>
                                                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dữ liệu (Data)</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {(detailedIncident.metadata.anomalies as any[]).map((anomaly, idx) => {
                                                        const methodMap: Record<string, string> = {
                                                            'latency_spike': 'Phân tích độ trễ (Latency)',
                                                            'accuracy_jump': 'Độ chính xác bất thường (Accuracy)',
                                                            'revision_pattern': 'Mẫu sửa đổi (Revision)',
                                                            'difficulty_mismatch': 'Mâu thuẫn độ khó (Difficulty)',
                                                            'suspicious_timing': 'Thời gian đáng ngờ'
                                                        };
                                                        const details = anomaly.answerDetails;

                                                        return (
                                                            <tr key={idx} className="hover:bg-gray-50">
                                                                <td className="px-4 py-3 font-medium text-gray-900">
                                                                    {methodMap[anomaly.type] || anomaly.type}
                                                                    <div className="text-xs text-gray-500 mt-1">
                                                                        Score: <span className="font-mono text-orange-600">{anomaly.score}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-4 py-3 text-gray-700">
                                                                    {anomaly.description}
                                                                </td>
                                                                <td className="px-4 py-3 text-xs">
                                                                    {details ? (
                                                                        <div className="space-y-1">
                                                                            <div>⏱️ <span className="font-mono">{(details.timeSpent / 1000).toFixed(1)}s</span></div>
                                                                            <div>📊 <span className={`px-1 rounded ${details.difficulty === 'hard' ? 'bg-red-100 text-red-700' : details.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>{details.difficulty}</span></div>
                                                                            <div>{details.isCorrect ? '✅ Đúng' : '❌ Sai'}</div>
                                                                            {detailedIncident.metadata?.typingSpeed > 0 && <div>⌨️ {detailedIncident.metadata?.typingSpeed} WPM</div>}
                                                                        </div>
                                                                    ) : (
                                                                        <span className="text-gray-400">N/A</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}

                                {/* Metadata Grid */}
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                        <FileText className="w-4 h-4" />
                                        Thông tin chi tiết
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm bg-gray-50 p-4 rounded-lg">
                                        <div>
                                            <span className="text-gray-500 text-xs uppercase tracking-wide">Loại vi phạm</span>
                                            <div className="font-semibold text-gray-900 flex items-center gap-1">
                                                <AlertTriangle className="w-4 h-4 text-orange-500" />
                                                {getViolationLabel(detailedIncident.type)}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 text-xs uppercase tracking-wide">Mức độ</span>
                                            <div className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${getSeverityColor(detailedIncident.severity)}`}>
                                                {detailedIncident.severity === 'HIGH' ? 'Nghiêm trọng' :
                                                    detailedIncident.severity === 'MEDIUM' ? 'Trung bình' : 'Nhẹ'}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 text-xs uppercase tracking-wide">Trạng thái</span>
                                            <div className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${getStatusColor(detailedIncident.status)}`}>
                                                {detailedIncident.status}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 text-xs uppercase tracking-wide">Thời gian phát hiện</span>
                                            <div className="font-medium flex items-center gap-1">
                                                <Calendar className="w-4 h-4 text-gray-400" />
                                                {formatDateTime(detailedIncident.detectedAt)}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 text-xs uppercase tracking-wide">Phát hiện bởi</span>
                                            <div className="font-medium">
                                                {detailedIncident.detectedBy === 'FRONTEND_AI' ? '🤖 AI Frontend' :
                                                    detailedIncident.detectedBy === 'SERVER_AI' ? '🖥️ AI Server' : '👤 Giám thị'}
                                            </div>
                                        </div>
                                        <div>
                                            <span className="text-gray-500 text-xs uppercase tracking-wide">Session ID</span>
                                            <div className="font-medium font-mono text-xs">
                                                {detailedIncident.sessionId?.substring(0, 8)}...
                                            </div>
                                        </div>
                                        {detailedIncident.examId && (
                                            <div>
                                                <span className="text-gray-500 text-xs uppercase tracking-wide">Exam ID</span>
                                                <div className="font-medium font-mono text-xs">
                                                    {detailedIncident.examId.substring(0, 8)}...
                                                </div>
                                            </div>
                                        )}
                                        {detailedIncident.userId && (
                                            <div>
                                                <span className="text-gray-500 text-xs uppercase tracking-wide">User ID</span>
                                                <div className="font-medium font-mono text-xs flex items-center gap-1">
                                                    <User className="w-3 h-3" />
                                                    {detailedIncident.userId.substring(0, 8)}...
                                                </div>
                                            </div>
                                        )}
                                        {detailedIncident.sessionStatus && (
                                            <div>
                                                <span className="text-gray-500 text-xs uppercase tracking-wide">Trạng thái session</span>
                                                <div className="font-medium">{detailedIncident.sessionStatus}</div>
                                            </div>
                                        )}
                                        {detailedIncident.consecutiveCount && detailedIncident.consecutiveCount > 1 && (
                                            <div>
                                                <span className="text-gray-500 text-xs uppercase tracking-wide">Số lần liên tiếp</span>
                                                <div className="font-medium text-red-600">{detailedIncident.consecutiveCount} lần</div>
                                            </div>
                                        )}
                                        {detailedIncident.reviewedAt && (
                                            <div>
                                                <span className="text-gray-500 text-xs uppercase tracking-wide">Đã duyệt lúc</span>
                                                <div className="font-medium">{formatDateTime(detailedIncident.reviewedAt)}</div>
                                            </div>
                                        )}
                                        {detailedIncident.reviewedBy && (
                                            <div>
                                                <span className="text-gray-500 text-xs uppercase tracking-wide">Người duyệt</span>
                                                <div className="font-medium">{detailedIncident.reviewedBy}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                {detailedIncident.status === 'PENDING' && (
                                    <div className="flex gap-3 pt-4 border-t">
                                        <Button
                                            onClick={() => handleUpdateStatus(detailedIncident.id, 'REVIEWED')}
                                            disabled={updating}
                                            className="flex-1 bg-green-600 hover:bg-green-700"
                                        >
                                            <CheckCircle className="w-4 h-4 mr-2" />
                                            Xác nhận vi phạm
                                        </Button>
                                        <Button
                                            onClick={() => handleUpdateStatus(detailedIncident.id, 'DISMISSED')}
                                            disabled={updating}
                                            variant="outline"
                                            className="flex-1"
                                        >
                                            <XCircle className="w-4 h-4 mr-2" />
                                            Bỏ qua (False Positive)
                                        </Button>
                                    </div>
                                )}

                                {detailedIncident.status !== 'PENDING' && (
                                    <div className="pt-4 border-t text-center text-gray-500">
                                        <CheckCircle className="w-6 h-6 mx-auto mb-2 text-green-500" />
                                        Vi phạm này đã được xử lý
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center text-gray-500 py-16">
                                <Eye className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                <p className="text-lg">Chọn một vi phạm để xem chi tiết</p>
                                <p className="text-sm mt-2">Click vào vi phạm bên trái để xem thông tin đầy đủ và ảnh bằng chứng</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default ProctorViolationsPage;
