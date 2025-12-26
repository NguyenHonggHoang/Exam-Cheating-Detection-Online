/**
 * AdminViolationsPage
 * 
 * Comprehensive violations management page for admins.
 * Features:
 * - Summary statistics (total, pending, reviewed, by severity)
 * - Filterable table of all incidents
 * - Status update actions (review, dismiss, escalate)
 * - Evidence viewer
 */

import { useState, useEffect, useCallback } from 'react';
import {
    incidentsApi,
    type Incident,
    type IncidentSummary,
    type IncidentStatus,
    type IncidentSeverity,
    type IncidentType
} from '@/api/incidents';
import { examsApi, type Exam } from '@/api/exams';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui/card';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Alert, AlertDescription } from '@/ui/alert';
import {
    AlertTriangle,
    AlertCircle,
    CheckCircle,
    Clock,
    Eye,
    EyeOff,
    Filter,
    RefreshCw,
    Search,
    Users,
    XCircle,
    Camera,
    Monitor,
    Loader2,
    ChevronLeft,
    ChevronRight,
    Image,
    Play,
    X
} from 'lucide-react';

const SEVERITY_CONFIG = {
    LOW: { label: 'Thấp', color: 'bg-yellow-100 text-yellow-800', icon: AlertCircle },
    MEDIUM: { label: 'Trung bình', color: 'bg-orange-100 text-orange-800', icon: AlertTriangle },
    HIGH: { label: 'Cao', color: 'bg-red-100 text-red-800', icon: XCircle },
};

const STATUS_CONFIG = {
    PENDING: { label: 'Chờ xử lý', color: 'bg-yellow-100 text-yellow-800' },
    UNDER_REVIEW: { label: 'Đang xét duyệt', color: 'bg-blue-100 text-blue-800' },
    REVIEWED: { label: 'Đã xem xét', color: 'bg-green-100 text-green-800' },
    DISMISSED: { label: 'Đã bỏ qua', color: 'bg-gray-100 text-gray-600' },
    ESCALATED: { label: 'Đã báo cáo', color: 'bg-red-100 text-red-800' },
};

const TYPE_CONFIG: Record<IncidentType, { label: string; icon: typeof AlertTriangle }> = {
    MULTIPLE_FACES: { label: 'Nhiều khuôn mặt', icon: Users },
    NO_FACE: { label: 'Không phát hiện mặt', icon: EyeOff },
    LOOKING_AWAY: { label: 'Nhìn đi chỗ khác', icon: Eye },
    TAB_SWITCH: { label: 'Chuyển tab', icon: Monitor },
    PASTE: { label: 'Dán nội dung', icon: Monitor },
    BLUR: { label: 'Cửa sổ bị blur', icon: Monitor },
    FOCUS: { label: 'Mất focus', icon: Monitor },
    DEVICE_CHANGE: { label: 'Đổi thiết bị', icon: Camera },
    BROWSER_EXTENSION: { label: 'Extension bị cấm', icon: AlertCircle },
    ANSWER_BEHAVIOR_ANOMALY: { label: 'Hành vi trả lời bất thường', icon: AlertTriangle },
    SCREENSHOT_ATTEMPT: { label: 'Cố gắng chụp màn hình', icon: Camera },
    USER_IDLE: { label: 'Người dùng không hoạt động', icon: Clock },
    BEHAVIOR_ANALYSIS: { label: 'Phân tích hành vi', icon: AlertCircle },
};

