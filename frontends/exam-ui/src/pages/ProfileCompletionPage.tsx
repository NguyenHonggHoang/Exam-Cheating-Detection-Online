/**
 * ProfileCompletionPage
 * 
 * Profile completion form shown after first login.
 * Students must complete this before accessing exams.
 * 
 * Fields:
 * - Faculty (Khoa)
 * - Class (Lớp)
 * - Batch Year (Khóa)
 * - Student ID Card Photo (upload file)
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { uploadIdPhoto, getIdPhotoStatus } from '@/api/identity';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui/card';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import { Label } from '@/ui/label';
import { Alert, AlertDescription } from '@/ui/alert';

import {
    User,
    GraduationCap,
    Building,
    Calendar,
    Check,
    AlertCircle,
    Loader2,
    Upload,
    Image,
    X,
} from 'lucide-react';

// Available faculties
const FACULTIES = [
    'Công nghệ Thông tin',
    'Điện - Điện tử',
    'Kinh tế',
    'Cơ khí',
    'Xây dựng',
    'Hóa học',
    'Sinh học',
    'Ngoại ngữ',
    'Luật',
    'Khoa học Xã hội',
];

interface ProfileFormData {
    fullName: string;
    faculty: string;
    className: string;
    batchYear: string;
}

export function ProfileCompletionPage() {
    const navigate = useNavigate();
    const { user, refreshProfileStatus } = useAuth();

    // Form state
    const [formData, setFormData] = useState<ProfileFormData>({
        fullName: '',
        faculty: '',
        className: '',
        batchYear: new Date().getFullYear().toString(),
    });
    const [formErrors, setFormErrors] = useState<Partial<ProfileFormData>>({});

    // Photo state
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
    const [photoError, setPhotoError] = useState<string | null>(null);

    // Upload state
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [submitSuccess, setSubmitSuccess] = useState(false);

    // Profile info from API
    const [profileInfo, setProfileInfo] = useState<{ userId: string; fullName: string | null } | null>(null);

    // File input ref
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Check existing profile
    useEffect(() => {
        const checkProfile = async () => {
            try {
                // Load photo status
                const status = await getIdPhotoStatus();
                console.log('[ProfileCompletionPage] Photo status:', status);
                if (status.hasPhoto && status.photoUrl) {
                    setExistingPhotoUrl(status.photoUrl);
                }

                // Load existing profile data
                const profileRes = await fetch('/api/proxy/users/profile', {
                    credentials: 'include',
                });
                if (profileRes.ok) {
                    const profileData = await profileRes.json();
                    console.log('[ProfileCompletionPage] Loaded profile data:', profileData);

                    // Store user info for display
                    setProfileInfo({
                        userId: profileData.userId,
                        fullName: profileData.fullName,
                    });

                    if (profileData.profileCompleted) {
                        // Pre-fill form with existing data - fields are at top level
                        setFormData({
                            fullName: profileData.fullName || '',
                            faculty: profileData.faculty || '',
                            className: profileData.className || '',
                            batchYear: profileData.batchYear?.toString() || new Date().getFullYear().toString(),
                        });
                    }
                }
            } catch (err) {
                console.error('Failed to load profile:', err);
            }
        };

        checkProfile();
    }, []);

    // Cleanup preview URL on unmount
    useEffect(() => {
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    }, [previewUrl]);

    // Handle file selection
    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        setPhotoError(null);

        if (!file) return;

        // Validate file type
        const validTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!validTypes.includes(file.type)) {
            setPhotoError('Vui lòng chọn file ảnh (JPEG, PNG hoặc WebP)');
            return;
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            setPhotoError('Kích thước file tối đa là 5MB');
            return;
        }

        // Create preview
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(URL.createObjectURL(file));
        setSelectedFile(file);
    };

    // Handle drag and drop
    const handleDragOver = (event: React.DragEvent) => {
        event.preventDefault();
        event.stopPropagation();
    };

    const handleDrop = (event: React.DragEvent) => {
        event.preventDefault();
        event.stopPropagation();

        const file = event.dataTransfer.files?.[0];
        if (file) {
            // Simulate file input change
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            if (fileInputRef.current) {
                fileInputRef.current.files = dataTransfer.files;
                handleFileSelect({ target: { files: dataTransfer.files } } as React.ChangeEvent<HTMLInputElement>);
            }
        }
    };

    // Remove selected file
    const handleRemoveFile = () => {
        setSelectedFile(null);
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
        }
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    // Handle form change
    const handleInputChange = (field: keyof ProfileFormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        setFormErrors(prev => ({ ...prev, [field]: undefined }));
    };

    // Validate form
    const validateForm = (): boolean => {
        const errors: Partial<ProfileFormData> = {};

        if (!formData.fullName.trim()) {
            errors.fullName = 'Vui lòng nhập họ và tên';
        }
        if (!formData.faculty) {
            errors.faculty = 'Vui lòng chọn Khoa';
        }
        if (!formData.className.trim()) {
            errors.className = 'Vui lòng nhập Lớp';
        }
        if (!formData.batchYear.trim() || !/^\d{4}$/.test(formData.batchYear)) {
            errors.batchYear = 'Khóa phải là năm 4 chữ số';
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    // Submit form
    const handleSubmit = async () => {
        if (!validateForm()) return;

        // Check if photo exists
        if (!selectedFile && !existingPhotoUrl) {
            setSubmitError('Vui lòng tải lên ảnh thẻ sinh viên');
            return;
        }

        setIsSubmitting(true);
        setSubmitError(null);

        try {
            // Upload photo if selected
            if (selectedFile) {
                await uploadIdPhoto(selectedFile);
            }

            // Update profile via BFF proxy
            const response = await fetch('/api/proxy/users/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    fullName: formData.fullName,
                    faculty: formData.faculty,
                    className: formData.className,
                    batchYear: parseInt(formData.batchYear),
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update profile');
            }

            setSubmitSuccess(true);

            // Refresh profile status in AuthContext
            await refreshProfileStatus();

            // Navigate to dashboard after delay
            setTimeout(() => {
                navigate('/dashboard');
            }, 2000);

        } catch (err) {
            console.error('Submit error:', err);
            setSubmitError('Có lỗi xảy ra. Vui lòng thử lại.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Generate batch year options (last 10 years)
    const batchYearOptions = Array.from({ length: 10 }, (_, i) => {
        const year = new Date().getFullYear() - i;
        return year.toString();
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-900 dark:to-slate-800 p-4 flex items-center justify-center">
            <div className="w-full max-w-2xl">
                <Card className="shadow-xl">
                    <CardHeader className="text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                            <User className="w-8 h-8 text-white" />
                        </div>
                        <CardTitle className="text-2xl">Hoàn Thành Hồ Sơ</CardTitle>
                        <CardDescription>
                            Vui lòng điền thông tin và tải lên ảnh thẻ sinh viên để hoàn tất đăng ký
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Success Message */}
                        {submitSuccess && (
                            <Alert className="bg-green-50 border-green-200">
                                <Check className="h-4 w-4 text-green-600" />
                                <AlertDescription className="text-green-700">
                                    Cập nhật hồ sơ thành công! Đang chuyển hướng...
                                </AlertDescription>
                            </Alert>
                        )}

                        {/* Error Message */}
                        {submitError && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{submitError}</AlertDescription>
                            </Alert>
                        )}

                        {/* Student Info Display */}
                        <div className="p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
                            <p className="text-sm text-gray-500 dark:text-gray-400">Thông tin tài khoản</p>
                            <p className="font-semibold">
                                {profileInfo?.fullName || user?.fullName || user?.email || 'Chưa cập nhật tên'}
                            </p>
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                                Tài khoản: {profileInfo?.userId || user?.username || user?.id || 'N/A'}
                            </p>
                        </div>

                        {/* Form Fields */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Full Name - spans full width */}
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="fullName" className="flex items-center gap-2">
                                    <User className="w-4 h-4" />
                                    Họ và tên
                                </Label>
                                <Input
                                    id="fullName"
                                    placeholder="VD: Nguyễn Văn A"
                                    value={formData.fullName}
                                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                                    className={formErrors.fullName ? 'border-red-500' : ''}
                                />
                                {formErrors.fullName && (
                                    <p className="text-sm text-red-500">{formErrors.fullName}</p>
                                )}
                            </div>

                            {/* Faculty */}
                            <div className="space-y-2">
                                <Label htmlFor="faculty" className="flex items-center gap-2">
                                    <Building className="w-4 h-4" />
                                    Khoa
                                </Label>
                                <select
                                    id="faculty"
                                    value={formData.faculty}
                                    onChange={(e) => handleInputChange('faculty', e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 ${formErrors.faculty ? 'border-red-500' : ''
                                        }`}
                                >
                                    <option value="">-- Chọn Khoa --</option>
                                    {FACULTIES.map(f => (
                                        <option key={f} value={f}>{f}</option>
                                    ))}
                                </select>
                                {formErrors.faculty && (
                                    <p className="text-sm text-red-500">{formErrors.faculty}</p>
                                )}
                            </div>

                            {/* Class */}
                            <div className="space-y-2">
                                <Label htmlFor="className" className="flex items-center gap-2">
                                    <GraduationCap className="w-4 h-4" />
                                    Lớp
                                </Label>
                                <Input
                                    id="className"
                                    placeholder="VD: CNTT-K16A"
                                    value={formData.className}
                                    onChange={(e) => handleInputChange('className', e.target.value)}
                                    className={formErrors.className ? 'border-red-500' : ''}
                                />
                                {formErrors.className && (
                                    <p className="text-sm text-red-500">{formErrors.className}</p>
                                )}
                            </div>

                            {/* Batch Year */}
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="batchYear" className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    Khóa (Năm nhập học)
                                </Label>
                                <select
                                    id="batchYear"
                                    value={formData.batchYear}
                                    onChange={(e) => handleInputChange('batchYear', e.target.value)}
                                    className={`w-full px-3 py-2 border rounded-lg dark:bg-slate-700 dark:border-slate-600 ${formErrors.batchYear ? 'border-red-500' : ''
                                        }`}
                                >
                                    {batchYearOptions.map(year => (
                                        <option key={year} value={year}>{year}</option>
                                    ))}
                                </select>
                                {formErrors.batchYear && (
                                    <p className="text-sm text-red-500">{formErrors.batchYear}</p>
                                )}
                            </div>
                        </div>

                        {/* Photo Upload Section */}
                        <div className="space-y-4">
                            <Label className="flex items-center gap-2">
                                <Image className="w-4 h-4" />
                                Ảnh Thẻ Sinh Viên
                            </Label>

                            {/* Hidden file input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                onChange={handleFileSelect}
                                className="hidden"
                            />

                            {/* No photo yet - show upload area */}
                            {!previewUrl && !existingPhotoUrl && (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    onDragOver={handleDragOver}
                                    onDrop={handleDrop}
                                    className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-slate-700/50 transition-colors"
                                >
                                    <Upload className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                                    <p className="text-gray-600 dark:text-gray-400 mb-2">
                                        Kéo thả ảnh vào đây hoặc <span className="text-blue-600 font-medium">chọn file</span>
                                    </p>
                                    <p className="text-sm text-gray-500">
                                        JPEG, PNG hoặc WebP - Tối đa 5MB
                                    </p>
                                </div>
                            )}

                            {/* Photo error */}
                            {photoError && (
                                <Alert variant="destructive">
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>{photoError}</AlertDescription>
                                </Alert>
                            )}

                            {/* Photo preview */}
                            {(previewUrl || existingPhotoUrl) && (
                                <div className="space-y-3">
                                    <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                                        <img
                                            src={previewUrl || existingPhotoUrl!}
                                            alt="Ảnh thẻ sinh viên"
                                            className="w-full h-full object-contain"
                                        />
                                        <div className="absolute top-2 right-2 bg-green-500 text-white px-2 py-1 rounded text-sm flex items-center gap-1">
                                            <Check className="w-3 h-3" />
                                            {previewUrl ? 'Đã chọn' : 'Ảnh hiện tại'}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex-1"
                                        >
                                            <Upload className="w-4 h-4 mr-2" />
                                            Chọn ảnh khác
                                        </Button>
                                        {previewUrl && (
                                            <Button
                                                variant="outline"
                                                onClick={handleRemoveFile}
                                                className="text-red-600 hover:text-red-700"
                                            >
                                                <X className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Submit Button */}
                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting || submitSuccess}
                            className="w-full h-12 text-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                                    Đang xử lý...
                                </>
                            ) : (
                                <>
                                    <Check className="w-5 h-5 mr-2" />
                                    Hoàn Thành Đăng Ký
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default ProfileCompletionPage;
