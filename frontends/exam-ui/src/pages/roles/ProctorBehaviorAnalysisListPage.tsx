import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionsApi, type Session } from '@/api/sessions';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Button } from '@/ui/button';
import { Alert, AlertDescription } from '@/ui/alert';
import { Badge } from '@/ui/badge';
import {
    BarChart3,
    RefreshCw,
    Filter,
    ChevronDown,
    ChevronUp,
    Calendar,
    User,
    Clock,
    Eye
} from 'lucide-react';

/**
 * Proctor Behavior Analysis List Page
 * 
 * Displays a list of exam sessions with behavior analysis data.
 * Clicking on a session navigates to the detailed behavior analysis page.
 */
const ProctorBehaviorAnalysisListPage: React.FC = () => {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    // Filters
    const [statusFilter, setStatusFilter] = useState<string>('');

    const loadSessions = async () => {
        setLoading(true);
        setError(null);
        try {
            const allSessions = await sessionsApi.getAll();

            // Filter by status if provided
            const filtered = statusFilter
                ? allSessions.filter(s => s.status === statusFilter)
                : allSessions;

            setSessions(filtered);
        } catch (err) {
            console.error('Failed to load sessions:', err);
            setError('Không thể tải danh sách phiên thi');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSessions();
    }, [statusFilter]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'bg-green-100 text-green-700';
            case 'COMPLETED': return 'bg-blue-100 text-blue-700';
            case 'TERMINATED': return 'bg-red-100 text-red-700';
            case 'PAUSED': return 'bg-yellow-100 text-yellow-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'Đang thi';
            case 'COMPLETED': return 'Hoàn thành';
            case 'TERMINATED': return 'Đã kết thúc';
            case 'PAUSED': return 'Tạm dừng';
            default: return status;
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

    const getSessionDuration = (startedAt: string, endedAt: string | null) => {
        const start = new Date(startedAt).getTime();
        const end = endedAt ? new Date(endedAt).getTime() : Date.now();
        const duration = Math.floor((end - start) / 1000 / 60); // minutes

        if (duration < 60) {
            return `${duration} phút`;
        }
        const hours = Math.floor(duration / 60);
        const mins = duration % 60;
        return `${hours}h ${mins}m`;
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
                        <BarChart3 className="w-7 h-7" />
                        Phân Tích Hành Vi
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Danh sách phiên thi có dữ liệu phân tích hành vi ({sessions.length} phiên)
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
                    <Button onClick={loadSessions} variant="outline" className="flex items-center gap-2">
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
                                    <option value="ACTIVE">Đang thi</option>
                                    <option value="COMPLETED">Hoàn thành</option>
                                    <option value="TERMINATED">Đã kết thúc</option>
                                    <option value="PAUSED">Tạm dừng</option>
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

            {/* Sessions Grid */}
            {sessions.length === 0 ? (
                <Card>
                    <CardContent className="p-12 text-center text-gray-500">
                        <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                        <p className="text-lg">Không có phiên thi nào</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sessions.map((session) => (
                        <div
                            key={session.id}
                            className="cursor-pointer"
                            onClick={() => navigate(`/proctor/behavior-analysis/${session.id}`)}
                        >
                            <Card className="hover:shadow-lg transition-shadow h-full">
                                <CardHeader className="pb-3">
                                    <div className="flex items-center justify-between mb-2">
                                        <Badge className={getStatusColor(session.status)}>
                                            {getStatusLabel(session.status)}
                                        </Badge>
                                    </div>
                                    <CardTitle className="text-base font-mono text-sm">
                                        Session: {session.id.substring(0, 12)}...
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2 text-sm">
                                        {session.userId && (
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <User className="w-4 h-4" />
                                                <span className="font-mono text-xs">
                                                    {session.userId.substring(0, 8)}...
                                                </span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <Calendar className="w-4 h-4" />
                                            {formatDateTime(session.startedAt)}
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <Clock className="w-4 h-4" />
                                            {getSessionDuration(session.startedAt, session.endedAt)}
                                        </div>
                                        <div className="pt-2 border-t">
                                            <Button className="w-full" size="sm">
                                                <Eye className="w-4 h-4 mr-2" />
                                                Xem phân tích
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

export default ProctorBehaviorAnalysisListPage;
