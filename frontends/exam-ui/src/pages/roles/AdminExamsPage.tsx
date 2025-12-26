/**
 * AdminExamsPage
 * 
 * Admin page for managing exams - list view with actions:
 * - View all exams in a table
 * - Create new exam
 * - Edit existing exam
 * - Delete exam
 * - Download SEB config
 * - View exam statistics
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { examsApi, type Exam } from '@/api/exams';
import { axiosInstance } from '@/api/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui/card';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Alert, AlertDescription } from '@/ui/alert';
import {
    Plus,
    Pencil,
    Trash2,
    Download,
    Calendar,
    Clock,
    Users,
    Shield,
    AlertCircle,
    Loader2,
    Search,
    Filter,
    MoreHorizontal,
    Eye,
    Play,
    Copy,
    RefreshCw
} from 'lucide-react';

type ExamStatusFilter = 'ALL' | 'ACTIVE' | 'SCHEDULED' | 'ENDED';

const STATUS_TABS: { key: ExamStatusFilter; label: string; color: string }[] = [
    { key: 'ALL', label: 'Tất cả', color: 'bg-gray-100 text-gray-700' },
    { key: 'ACTIVE', label: 'Đang mở', color: 'bg-green-100 text-green-700' },
    { key: 'SCHEDULED', label: 'Sắp diễn ra', color: 'bg-blue-100 text-blue-700' },
    { key: 'ENDED', label: 'Đã kết thúc', color: 'bg-gray-100 text-gray-500' },
];

export function AdminExamsPage() {
    const navigate = useNavigate();
    const [exams, setExams] = useState<Exam[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<ExamStatusFilter>('ALL');
    const [searchQuery, setSearchQuery] = useState('');
    const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    useEffect(() => {
        loadExams();
    }, [statusFilter]);

    const loadExams = async () => {
        try {
            setLoading(true);
            setError(null);
            const status = statusFilter === 'ALL' ? undefined : statusFilter;
            const data = await examsApi.getAll(status);
            setExams(data);
        } catch (err) {
            console.error('Error loading exams:', err);
            setError('Không thể tải danh sách kỳ thi. Vui lòng thử lại sau.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (examId: string) => {
        try {
            setDeleting(true);
            await examsApi.delete(examId);
            setExams(prev => prev.filter(e => e.id !== examId));
            setDeleteConfirmId(null);
        } catch (err) {
            console.error('Error deleting exam:', err);
            setError('Không thể xóa kỳ thi. Vui lòng thử lại.');
        } finally {
            setDeleting(false);
        }
    };

    const handleDownloadSebConfig = async (examId: string, examName: string) => {
        try {
            const response = await axiosInstance.get(`/api/exams/${examId}/seb-config`, {
                responseType: 'blob'
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `${examName.replace(/\s+/g, '_')}.seb`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            console.error('Failed to download SEB config:', err);
            setError('Không thể tải file cấu hình SEB');
        }
    };

    const copyExamLink = (examId: string) => {
        const link = `${window.location.origin}/exams/${examId}/start`;
        navigator.clipboard.writeText(link);
        // Could add a toast notification here
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('vi-VN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (exam: Exam) => {
        const now = new Date();
        const startTime = new Date(exam.startTime);
        const endTime = new Date(exam.endTime);

        if (exam.status === 'ENDED' || now > endTime) {
            return <Badge variant="secondary">Đã kết thúc</Badge>;
        }
        if (now < startTime) {
            return <Badge variant="outline" className="border-blue-300 text-blue-700">Sắp diễn ra</Badge>;
        }
        if (exam.status === 'ACTIVE') {
            return <Badge className="bg-green-500 text-white">Đang mở</Badge>;
        }
        return <Badge variant="secondary">Không xác định</Badge>;
    };

    const getBrowserModeBadge = (exam: Exam) => {
        if (exam.browserMode === 'SEB_REQUIRED') {
            return <Badge variant="destructive" className="text-xs"><Shield className="w-3 h-3 mr-1" />SEB Bắt buộc</Badge>;
        }
        if (exam.browserMode === 'SEB_OPTIONAL') {
            return <Badge variant="secondary" className="text-xs"><Shield className="w-3 h-3 mr-1" />SEB Khuyến khích</Badge>;
        }
        return null;
    };

    // Filter exams by search query
    const filteredExams = exams.filter(exam =>
        exam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (exam.description && exam.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
            <div className="container mx-auto p-6">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Quản Lý Kỳ Thi</h1>
                        <p className="text-gray-500 mt-1">Tạo, chỉnh sửa và quản lý các kỳ thi</p>
                    </div>
                    <div className="mt-4 md:mt-0 flex gap-3">
                        <Button variant="outline" onClick={loadExams} disabled={loading}>
                            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                            Làm mới
                        </Button>
                        <Button onClick={() => navigate('/admin/exams/create')} className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                            <Plus className="w-4 h-4 mr-2" />
                            Tạo Kỳ Thi Mới
                        </Button>
                    </div>
                </div>

                {/* Error Alert */}
                {error && (
                    <Alert variant="destructive" className="mb-6">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Filters */}
                <Card className="mb-6 border-0 shadow-sm">
                    <CardContent className="py-4">
                        <div className="flex flex-col md:flex-row gap-4 items-center">
                            {/* Search */}
                            <div className="relative flex-1 w-full">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                                <input
                                    type="text"
                                    placeholder="Tìm kiếm kỳ thi..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            {/* Status Filter */}
                            <div className="flex gap-2">
                                {STATUS_TABS.map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setStatusFilter(tab.key)}
                                        className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${statusFilter === tab.key
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Stats Summary */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <Card className="border-0 shadow-sm">
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-blue-100 rounded-lg">
                                    <Calendar className="w-5 h-5 text-blue-600" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">{exams.length}</div>
                                    <div className="text-sm text-gray-500">Tổng kỳ thi</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-green-100 rounded-lg">
                                    <Play className="w-5 h-5 text-green-600" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">
                                        {exams.filter(e => e.status === 'ACTIVE').length}
                                    </div>
                                    <div className="text-sm text-gray-500">Đang mở</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-100 rounded-lg">
                                    <Clock className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">
                                        {exams.filter(e => new Date(e.startTime) > new Date()).length}
                                    </div>
                                    <div className="text-sm text-gray-500">Sắp diễn ra</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="border-0 shadow-sm">
                        <CardContent className="pt-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-100 rounded-lg">
                                    <Shield className="w-5 h-5 text-red-600" />
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">
                                        {exams.filter(e => e.browserMode === 'SEB_REQUIRED').length}
                                    </div>
                                    <div className="text-sm text-gray-500">Yêu cầu SEB</div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Exams Table */}
                <Card className="border-0 shadow-sm">
                    <CardHeader>
                        <CardTitle>Danh sách kỳ thi</CardTitle>
                        <CardDescription>
                            {filteredExams.length} kỳ thi {statusFilter !== 'ALL' && `(${STATUS_TABS.find(t => t.key === statusFilter)?.label})`}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            </div>
                        ) : filteredExams.length === 0 ? (
                            <div className="text-center py-12">
                                <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                                <p className="text-gray-500">Không có kỳ thi nào</p>
                                <Button
                                    variant="outline"
                                    onClick={() => navigate('/admin/exams/create')}
                                    className="mt-4"
                                >
                                    <Plus className="w-4 h-4 mr-2" />
                                    Tạo kỳ thi đầu tiên
                                </Button>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b bg-gray-50">
                                            <th className="text-left py-3 px-4 font-medium text-gray-700">Tên kỳ thi</th>
                                            <th className="text-left py-3 px-4 font-medium text-gray-700">Thời gian</th>
                                            <th className="text-left py-3 px-4 font-medium text-gray-700">Thời lượng</th>
                                            <th className="text-left py-3 px-4 font-medium text-gray-700">Trạng thái</th>
                                            <th className="text-left py-3 px-4 font-medium text-gray-700">Bảo mật</th>
                                            <th className="text-right py-3 px-4 font-medium text-gray-700">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredExams.map((exam) => (
                                            <tr key={exam.id} className="border-b hover:bg-gray-50 transition-colors">
                                                <td className="py-4 px-4">
                                                    <div className="font-medium text-gray-900">{exam.name}</div>
                                                    <div className="text-sm text-gray-500 truncate max-w-xs">
                                                        {exam.description || 'Không có mô tả'}
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <div className="text-sm">
                                                        <div className="flex items-center gap-1 text-gray-600">
                                                            <Calendar className="w-3 h-3" />
                                                            {formatDate(exam.startTime)}
                                                        </div>
                                                        <div className="text-gray-400 text-xs mt-1">
                                                            đến {formatDate(exam.endTime)}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center gap-1 text-sm text-gray-600">
                                                        <Clock className="w-3 h-3" />
                                                        {exam.durationMinutes} phút
                                                    </div>
                                                </td>
                                                <td className="py-4 px-4">
                                                    {getStatusBadge(exam)}
                                                </td>
                                                <td className="py-4 px-4">
                                                    {getBrowserModeBadge(exam)}
                                                </td>
                                                <td className="py-4 px-4">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {/* Copy Link */}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => copyExamLink(exam.id)}
                                                            title="Copy link đề thi"
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                        </Button>

                                                        {/* Download SEB Config */}
                                                        {exam.browserMode !== 'NORMAL' && (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDownloadSebConfig(exam.id, exam.name)}
                                                                title="Tải cấu hình SEB"
                                                            >
                                                                <Download className="w-4 h-4" />
                                                            </Button>
                                                        )}

                                                        {/* Edit */}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => navigate(`/admin/exams/${exam.id}`)}
                                                            title="Chỉnh sửa"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </Button>

                                                        {/* View in Proctor Dashboard */}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => navigate(`/proctor/dashboard/${exam.id}`)}
                                                            title="Giám sát"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </Button>

                                                        {/* Delete */}
                                                        {deleteConfirmId === exam.id ? (
                                                            <div className="flex items-center gap-1">
                                                                <Button
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    onClick={() => handleDelete(exam.id)}
                                                                    disabled={deleting}
                                                                >
                                                                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Xóa'}
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => setDeleteConfirmId(null)}
                                                                >
                                                                    Hủy
                                                                </Button>
                                                            </div>
                                                        ) : (
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => setDeleteConfirmId(exam.id)}
                                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                title="Xóa"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default AdminExamsPage;