export function AdminViolationsPage() {
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [summary, setSummary] = useState<IncidentSummary | null>(null);
    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [statusFilter, setStatusFilter] = useState<IncidentStatus | ''>('');
    const [severityFilter, setSeverityFilter] = useState<IncidentSeverity | ''>('');
    const [examFilter, setExamFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState('');

    // Pagination
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [totalElements, setTotalElements] = useState(0);
    const pageSize = 20;

    // Evidence modal
    const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);

    // Update status
    const [updatingId, setUpdatingId] = useState<string | null>(null);

    const loadData = useCallback(async (showRefreshing = true) => {
        if (showRefreshing) setRefreshing(true);
        setError(null);

        try {
            // Load incidents with filters
            const params: Record<string, unknown> = {
                page,
                size: pageSize,
                sort: 'detectedAt,desc',
            };
            if (statusFilter) params.status = statusFilter;
            if (severityFilter) params.severity = severityFilter;
            if (examFilter) params.examId = examFilter;

            const incidentsData = await incidentsApi.list(params as Parameters<typeof incidentsApi.list>[0]);
            setIncidents(incidentsData.content);
            setTotalPages(incidentsData.totalPages);
            setTotalElements(incidentsData.totalElements);

            // Load summary
            const summaryData = await incidentsApi.getSummary();
            setSummary(summaryData);

            // Load exams for filter dropdown
            const examsData = await examsApi.getAll();
            setExams(examsData);
        } catch (err) {
            console.error('Error loading data:', err);
            setError('Không thể tải dữ liệu vi phạm. Vui lòng thử lại.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [page, statusFilter, severityFilter, examFilter]);

    useEffect(() => {
        loadData(false);
    }, [loadData]);

    const handleUpdateStatus = async (incidentId: string, newStatus: IncidentStatus) => {
        setUpdatingId(incidentId);
        try {
            await incidentsApi.updateStatus(incidentId, newStatus);
            // Refresh data
            await loadData(false);
        } catch (err) {
            console.error('Error updating status:', err);
            setError('Không thể cập nhật trạng thái');
        } finally {
            setUpdatingId(null);
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getSeverityBadge = (severity: IncidentSeverity) => {
        const config = SEVERITY_CONFIG[severity];
        return <Badge className={config.color}>{config.label}</Badge>;
    };

    const getStatusBadge = (status: IncidentStatus) => {
        const config = STATUS_CONFIG[status];
        return <Badge className={config.color}>{config.label}</Badge>;
    };

    const getTypeBadge = (type: IncidentType) => {
        const config = TYPE_CONFIG[type] || { label: type, icon: AlertCircle };
        const Icon = config.icon;
        return (
            <span className="flex items-center gap-1 text-sm">
                <Icon className="w-4 h-4" />
                {config.label}
            </span>
        );
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
            <div className="container mx-auto p-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Quản Lý Vi Phạm</h1>
                        <p className="text-gray-500 mt-1">Xem xét và xử lý các vi phạm trong kỳ thi</p>
                    </div>
                    <Button onClick={() => loadData(true)} disabled={refreshing} variant="outline">
                        <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                        Làm mới
                    </Button>
                </div>

                {/* Error Alert */}
                {error && (
                    <Alert variant="destructive" className="mb-6">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
                    <Card className="border-0 shadow-sm">
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold text-gray-900">{summary?.totalIncidents || 0}</div>
                            <div className="text-sm text-gray-500">Tổng vi phạm</div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm bg-yellow-50">
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold text-yellow-700">{summary?.pendingIncidents || 0}</div>
                            <div className="text-sm text-yellow-600">Chờ xử lý</div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm bg-green-50">
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold text-green-700">{summary?.reviewedIncidents || 0}</div>
                            <div className="text-sm text-green-600">Đã xem xét</div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm bg-gray-50">
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold text-gray-600">{summary?.dismissedIncidents || 0}</div>
                            <div className="text-sm text-gray-500">Đã bỏ qua</div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold text-yellow-600">{summary?.lowSeverityCount || 0}</div>
                            <div className="text-sm text-gray-500">Mức thấp</div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold text-orange-600">{summary?.mediumSeverityCount || 0}</div>
                            <div className="text-sm text-gray-500">Mức TB</div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                        <CardContent className="pt-4">
                            <div className="text-2xl font-bold text-red-600">{summary?.highSeverityCount || 0}</div>
                            <div className="text-sm text-gray-500">Mức cao</div>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card className="mb-6 border-0 shadow-sm">
                    <CardContent className="py-4">
                        <div className="flex flex-wrap gap-4 items-center">
                            {/* Exam Filter */}
                            <select
                                value={examFilter}
                                onChange={(e) => { setExamFilter(e.target.value); setPage(0); }}
                                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Tất cả kỳ thi</option>
                                {exams.map(exam => (
                                    <option key={exam.id} value={exam.id}>{exam.name}</option>
                                ))}
                            </select>

                            {/* Status Filter */}
                            <select
                                value={statusFilter}
                                onChange={(e) => { setStatusFilter(e.target.value as IncidentStatus | ''); setPage(0); }}
                                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Tất cả trạng thái</option>
                                <option value="PENDING">Chờ xử lý</option>
                                <option value="UNDER_REVIEW">Đang xét duyệt</option>
                                <option value="REVIEWED">Đã xem xét</option>
                                <option value="DISMISSED">Đã bỏ qua</option>
                                <option value="ESCALATED">Đã báo cáo</option>
                            </select>

                            {/* Severity Filter */}
                            <select
                                value={severityFilter}
                                onChange={(e) => { setSeverityFilter(e.target.value as IncidentSeverity | ''); setPage(0); }}
                                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Tất cả mức độ</option>
                                <option value="LOW">Thấp</option>
                                <option value="MEDIUM">Trung bình</option>
                                <option value="HIGH">Cao</option>
                            </select>

                            {/* Clear Filters */}
                            {(statusFilter || severityFilter || examFilter) && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                        setStatusFilter('');
                                        setSeverityFilter('');
                                        setExamFilter('');
                                        setPage(0);
                                    }}
                                >
                                    <X className="w-4 h-4 mr-1" />
                                    Xóa bộ lọc
                                </Button>
                            )}

                            <div className="ml-auto text-sm text-gray-500">
                                {totalElements} vi phạm
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Incidents Table */}
                <Card className="border-0 shadow-sm">
                    <CardHeader>
                        <CardTitle>Danh sách vi phạm</CardTitle>
                        <CardDescription>
                            Trang {page + 1} / {totalPages || 1}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            </div>
                        ) : incidents.length === 0 ? (
                            <div className="text-center py-12">
                                <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-4" />
                                <p className="text-gray-500">Không có vi phạm nào</p>
                            </div>
                        ) : (
                            <>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b bg-gray-50">
                                                <th className="text-left py-3 px-4 font-medium text-gray-700">Thời gian</th>
                                                <th className="text-left py-3 px-4 font-medium text-gray-700">Loại</th>
                                                <th className="text-left py-3 px-4 font-medium text-gray-700">Mức độ</th>
                                                <th className="text-left py-3 px-4 font-medium text-gray-700">Trạng thái</th>
                                                <th className="text-left py-3 px-4 font-medium text-gray-700">Phát hiện bởi</th>
                                                <th className="text-left py-3 px-4 font-medium text-gray-700">Bằng chứng</th>
                                                <th className="text-right py-3 px-4 font-medium text-gray-700">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {incidents.map((incident) => (
                                                <tr key={incident.id} className="border-b hover:bg-gray-50 transition-colors">
                                                    <td className="py-3 px-4 text-sm">
                                                        {formatDate(incident.detectedAt)}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {getTypeBadge(incident.type)}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {getSeverityBadge(incident.severity)}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {getStatusBadge(incident.status)}
                                                    </td>
                                                    <td className="py-3 px-4 text-sm text-gray-600">
                                                        {incident.detectedBy === 'FRONTEND_AI' ? 'AI Client' :
                                                            incident.detectedBy === 'SERVER_AI' ? 'AI Server' : 'Giám thị'}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        {incident.objectKey ? (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => setSelectedIncident(incident)}
                                                            >
                                                                <Image className="w-4 h-4 mr-1" />
                                                                Xem
                                                            </Button>
                                                        ) : (
                                                            <span className="text-gray-400 text-sm">Không có</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <div className="flex items-center justify-end gap-1">
                                                            {incident.status === 'PENDING' && (
                                                                <>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleUpdateStatus(incident.id, 'REVIEWED')}
                                                                        disabled={updatingId === incident.id}
                                                                        className="text-green-600 hover:text-green-700"
                                                                        title="Xác nhận vi phạm"
                                                                    >
                                                                        {updatingId === incident.id ? (
                                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                                        ) : (
                                                                            <CheckCircle className="w-4 h-4" />
                                                                        )}
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleUpdateStatus(incident.id, 'DISMISSED')}
                                                                        disabled={updatingId === incident.id}
                                                                        className="text-gray-600 hover:text-gray-700"
                                                                        title="Bỏ qua"
                                                                    >
                                                                        <XCircle className="w-4 h-4" />
                                                                    </Button>
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => handleUpdateStatus(incident.id, 'ESCALATED')}
                                                                        disabled={updatingId === incident.id}
                                                                        className="text-red-600 hover:text-red-700"
                                                                        title="Báo cáo nghiêm trọng"
                                                                    >
                                                                        <AlertTriangle className="w-4 h-4" />
                                                                    </Button>
                                                                </>
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination */}
                                <div className="flex items-center justify-between mt-4">
                                    <div className="text-sm text-gray-500">
                                        Hiển thị {incidents.length} / {totalElements} vi phạm
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(p => Math.max(0, p - 1))}
                                            disabled={page === 0}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </Button>
                                        <span className="px-3 py-1 text-sm">
                                            {page + 1} / {totalPages || 1}
                                        </span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                            disabled={page >= totalPages - 1}
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Evidence Modal */}
                {selectedIncident && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedIncident(null)}>
                        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold">Bằng chứng vi phạm</h3>
                                <Button variant="ghost" size="sm" onClick={() => setSelectedIncident(null)}>
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span className="text-gray-500">Loại:</span> {getTypeBadge(selectedIncident.type)}</div>
                                    <div><span className="text-gray-500">Mức độ:</span> {getSeverityBadge(selectedIncident.severity)}</div>
                                    <div><span className="text-gray-500">Thời gian:</span> {formatDate(selectedIncident.detectedAt)}</div>
                                    <div><span className="text-gray-500">Trạng thái:</span> {getStatusBadge(selectedIncident.status)}</div>
                                </div>
                                {selectedIncident.objectKey && (
                                    <div className="border rounded-lg overflow-hidden bg-gray-100">
                                        {selectedIncident.objectKey.match(/\.(mp4|webm|ogg)$/i) ? (
                                            <video
                                                src={`/api/proxy/incidents/${selectedIncident.id}/evidence`}
                                                controls
                                                className="w-full max-h-96"
                                            />
                                        ) : (
                                            <img
                                                src={`/api/proxy/incidents/${selectedIncident.id}/evidence`}
                                                alt="Evidence"
                                                className="w-full max-h-96 object-contain"
                                            />
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default AdminViolationsPage;
