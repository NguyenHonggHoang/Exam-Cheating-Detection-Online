import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { incidentsApi, type Incident } from '@/api/incidents';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Button } from '@/ui/button';
import { Alert, AlertDescription } from '@/ui/alert';
import { Badge } from '@/ui/badge';
import { getViolationLabel } from '@/lib/utils/violationLabels';
import {
    Video,
    RefreshCw,
    Filter,
    ChevronDown,
    ChevronUp,
    Calendar,
    User,
    AlertTriangle,
    Eye
} from 'lucide-react';

/**
 * Proctor Video Analysis List Page
 * 
 * Displays a list of incidents that have video evidence.
 * Clicking on an incident navigates to the detailed video analysis page.
 */
const ProctorVideoAnalysisListPage: React.FC = () => {
    const navigate = useNavigate();
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [severityFilter, setSeverityFilter] = useState<string>('');

    const loadIncidents = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await incidentsApi.list({
                status: statusFilter as any || undefined,
                severity: severityFilter as any || undefined,
                size: 100
            });

            // Filter only incidents with video evidence
            const withVideo = result.content.filter(
                inc => inc.evidenceUrl || inc.objectKey
            );
            setIncidents(withVideo);
        } catch (err) {
            console.error('Failed to load incidents:', err);
            setError('Không thể tải danh sách vi phạm có video');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadIncidents();
    }, [statusFilter, severityFilter]);

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

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-600">Đang tải danh sách...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Video className="w-7 h-7" />
                        Phân Tích Video
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Danh sách vi phạm có video bằng chứng ({incidents.length} vi phạm)
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        onClick={() => setShowFilters(!showFilters)}
                        variant="outline"
                        className="flex items-center gap-2"
                    >
                        <Filter className="w-4 h-4" />
                        Bộ lọc
                        {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>
                    <Button onClick={loadIncidents} variant="outline" className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Làm mới
                    </Button>
                </div>
            </div>

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

            {/* Incidents Grid */}
            {incidents.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center text-gray-500">
                        <Video className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p className="text-lg">Không có vi phạm nào có video bằng chứng</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {incidents.map((incident) => (
                        <div
                            key={incident.id}
                            className="cursor-pointer"
                            onClick={() => navigate(`/proctor/video-analysis/${incident.id}`)}
                        >
                            <Card className="hover:shadow-lg transition-shadow h-full">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <Badge className={getSeverityColor(incident.severity)}>
                                            {incident.severity}
                                        </Badge>
                                        <Badge className={getStatusColor(incident.status)}>
                                            {incident.status}
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-base">
                                        {getViolationLabel(incident.type)}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <Calendar className="w-4 h-4" />
                                            {formatDateTime(incident.detectedAt)}
                                        </div>
                                        <div className="pt-2 border-t">
                                            <Button className="w-full" size="sm">
                                                <Eye className="w-4 h-4 mr-2" />
                                                Xem chi tiết
                                            </Button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProctorVideoAnalysisListPage;
