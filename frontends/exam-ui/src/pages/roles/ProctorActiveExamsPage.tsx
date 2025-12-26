import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { examsApi, type Exam } from '@/api/exams';
import { sessionsApi } from '@/api/sessions';
import { incidentsApi } from '@/api/incidents';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Button } from '@/ui/button';
import { Alert, AlertDescription } from '@/ui/alert';
import {
    Clock, Users, AlertTriangle, Eye, PlayCircle,
    Calendar, Timer, RefreshCw, Wifi
} from 'lucide-react';
import useIncidentSSE from '@/lib/hooks/useIncidentSSE';

interface ExamWithStats extends Exam {
    activeSessionsCount: number;
    pendingIncidentsCount: number;
}

/**
 * Proctor Active Exams Page
 * 
 * Shows all active exams that proctors can monitor
 */
const ProctorActiveExamsPage: React.FC = () => {
    const navigate = useNavigate();
    const [exams, setExams] = useState<ExamWithStats[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadExams = async () => {
        setLoading(true);
        setError(null);
        try {
            // Get active exams
            const activeExams = await examsApi.getAll('ACTIVE');

            // Enrich with session and incident counts
            const enrichedExams = await Promise.all(
                activeExams.map(async (exam) => {
                    try {
                        const [sessions, summary] = await Promise.all([
                            sessionsApi.getByExam(exam.id, 'ACTIVE').catch(() => []),
                            incidentsApi.getSummary({ examId: exam.id }).catch(() => ({ pendingIncidents: 0 }))
                        ]);
                        return {
                            ...exam,
                            activeSessionsCount: sessions.length,
                            pendingIncidentsCount: summary.pendingIncidents || 0
                        };
                    } catch {
                        return {
                            ...exam,
                            activeSessionsCount: 0,
                            pendingIncidentsCount: 0
                        };
                    }
                })
            );

            setExams(enrichedExams);
        } catch (err) {
            console.error('Failed to load exams:', err);
            setError('Không thể tải danh sách kỳ thi');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadExams();
    }, []);

    // SSE Real-time updates
    const { isConnected } = useIncidentSSE({
        onNewIncident: (incident) => {
            if (incident.examId) {
                setExams(prev => prev.map(exam =>
                    exam.id === incident.examId
                        ? { ...exam, pendingIncidentsCount: exam.pendingIncidentsCount + 1 }
                        : exam
                ));
            }
        }
    });

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            day: '2-digit',
            month: '2-digit'
        });
    };

    const getTimeRemaining = (endTime: string) => {
        const end = new Date(endTime).getTime();
        const now = Date.now();
        const diff = end - now;

        if (diff <= 0) return 'Đã kết thúc';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        if (hours > 0) return `${hours}h ${minutes}p còn lại`;
        return `${minutes} phút còn lại`;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-600">Đang tải danh sách kỳ thi...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">📝 Kỳ Thi Đang Mở</h1>
                    <p className="text-gray-600 mt-1">Chọn kỳ thi để bắt đầu giám sát</p>
                </div>
                <div className="flex gap-2">
                    <div className={`flex items-center gap-1 text-xs px-2 rounded-full border ${isConnected ? 'bg-green-100 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                        <Wifi className="w-3 h-3" />
                        {isConnected ? 'Real-time' : 'Offline'}
                    </div>
                    <Button onClick={loadExams} variant="outline" className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4" />
                        Làm mới
                    </Button>
                </div>
            </div>

            {error && (
                <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}

            {exams.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <div className="text-6xl mb-4">📭</div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Không có kỳ thi đang mở
                        </h3>
                        <p className="text-gray-600">
                            Hiện tại không có kỳ thi nào đang diễn ra cần giám sát
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {exams.map((exam) => (
                        <Card key={exam.id} className="hover:shadow-lg transition-shadow">
                            <CardHeader className="pb-2">
                                <div className="flex items-start justify-between">
                                    <CardTitle className="text-lg line-clamp-2">
                                        {exam.name}
                                    </CardTitle>
                                    <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded">
                                        ĐANG THI
                                    </span>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Time info */}
                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Calendar className="w-4 h-4" />
                                        <span>{formatTime(exam.startTime)} - {formatTime(exam.endTime)}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <Timer className="w-4 h-4" />
                                        <span>{exam.durationMinutes} phút</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-orange-600 font-medium">
                                        <Clock className="w-4 h-4" />
                                        <span>{getTimeRemaining(exam.endTime)}</span>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                                    <div className="text-center p-2 bg-blue-50 rounded">
                                        <div className="flex items-center justify-center gap-1 text-blue-600">
                                            <Users className="w-4 h-4" />
                                            <span className="text-xl font-bold">{exam.activeSessionsCount}</span>
                                        </div>
                                        <div className="text-xs text-gray-600">Thí sinh</div>
                                    </div>
                                    <div className="text-center p-2 bg-red-50 rounded">
                                        <div className="flex items-center justify-center gap-1 text-red-600">
                                            <AlertTriangle className="w-4 h-4" />
                                            <span className="text-xl font-bold">{exam.pendingIncidentsCount}</span>
                                        </div>
                                        <div className="text-xs text-gray-600">Vi phạm chờ</div>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2 pt-2">
                                    <Button
                                        className="flex-1"
                                        onClick={() => navigate(`/proctor/dashboard/${exam.id}`)}
                                    >
                                        <Eye className="w-4 h-4 mr-2" />
                                        Giám sát
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => navigate(`/proctor/violations?examId=${exam.id}`)}
                                    >
                                        <AlertTriangle className="w-4 h-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProctorActiveExamsPage;
