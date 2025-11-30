import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { examsApi, type Exam } from '@/api/exams';
import { sessionsApi } from '@/api/sessions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/ui/card';
import { Button } from '@/ui/button';
import { Alert, AlertDescription } from '@/ui/alert';
import { Badge } from '@/ui/badge';
import { 
  AlertCircle, 
  Clock, 
  Calendar, 
  BookOpen, 
  CheckCircle,
  AlertTriangle,
  Video,
  Monitor
} from 'lucide-react';

export const StudentStartExamPage = () => {
  const { examId } = useParams<{ examId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checksCompleted, setChecksCompleted] = useState({
    camera: false,
    microphone: false,
    screenShare: false,
  });

  useEffect(() => {
    if (examId) {
      loadExam();
      performSystemChecks();
    }
  }, [examId]);

  const loadExam = async () => {
    if (!examId) return;

    try {
      setLoading(true);
      const examData = await examsApi.getById(examId);
      setExam(examData);
    } catch (err) {
      console.error('Error loading exam:', err);
      setError('Không thể tải thông tin kỳ thi. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const performSystemChecks = async () => {
    // Simulate system checks
    setTimeout(() => setChecksCompleted(prev => ({ ...prev, camera: true })), 1000);
    setTimeout(() => setChecksCompleted(prev => ({ ...prev, microphone: true })), 1500);
    setTimeout(() => setChecksCompleted(prev => ({ ...prev, screenShare: true })), 2000);
  };

  const handleStartExam = async () => {
    if (!exam || !user) return;

    try {
      setStarting(true);
      setError(null);

      // Start a new session (use 'start' instead of 'create')
      const session = await sessionsApi.start({
        examId: exam.id,
        userId: user.id
      });

      // Navigate to exam page (mock exam for now)
      navigate(`/exam/${exam.id}/session/${session.id}`);
    } catch (err) {
      console.error('Error starting exam:', err);
      setError('Không thể bắt đầu kỳ thi. Vui lòng thử lại sau.');
    } finally {
      setStarting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const allChecksComplete = Object.values(checksCompleted).every(check => check);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải thông tin kỳ thi...</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Không tìm thấy kỳ thi</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">{exam.name}</h1>
        <p className="text-gray-600 mt-2">Chuẩn bị bắt đầu kỳ thi</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Exam Information */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Thông tin kỳ thi</CardTitle>
          <CardDescription>Vui lòng đọc kỹ trước khi bắt đầu</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start">
              <Calendar className="w-5 h-5 mr-3 mt-1 text-blue-600" />
              <div>
                <p className="text-sm text-gray-500">Thời gian thi</p>
                <p className="font-medium">{formatDate(exam.startTime)}</p>
              </div>
            </div>
            <div className="flex items-start">
              <Clock className="w-5 h-5 mr-3 mt-1 text-blue-600" />
              <div>
                <p className="text-sm text-gray-500">Thời lượng</p>
                <p className="font-medium">{exam.durationMinutes} phút</p>
              </div>
            </div>
            <div className="flex items-start">
              <BookOpen className="w-5 h-5 mr-3 mt-1 text-blue-600" />
              <div>
                <p className="text-sm text-gray-500">Mô tả</p>
                <p className="font-medium">{exam.description || 'Không có mô tả'}</p>
              </div>
            </div>
            <div className="flex items-start">
              <CheckCircle className="w-5 h-5 mr-3 mt-1 text-blue-600" />
              <div>
                <p className="text-sm text-gray-500">Trạng thái</p>
                <Badge className="mt-1">{exam.status === 'ACTIVE' ? 'Đang mở' : 'Đã đóng'}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Checks */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Kiểm tra hệ thống</CardTitle>
          <CardDescription>Đảm bảo thiết bị của bạn sẵn sàng cho kỳ thi</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div className="flex items-center">
              <Video className="w-5 h-5 mr-3 text-gray-600" />
              <span>Camera</span>
            </div>
            {checksCompleted.camera ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            )}
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div className="flex items-center">
              <Monitor className="w-5 h-5 mr-3 text-gray-600" />
              <span>Microphone</span>
            </div>
            {checksCompleted.microphone ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            )}
          </div>
          <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
            <div className="flex items-center">
              <Monitor className="w-5 h-5 mr-3 text-gray-600" />
              <span>Chia sẻ màn hình</span>
            </div>
            {checksCompleted.screenShare ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Rules and Warnings */}
      <Alert className="mb-6 border-yellow-200 bg-yellow-50">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-yellow-800">
          <strong>Lưu ý quan trọng:</strong>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Không được chuyển tab hoặc cửa sổ trong quá trình thi</li>
            <li>Camera phải luôn bật và quay rõ khuôn mặt</li>
            <li>Không được sử dụng tài liệu hoặc thiết bị hỗ trợ khác</li>
            <li>Hệ thống sẽ tự động giám sát và ghi lại các hành vi bất thường</li>
          </ul>
        </AlertDescription>
      </Alert>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <Button
          variant="outline"
          onClick={() => navigate('/exams')}
          disabled={starting}
        >
          Quay lại
        </Button>
        <Button
          onClick={handleStartExam}
          disabled={!allChecksComplete || starting || exam.status !== 'ACTIVE'}
          className="flex-1"
        >
          {starting ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Đang bắt đầu...
            </>
          ) : (
            'Bắt đầu làm bài'
          )}
        </Button>
      </div>

      {!allChecksComplete && (
        <p className="text-sm text-gray-500 text-center mt-4">
          Vui lòng đợi kiểm tra hệ thống hoàn tất...
        </p>
      )}
    </div>
  );
};

export default StudentStartExamPage;
