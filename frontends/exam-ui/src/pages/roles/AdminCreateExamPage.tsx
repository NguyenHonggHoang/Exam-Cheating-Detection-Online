/**
 * AdminCreateExamPage
 * 
 * Admin page for creating and editing exams.
 * Includes SEB (Safe Exam Browser) configuration options.
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { examsApi, type Exam, type BrowserMode, type CreateExamRequest, type SebConfig } from '@/api/exams';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui/card';
import { Button } from '@/ui/button';
import { Alert, AlertDescription } from '@/ui/alert';
import {
    Save,
    ArrowLeft,
    Calendar,
    Clock,
    Shield,
    Monitor,
    Users,
    CheckCircle,
    AlertTriangle,
    Loader2,
    Settings,
    Lock,
    Wifi,
    Keyboard
} from 'lucide-react';

interface FormData {
    name: string;
    description: string;
    startTime: string;
    endTime: string;
    durationMinutes: number;
    retentionDays: number;
    browserMode: BrowserMode;
    requireIdVerification: boolean;
    maxVerificationAttempts: number;
    maxAttempts: number | null;  // null = unlimited
    // SEB Basic Config
    sebQuitPassword?: string;
    sebAdminPassword?: string;
    sebAllowWifi: boolean;
    sebShowTaskBar: boolean;
    sebShowReloadButton: boolean;
    sebShowTime: boolean;
    sebShowInputLanguage: boolean;
    sebAllowQuit: boolean;
    // SEB Security Config
    sebDetectVirtualMachine: boolean;
    sebAllowRemoteDesktop: boolean;
    sebAllowMultipleDisplays: boolean;
    sebAllowDisplayMirroring: boolean;
    sebBlockScreenCapture: boolean;
    sebEnableKioskMode: boolean;
    sebEnablePrivateClipboard: boolean;
    sebProhibitedProcesses: string[];  // Array of process identifiers to block
}

// Predefined list of common apps that can be blocked
const COMMON_PROHIBITED_APPS = [
    { identifier: 'obs64.exe', os: 1, description: 'OBS Studio (64-bit)', category: 'Screen Recording' },
    { identifier: 'obs.exe', os: 1, description: 'OBS Studio (32-bit)', category: 'Screen Recording' },
    { identifier: 'Zoom.exe', os: 1, description: 'Zoom Meeting', category: 'Video Conference' },
    { identifier: 'Teams.exe', os: 1, description: 'Microsoft Teams', category: 'Video Conference' },
    { identifier: 'Discord.exe', os: 1, description: 'Discord', category: 'Communication' },
    { identifier: 'Slack.exe', os: 1, description: 'Slack', category: 'Communication' },
    { identifier: 'AnyDesk.exe', os: 1, description: 'AnyDesk', category: 'Remote Desktop' },
    { identifier: 'TeamViewer.exe', os: 1, description: 'TeamViewer', category: 'Remote Desktop' },
    { identifier: 'ScreenClip.exe', os: 1, description: 'Snipping Tool', category: 'Screenshot' },
    { identifier: 'SnippingTool.exe', os: 1, description: 'Snipping Tool (Legacy)', category: 'Screenshot' },
    { identifier: 'ShareX.exe', os: 1, description: 'ShareX', category: 'Screen Recording' },
    { identifier: 'Skype.exe', os: 1, description: 'Skype', category: 'Video Conference' },
    { identifier: 'chrome.exe', os: 1, description: 'Google Chrome', category: 'Browser' },
    { identifier: 'firefox.exe', os: 1, description: 'Firefox', category: 'Browser' },
    { identifier: 'msedge.exe', os: 1, description: 'Microsoft Edge', category: 'Browser' },
    // macOS apps
    { identifier: 'zoom.us', os: 2, description: 'Zoom (macOS)', category: 'Video Conference' },
    { identifier: 'com.obsproject.obs', os: 2, description: 'OBS (macOS)', category: 'Screen Recording' },
    { identifier: 'com.microsoft.teams', os: 2, description: 'Teams (macOS)', category: 'Video Conference' },
    { identifier: 'com.tinyspeck.slackmacgap', os: 2, description: 'Slack (macOS)', category: 'Communication' },
];

const initialFormData: FormData = {
    name: '',
    description: '',
    startTime: '',
    endTime: '',
    durationMinutes: 60,
    retentionDays: 30,
    browserMode: 'NORMAL',
    requireIdVerification: true,
    maxVerificationAttempts: 5,
    maxAttempts: null,
    // SEB Basic Config Defaults
    sebQuitPassword: '',
    sebAdminPassword: 'password', // Default
    sebAllowWifi: true,
    sebShowTaskBar: true,
    sebShowReloadButton: true,
    sebShowTime: true,
    sebShowInputLanguage: true,
    sebAllowQuit: true,
    // SEB Security Config Defaults (secure by default)
    sebDetectVirtualMachine: true,
    sebAllowRemoteDesktop: false,
    sebAllowMultipleDisplays: false,
    sebAllowDisplayMirroring: false,
    sebBlockScreenCapture: true,
    sebEnableKioskMode: true,
    sebEnablePrivateClipboard: true,
    sebProhibitedProcesses: ['obs64.exe', 'obs.exe', 'Zoom.exe', 'Teams.exe', 'Discord.exe', 'AnyDesk.exe', 'TeamViewer.exe'],
};

export function AdminCreateExamPage() {
    const navigate = useNavigate();
    const { examId } = useParams<{ examId?: string }>();
    const isEditing = !!examId;

    const [formData, setFormData] = useState<FormData>(initialFormData);
    const [loading, setLoading] = useState(false);
    const [loadingExam, setLoadingExam] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Load exam for editing
    useEffect(() => {
        if (examId) {
            setLoadingExam(true);
            examsApi.getById(examId)
                .then((exam: Exam) => {
                    setFormData({
                        name: exam.name,
                        description: exam.description || '',
                        startTime: exam.startTime ? new Date(exam.startTime).toISOString().slice(0, 16) : '',
                        endTime: exam.endTime ? new Date(exam.endTime).toISOString().slice(0, 16) : '',
                        durationMinutes: exam.durationMinutes || 60,
                        retentionDays: exam.retentionDays || 30,
                        browserMode: exam.browserMode || 'NORMAL',
                        requireIdVerification: exam.requireIdVerification ?? true,
                        maxVerificationAttempts: exam.maxVerificationAttempts || 5,
                        maxAttempts: exam.maxAttempts ?? null,
                        // SEB Basic Config Mapping
                        sebQuitPassword: exam.sebConfig?.quitPassword || '',
                        sebAdminPassword: exam.sebConfig?.adminPassword || '',
                        sebAllowWifi: exam.sebConfig?.allowWifi ?? true,
                        sebShowTaskBar: exam.sebConfig?.showTaskBar ?? true,
                        sebShowReloadButton: exam.sebConfig?.showReloadButton ?? true,
                        sebShowTime: exam.sebConfig?.showTime ?? true,
                        sebShowInputLanguage: exam.sebConfig?.showInputLanguage ?? true,
                        sebAllowQuit: exam.sebConfig?.allowQuit ?? true,
                        // SEB Security Config Mapping
                        sebDetectVirtualMachine: exam.sebConfig?.detectVirtualMachine ?? true,
                        sebAllowRemoteDesktop: exam.sebConfig?.allowRemoteDesktop ?? false,
                        sebAllowMultipleDisplays: exam.sebConfig?.allowMultipleDisplays ?? false,
                        sebAllowDisplayMirroring: exam.sebConfig?.allowDisplayMirroring ?? false,
                        sebBlockScreenCapture: exam.sebConfig?.blockScreenCapture ?? true,
                        sebEnableKioskMode: exam.sebConfig?.enableKioskMode ?? true,
                        sebEnablePrivateClipboard: exam.sebConfig?.enablePrivateClipboard ?? true,
                        sebProhibitedProcesses: (() => {
                            try {
                                if (exam.sebConfig?.prohibitedProcesses) {
                                    const parsed = JSON.parse(exam.sebConfig.prohibitedProcesses);
                                    if (Array.isArray(parsed)) {
                                        return parsed.map((p: { identifier?: string } | string) =>
                                            typeof p === 'string' ? p : (p.identifier || '')
                                        ).filter((id): id is string => Boolean(id));
                                    }
                                }
                            } catch (e) {
                                console.warn('Failed to parse prohibited processes:', e);
                            }
                            return initialFormData.sebProhibitedProcesses;
                        })(),
                    });
                })
                .catch((err: Error) => {
                    console.error('Failed to load exam:', err);
                    setError('Không thể tải thông tin kỳ thi');
                })
                .finally(() => setLoadingExam(false));
        }
    }, [examId]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        if (type === 'checkbox') {
            const checked = (e.target as HTMLInputElement).checked;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else if (type === 'number') {
            setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const examData: CreateExamRequest = {
                name: formData.name,
                description: formData.description,
                startTime: new Date(formData.startTime).toISOString(),
                endTime: formData.endTime ? new Date(formData.endTime).toISOString() : undefined,
                durationMinutes: formData.durationMinutes,
                retentionDays: formData.retentionDays,
                browserMode: formData.browserMode,
                requireIdVerification: formData.requireIdVerification,
                maxVerificationAttempts: formData.maxVerificationAttempts,
                maxAttempts: formData.maxAttempts,  // null = unlimited
                sebConfig: formData.browserMode !== 'NORMAL' ? {
                    // Basic settings
                    quitPassword: formData.sebQuitPassword,
                    adminPassword: formData.sebAdminPassword,
                    allowWifi: formData.sebAllowWifi,
                    showTaskBar: formData.sebShowTaskBar,
                    showReloadButton: formData.sebShowReloadButton,
                    showTime: formData.sebShowTime,
                    showInputLanguage: formData.sebShowInputLanguage,
                    allowQuit: formData.sebAllowQuit,
                    // Security settings
                    detectVirtualMachine: formData.sebDetectVirtualMachine,
                    allowRemoteDesktop: formData.sebAllowRemoteDesktop,
                    allowMultipleDisplays: formData.sebAllowMultipleDisplays,
                    allowDisplayMirroring: formData.sebAllowDisplayMirroring,
                    blockScreenCapture: formData.sebBlockScreenCapture,
                    enableKioskMode: formData.sebEnableKioskMode,
                    enablePrivateClipboard: formData.sebEnablePrivateClipboard,
                    // Convert prohibited processes to JSON
                    prohibitedProcesses: JSON.stringify(
                        formData.sebProhibitedProcesses.map(id => {
                            const app = COMMON_PROHIBITED_APPS.find(a => a.identifier === id);
                            return { identifier: id, os: app?.os || 1, description: app?.description || id };
                        })
                    ),
                } : undefined
            };

            if (isEditing && examId) {
                await examsApi.update(examId, examData);
            } else {
                await examsApi.create(examData);
            }

            setSuccess(true);
            setTimeout(() => navigate('/admin/exams'), 1500);
        } catch (err) {
            console.error('Failed to save exam:', err);
            setError('Không thể lưu kỳ thi. Vui lòng thử lại.');
        } finally {
            setLoading(false);
        }
    };

    if (loadingExam) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
                <Button variant="outline" onClick={() => navigate(-1)}>
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Quay lại
                </Button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        {isEditing ? 'Chỉnh Sửa Kỳ Thi' : 'Tạo Kỳ Thi Mới'}
                    </h1>
                    <p className="text-gray-500 text-sm">
                        {isEditing ? 'Cập nhật thông tin kỳ thi' : 'Điền thông tin để tạo kỳ thi mới'}
                    </p>
                </div>
            </div>

            {/* Alerts */}
            {error && (
                <Alert variant="destructive" className="mb-6">
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>{error}</AlertDescription>
                </Alert>
            )}
            {success && (
                <Alert className="mb-6 bg-green-50 border-green-200 text-green-800">
                    <CheckCircle className="w-4 h-4" />
                    <AlertDescription>
                        {isEditing ? 'Cập nhật kỳ thi thành công!' : 'Tạo kỳ thi thành công!'}
                    </AlertDescription>
                </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            Thông Tin Cơ Bản
                        </CardTitle>
                        <CardDescription>Tên và mô tả kỳ thi</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Tên kỳ thi *
                            </label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="VD: Giữa kỳ Toán cao cấp"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Mô tả
                            </label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                rows={3}
                                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Mô tả chi tiết về kỳ thi..."
                            />
                        </div>
                    </CardContent>
                </Card>

                {/* Time Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="w-5 h-5" />
                            Thời Gian
                        </CardTitle>
                        <CardDescription>Cấu hình thời gian thi</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Thời gian bắt đầu *
                                </label>
                                <input
                                    type="datetime-local"
                                    name="startTime"
                                    value={formData.startTime}
                                    onChange={handleChange}
                                    required
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Thời gian kết thúc
                                </label>
                                <input
                                    type="datetime-local"
                                    name="endTime"
                                    value={formData.endTime}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Thời lượng (phút)
                                </label>
                                <input
                                    type="number"
                                    name="durationMinutes"
                                    value={formData.durationMinutes}
                                    onChange={handleChange}
                                    min="10"
                                    max="480"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Lưu trữ dữ liệu (ngày)
                                </label>
                                <input
                                    type="number"
                                    name="retentionDays"
                                    value={formData.retentionDays}
                                    onChange={handleChange}
                                    min="7"
                                    max="365"
                                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Số lần thi tối đa
                            </label>
                            <div className="flex items-center gap-4">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="unlimitedAttempts"
                                        checked={formData.maxAttempts === null}
                                        onChange={(e) => {
                                            setFormData(prev => ({
                                                ...prev,
                                                maxAttempts: e.target.checked ? null : 1
                                            }));
                                        }}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                    <label htmlFor="unlimitedAttempts" className="text-sm text-gray-700">
                                        Không giới hạn
                                    </label>
                                </div>

                                <div className="flex-1">
                                    <input
                                        type="number"
                                        name="maxAttempts"
                                        value={formData.maxAttempts ?? ''}
                                        onChange={handleChange}
                                        disabled={formData.maxAttempts === null}
                                        min="1"
                                        max="100"
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                                        placeholder={formData.maxAttempts === null ? "Không giới hạn" : "Nhập số lần thi"}
                                    />
                                </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Số lần sinh viên được phép tham gia thi. Mặc định là không giới hạn.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Browser Mode */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Monitor className="w-5 h-5" />
                            Chế Độ Trình Duyệt
                        </CardTitle>
                        <CardDescription>
                            Cấu hình Safe Exam Browser (SEB) cho bảo mật
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <label className={`cursor-pointer p-4 border-2 rounded-lg transition-all ${formData.browserMode === 'NORMAL' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                <input
                                    type="radio"
                                    name="browserMode"
                                    value="NORMAL"
                                    checked={formData.browserMode === 'NORMAL'}
                                    onChange={handleChange}
                                    className="sr-only"
                                />
                                <div className="text-center">
                                    <Monitor className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                                    <div className="font-medium">Bình thường</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        Cho phép mọi trình duyệt
                                    </div>
                                </div>
                            </label>

                            <label className={`cursor-pointer p-4 border-2 rounded-lg transition-all ${formData.browserMode === 'SEB_OPTIONAL' ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                <input
                                    type="radio"
                                    name="browserMode"
                                    value="SEB_OPTIONAL"
                                    checked={formData.browserMode === 'SEB_OPTIONAL'}
                                    onChange={handleChange}
                                    className="sr-only"
                                />
                                <div className="text-center">
                                    <Shield className="w-8 h-8 mx-auto mb-2 text-orange-600" />
                                    <div className="font-medium">SEB Khuyến Khích</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        Khuyến khích dùng SEB
                                    </div>
                                </div>
                            </label>

                            <label className={`cursor-pointer p-4 border-2 rounded-lg transition-all ${formData.browserMode === 'SEB_REQUIRED' ? 'border-red-500 bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                                <input
                                    type="radio"
                                    name="browserMode"
                                    value="SEB_REQUIRED"
                                    checked={formData.browserMode === 'SEB_REQUIRED'}
                                    onChange={handleChange}
                                    className="sr-only"
                                />
                                <div className="text-center">
                                    <Shield className="w-8 h-8 mx-auto mb-2 text-red-600" />
                                    <div className="font-medium">SEB Bắt Buộc</div>
                                    <div className="text-xs text-gray-500 mt-1">
                                        Phải dùng Safe Exam Browser
                                    </div>
                                </div>
                            </label>
                        </div>

                        {formData.browserMode !== 'NORMAL' && (
                            <Alert className="bg-blue-50 border-blue-200">
                                <Shield className="w-4 h-4 text-blue-600" />
                                <AlertDescription className="text-blue-800">
                                    SEB Config Key sẽ được tự động tạo khi lưu kỳ thi.
                                    Sinh viên cần nhập key này vào SEB để truy cập thi.
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                {/* SEB Detailed Configuration (Only if SEB is enabled) */}
                {formData.browserMode !== 'NORMAL' && (
                    <Card className="border-blue-200 bg-blue-50/30">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-blue-800">
                                <Settings className="w-5 h-5" />
                                Chi Tiết Cấu Hình SEB
                            </CardTitle>
                            <CardDescription>
                                Điều chỉnh các thông số bảo mật cho Safe Exam Browser
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Passwords */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                        <Lock className="w-3 h-3" /> Mật khẩu thoát (Quit Password)
                                    </label>
                                    <input
                                        type="text"
                                        name="sebQuitPassword"
                                        value={formData.sebQuitPassword}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="Để trống để không dùng mật khẩu"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Dùng để thoát SEB khi chưa nộp bài</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                        <Lock className="w-3 h-3" /> Mật khẩu Admin
                                    </label>
                                    <input
                                        type="text"
                                        name="sebAdminPassword"
                                        value={formData.sebAdminPassword}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                        placeholder="Mật khẩu cài đặt (mặc định: password)"
                                    />
                                </div>
                            </div>

                            {/* Toggles */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8">
                                <label className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm cursor-pointer hover:bg-gray-50">
                                    <span className="flex items-center gap-2 text-sm font-medium">
                                        <Wifi className="w-4 h-4 text-gray-500" />
                                        Cho phép Wifi
                                    </span>
                                    <input
                                        type="checkbox"
                                        name="sebAllowWifi"
                                        checked={formData.sebAllowWifi}
                                        onChange={handleChange}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                </label>

                                <label className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm cursor-pointer hover:bg-gray-50">
                                    <span className="flex items-center gap-2 text-sm font-medium">
                                        <Monitor className="w-4 h-4 text-gray-500" />
                                        Hiển thị Taskbar
                                    </span>
                                    <input
                                        type="checkbox"
                                        name="sebShowTaskBar"
                                        checked={formData.sebShowTaskBar}
                                        onChange={handleChange}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                </label>

                                <label className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm cursor-pointer hover:bg-gray-50">
                                    <span className="flex items-center gap-2 text-sm font-medium">
                                        <Keyboard className="w-4 h-4 text-gray-500" />
                                        Hiện ngôn ngữ bàn phím
                                    </span>
                                    <input
                                        type="checkbox"
                                        name="sebShowInputLanguage"
                                        checked={formData.sebShowInputLanguage}
                                        onChange={handleChange}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                </label>

                                <label className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm cursor-pointer hover:bg-gray-50">
                                    <span className="flex items-center gap-2 text-sm font-medium">
                                        <Clock className="w-4 h-4 text-gray-500" />
                                        Hiện đồng hồ
                                    </span>
                                    <input
                                        type="checkbox"
                                        name="sebShowTime"
                                        checked={formData.sebShowTime}
                                        onChange={handleChange}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                </label>

                                <label className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm cursor-pointer hover:bg-gray-50">
                                    <span className="flex items-center gap-2 text-sm font-medium">
                                        <Settings className="w-4 h-4 text-gray-500" />
                                        Nút tải lại trang
                                    </span>
                                    <input
                                        type="checkbox"
                                        name="sebShowReloadButton"
                                        checked={formData.sebShowReloadButton}
                                        onChange={handleChange}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                </label>

                                <label className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm cursor-pointer hover:bg-gray-50">
                                    <span className="flex items-center gap-2 text-sm font-medium">
                                        <Settings className="w-4 h-4 text-gray-500" />
                                        Cho phép thoát (Allow Quit)
                                    </span>
                                    <input
                                        type="checkbox"
                                        name="sebAllowQuit"
                                        checked={formData.sebAllowQuit}
                                        onChange={handleChange}
                                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                    />
                                </label>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Advanced Security Settings (Only if SEB is enabled) */}
                {formData.browserMode !== 'NORMAL' && (
                    <Card className="border-red-200 bg-red-50/30">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-red-800">
                                <Shield className="w-5 h-5" />
                                Bảo Mật Nâng Cao
                            </CardTitle>
                            <CardDescription>
                                Cấu hình chống gian lận và khóa hệ thống
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Security Toggles */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-3">Bảo mật hệ thống</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-3 gap-x-8">
                                    <label className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm cursor-pointer hover:bg-gray-50">
                                        <span className="flex items-center gap-2 text-sm font-medium">
                                            <Monitor className="w-4 h-4 text-red-500" />
                                            Phát hiện máy ảo (VM)
                                        </span>
                                        <input
                                            type="checkbox"
                                            name="sebDetectVirtualMachine"
                                            checked={formData.sebDetectVirtualMachine}
                                            onChange={handleChange}
                                            className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                        />
                                    </label>

                                    <label className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm cursor-pointer hover:bg-gray-50">
                                        <span className="flex items-center gap-2 text-sm font-medium">
                                            <Monitor className="w-4 h-4 text-red-500" />
                                            Chặn Remote Desktop
                                        </span>
                                        <input
                                            type="checkbox"
                                            name="sebAllowRemoteDesktop"
                                            checked={!formData.sebAllowRemoteDesktop}
                                            onChange={(e) => setFormData(prev => ({ ...prev, sebAllowRemoteDesktop: !e.target.checked }))}
                                            className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                        />
                                    </label>

                                    <label className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm cursor-pointer hover:bg-gray-50">
                                        <span className="flex items-center gap-2 text-sm font-medium">
                                            <Monitor className="w-4 h-4 text-red-500" />
                                            Chặn đa màn hình
                                        </span>
                                        <input
                                            type="checkbox"
                                            name="sebAllowMultipleDisplays"
                                            checked={!formData.sebAllowMultipleDisplays}
                                            onChange={(e) => setFormData(prev => ({ ...prev, sebAllowMultipleDisplays: !e.target.checked }))}
                                            className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                        />
                                    </label>

                                    <label className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm cursor-pointer hover:bg-gray-50">
                                        <span className="flex items-center gap-2 text-sm font-medium">
                                            <Monitor className="w-4 h-4 text-red-500" />
                                            Chặn Mirror Display
                                        </span>
                                        <input
                                            type="checkbox"
                                            name="sebAllowDisplayMirroring"
                                            checked={!formData.sebAllowDisplayMirroring}
                                            onChange={(e) => setFormData(prev => ({ ...prev, sebAllowDisplayMirroring: !e.target.checked }))}
                                            className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                        />
                                    </label>

                                    <label className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm cursor-pointer hover:bg-gray-50">
                                        <span className="flex items-center gap-2 text-sm font-medium">
                                            <Monitor className="w-4 h-4 text-red-500" />
                                            Chặn Screen Capture
                                        </span>
                                        <input
                                            type="checkbox"
                                            name="sebBlockScreenCapture"
                                            checked={formData.sebBlockScreenCapture}
                                            onChange={handleChange}
                                            className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                        />
                                    </label>

                                    <label className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm cursor-pointer hover:bg-gray-50">
                                        <span className="flex items-center gap-2 text-sm font-medium">
                                            <Lock className="w-4 h-4 text-red-500" />
                                            Chế độ Kiosk
                                        </span>
                                        <input
                                            type="checkbox"
                                            name="sebEnableKioskMode"
                                            checked={formData.sebEnableKioskMode}
                                            onChange={handleChange}
                                            className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                        />
                                    </label>

                                    <label className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm cursor-pointer hover:bg-gray-50">
                                        <span className="flex items-center gap-2 text-sm font-medium">
                                            <Lock className="w-4 h-4 text-red-500" />
                                            Clipboard riêng biệt
                                        </span>
                                        <input
                                            type="checkbox"
                                            name="sebEnablePrivateClipboard"
                                            checked={formData.sebEnablePrivateClipboard}
                                            onChange={handleChange}
                                            className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                        />
                                    </label>
                                </div>
                            </div>

                            {/* Prohibited Applications */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Ứng dụng bị chặn</h4>
                                <p className="text-xs text-gray-500 mb-3">Chọn các ứng dụng sẽ bị SEB chặn khi sinh viên thi</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto p-2 bg-white rounded-lg border">
                                    {COMMON_PROHIBITED_APPS.map((app) => (
                                        <label
                                            key={app.identifier}
                                            className={`flex items-center gap-2 p-2 rounded cursor-pointer transition-colors ${formData.sebProhibitedProcesses.includes(app.identifier)
                                                ? 'bg-red-100 border-red-300 border'
                                                : 'hover:bg-gray-50'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={formData.sebProhibitedProcesses.includes(app.identifier)}
                                                onChange={(e) => {
                                                    if (e.target.checked) {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            sebProhibitedProcesses: [...prev.sebProhibitedProcesses, app.identifier]
                                                        }));
                                                    } else {
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            sebProhibitedProcesses: prev.sebProhibitedProcesses.filter(id => id !== app.identifier)
                                                        }));
                                                    }
                                                }}
                                                className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="text-sm font-medium truncate">{app.description}</div>
                                                <div className="text-xs text-gray-400">{app.os === 1 ? 'Windows' : 'macOS'}</div>
                                            </div>
                                        </label>
                                    ))}
                                </div>

                                <div className="flex gap-2 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({
                                            ...prev,
                                            sebProhibitedProcesses: COMMON_PROHIBITED_APPS.map(a => a.identifier)
                                        }))}
                                        className="text-xs px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
                                    >
                                        Chọn tất cả
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setFormData(prev => ({ ...prev, sebProhibitedProcesses: [] }))}
                                        className="text-xs px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                                    >
                                        Bỏ chọn tất cả
                                    </button>
                                </div>
                            </div>

                            <Alert className="bg-yellow-50 border-yellow-200">
                                <AlertTriangle className="w-4 h-4 text-yellow-600" />
                                <AlertDescription className="text-yellow-800 text-sm">
                                    <strong>Lưu ý:</strong> Một số tính năng như <code>blockScreenCapture</code> chỉ hoạt động trên macOS.
                                    Chế độ Kiosk sẽ khóa hoàn toàn Windows desktop.
                                </AlertDescription>
                            </Alert>
                        </CardContent>
                    </Card>
                )}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Xác Thực Danh Tính
                        </CardTitle>
                        <CardDescription>Cấu hình xác thực sinh viên</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                id="requireIdVerification"
                                name="requireIdVerification"
                                checked={formData.requireIdVerification}
                                onChange={handleChange}
                                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="requireIdVerification" className="text-sm font-medium text-gray-700">
                                Yêu cầu xác thực khuôn mặt trước khi thi
                            </label>
                        </div>

                        {formData.requireIdVerification && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Số lần thử xác thực tối đa
                                </label>
                                <input
                                    type="number"
                                    name="maxVerificationAttempts"
                                    value={formData.maxVerificationAttempts}
                                    onChange={handleChange}
                                    min="1"
                                    max="10"
                                    className="w-32 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Sau số lần này, yêu cầu sẽ được chuyển đến giám thị
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Submit Button */}
                <div className="flex justify-end gap-4">
                    <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                        Hủy
                    </Button>
                    <Button type="submit" disabled={loading}>
                        {loading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4 mr-2" />
                        )}
                        {isEditing ? 'Cập Nhật' : 'Tạo Kỳ Thi'}
                    </Button>
                </div>
            </form>
        </div>
    );
}

export default AdminCreateExamPage;
