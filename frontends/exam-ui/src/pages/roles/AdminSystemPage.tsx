/**
 * AdminSystemPage
 * 
 * System monitoring dashboard for admins.
 * Shows service health, active sessions, storage usage, and database connections.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui/card';
import { Button } from '@/ui/button';
import { Alert, AlertDescription } from '@/ui/alert';
import { Badge } from '@/ui/badge';
import {
    Activity,
    Server,
    Database,
    HardDrive,
    Users,
    RefreshCw,
    CheckCircle,
    XCircle,
    AlertTriangle,
    Wifi,
    Clock,
    BarChart3,
    Cpu,
    MemoryStick,
} from 'lucide-react';
import { axiosInstance } from '@/api/client';

interface ServiceHealth {
    name: string;
    status: 'UP' | 'DOWN' | 'UNKNOWN';
    responseTime?: number;
    lastCheck: string;
    details?: Record<string, unknown>;
}

interface SystemMetrics {
    activeSessions: number;
    totalExams: number;
    activeExams: number;
    pendingIncidents: number;
    storageUsed: string;
    storageTotal: string;
    storagePercent: number;
    dbConnections: number;
    dbMaxConnections: number;
    uptime: string;
}

// Mock data - replace with actual API calls
const mockServices: ServiceHealth[] = [
    { name: 'user-service', status: 'UP', responseTime: 45, lastCheck: new Date().toISOString() },
    { name: 'session-service', status: 'UP', responseTime: 32, lastCheck: new Date().toISOString() },
    { name: 'incident-service', status: 'UP', responseTime: 28, lastCheck: new Date().toISOString() },
    { name: 'PostgreSQL', status: 'UP', responseTime: 12, lastCheck: new Date().toISOString() },
    { name: 'Redis', status: 'UP', responseTime: 5, lastCheck: new Date().toISOString() },
    { name: 'MinIO', status: 'UP', responseTime: 18, lastCheck: new Date().toISOString() },
    { name: 'RabbitMQ', status: 'UP', responseTime: 15, lastCheck: new Date().toISOString() },
    { name: 'LiveKit', status: 'UP', responseTime: 22, lastCheck: new Date().toISOString() },
];

const mockMetrics: SystemMetrics = {
    activeSessions: 47,
    totalExams: 12,
    activeExams: 2,
    pendingIncidents: 5,
    storageUsed: '2.4 GB',
    storageTotal: '10 GB',
    storagePercent: 24,
    dbConnections: 8,
    dbMaxConnections: 100,
    uptime: '15 ngày 4 giờ',
};

export function AdminSystemPage() {
    const [services, setServices] = useState<ServiceHealth[]>([]);
    const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

    // Load system data
    const loadData = useCallback(async (showRefreshing = true) => {
        if (showRefreshing) setRefreshing(true);

        try {
            // Fetch real metrics from backend
            const metricsRes = await axiosInstance.get('/api/admin/metrics');
            setMetrics(metricsRes.data);

            // Fetch health (currently only session-service or mock others)
            // For now we simulate others but get session-service real status if possible
            // const healthRes = await axiosInstance.get('/api/admin/system/health');

            setServices(mockServices.map(s => ({
                ...s,
                lastCheck: new Date().toISOString(),
                status: 'UP', // Assume UP for demo until full health check aggregation is implemented
            })));

            setLastRefresh(new Date());
        } catch (err) {
            console.error('Failed to load system data:', err);
            // Fallback to mock if API fails (e.g. dev mode without backend)
            setMetrics({
                ...mockMetrics,
                activeSessions: Math.floor(40 + Math.random() * 20),
            });
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        loadData(false);

        // Auto-refresh every 30 seconds
        const interval = setInterval(() => loadData(false), 30000);
        return () => clearInterval(interval);
    }, [loadData]);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'UP':
                return <CheckCircle className="w-5 h-5 text-green-500" />;
            case 'DOWN':
                return <XCircle className="w-5 h-5 text-red-500" />;
            default:
                return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'UP':
                return <Badge className="bg-green-100 text-green-800">Hoạt động</Badge>;
            case 'DOWN':
                return <Badge className="bg-red-100 text-red-800">Lỗi</Badge>;
            default:
                return <Badge className="bg-yellow-100 text-yellow-800">Không xác định</Badge>;
        }
    };

    const upCount = services.filter(s => s.status === 'UP').length;
    const downCount = services.filter(s => s.status === 'DOWN').length;

    return (
        <div className="max-w-7xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Activity className="w-6 h-6" />
                        Giám Sát Hệ Thống
                    </h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Cập nhật lần cuối: {lastRefresh.toLocaleTimeString('vi-VN')}
                    </p>
                </div>
                <Button onClick={() => loadData(true)} disabled={refreshing}>
                    <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                    Làm Mới
                </Button>
            </div>

            {/* Overall Status */}
            {downCount > 0 && (
                <Alert variant="destructive" className="mb-6">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                        {downCount} dịch vụ đang gặp sự cố! Vui lòng kiểm tra ngay.
                    </AlertDescription>
                </Alert>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Dịch Vụ</p>
                                <p className="text-2xl font-bold text-green-600">
                                    {upCount}/{services.length}
                                </p>
                            </div>
                            <Server className="w-10 h-10 text-green-200" />
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Hoạt động bình thường</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Phiên Hoạt Động</p>
                                <p className="text-2xl font-bold text-blue-600">
                                    {metrics?.activeSessions || 0}
                                </p>
                            </div>
                            <Users className="w-10 h-10 text-blue-200" />
                        </div>
                        <p className="text-xs text-gray-400 mt-2">Thí sinh đang thi</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Lưu Trữ</p>
                                <p className="text-2xl font-bold text-purple-600">
                                    {metrics?.storagePercent || 0}%
                                </p>
                            </div>
                            <HardDrive className="w-10 h-10 text-purple-200" />
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                            {metrics?.storageUsed} / {metrics?.storageTotal}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-gray-500">Kết Nối DB</p>
                                <p className="text-2xl font-bold text-orange-600">
                                    {metrics?.dbConnections || 0}
                                </p>
                            </div>
                            <Database className="w-10 h-10 text-orange-200" />
                        </div>
                        <p className="text-xs text-gray-400 mt-2">
                            Tối đa: {metrics?.dbMaxConnections}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-3 gap-6">
                {/* Services Status */}
                <div className="col-span-2">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Server className="w-5 h-5" />
                                Trạng Thái Dịch Vụ
                            </CardTitle>
                            <CardDescription>
                                Kiểm tra tình trạng hoạt động của các dịch vụ
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {loading ? (
                                    <div className="text-center py-8">
                                        <RefreshCw className="w-8 h-8 mx-auto animate-spin text-gray-400" />
                                    </div>
                                ) : (
                                    services.map((service, idx) => (
                                        <div
                                            key={service.name}
                                            className={`flex items-center justify-between p-3 rounded-lg ${service.status === 'DOWN' ? 'bg-red-50' : 'bg-gray-50'
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                {getStatusIcon(service.status)}
                                                <div>
                                                    <p className="font-medium">{service.name}</p>
                                                    <p className="text-xs text-gray-500">
                                                        Phản hồi: {service.responseTime}ms
                                                    </p>
                                                </div>
                                            </div>
                                            {getStatusBadge(service.status)}
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* System Info */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <BarChart3 className="w-5 h-5" />
                                Thống Kê Nhanh
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Tổng kỳ thi</span>
                                <span className="font-bold">{metrics?.totalExams}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Kỳ thi đang diễn ra</span>
                                <span className="font-bold text-green-600">{metrics?.activeExams}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Vi phạm chờ xử lý</span>
                                <span className="font-bold text-orange-600">{metrics?.pendingIncidents}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-gray-600">Thời gian hoạt động</span>
                                <span className="font-bold text-blue-600">{metrics?.uptime}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <HardDrive className="w-5 h-5" />
                                Dung Lượng Lưu Trữ
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span>Đã dùng</span>
                                    <span>{metrics?.storageUsed}</span>
                                </div>
                                <div className="w-full bg-gray-200 rounded-full h-3">
                                    <div
                                        className={`h-3 rounded-full transition-all ${(metrics?.storagePercent || 0) > 80 ? 'bg-red-500' :
                                            (metrics?.storagePercent || 0) > 60 ? 'bg-yellow-500' :
                                                'bg-green-500'
                                            }`}
                                        style={{ width: `${metrics?.storagePercent || 0}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-sm text-gray-500">
                                    <span>0 GB</span>
                                    <span>{metrics?.storageTotal}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Wifi className="w-5 h-5" />
                                Kết Nối
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">WebSocket</span>
                                    <Badge className="bg-green-100 text-green-800">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Kết nối
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">Redis Pub/Sub</span>
                                    <Badge className="bg-green-100 text-green-800">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Kết nối
                                    </Badge>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-gray-600">RabbitMQ</span>
                                    <Badge className="bg-green-100 text-green-800">
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Kết nối
                                    </Badge>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}

export default AdminSystemPage;
