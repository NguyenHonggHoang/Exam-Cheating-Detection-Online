import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { examsApi, type Exam } from '@/api/exams';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/ui/card';
import { Button } from '@/ui/button';
import { Badge } from '@/ui/badge';
import { Calendar, Clock, BookOpen, AlertCircle, Filter, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/ui/alert';

type ExamStatusFilter = 'ALL' | 'ACTIVE' | 'SCHEDULED' | 'ENDED';

const STATUS_TABS: { key: ExamStatusFilter; label: string }[] = [
  { key: 'ALL', label: 'Tất cả' },
  { key: 'ACTIVE', label: 'Đang mở' },
  { key: 'SCHEDULED', label: 'Sắp diễn ra' },
  { key: 'ENDED', label: 'Đã kết thúc' },
];

export const ExamsPage = () => {
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingCamera, setCheckingCamera] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ExamStatusFilter>('ALL');

  useEffect(() => {
    loadExams();
  }, [statusFilter]);

  const loadExams = async () => {
    try {
      setLoading(true);
      setError(null);
      // Pass status filter to API (undefined for ALL)
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

  const isExamAvailable = (exam: Exam) => {
    const now = new Date();
    const startTime = new Date(exam.startTime);
    const endTime = new Date(exam.endTime);
    return exam.status === 'ACTIVE' && now >= startTime && now <= endTime;
  };

  const getExamStatusBadge = (exam: Exam) => {
    const now = new Date();
    const startTime = new Date(exam.startTime);

    if (exam.status === 'ENDED') {
      return <Badge variant="secondary">Đã kết thúc</Badge>;
    }

    if (now < startTime) {
      return <Badge variant="outline">Sắp diễn ra</Badge>;
    }

    if (isExamAvailable(exam)) {
      return <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-sm">Đang mở</Badge>;
    }

    return <Badge variant="secondary">Không khả dụng</Badge>;
  };

  const handleStartExam = async (examId: string) => {
    setCheckingCamera(true);
    setError(null);

    try {
      // Request camera permission
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });

      // Stop the stream immediately after checking
      stream.getTracks().forEach(track => track.stop());

      // Navigate to exam landing page (StudentStartExamPage)
      navigate(`/exams/${examId}/start`);
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Không thể truy cập camera. Bạn cần cấp quyền sử dụng camera để tham gia thi.');
    } finally {
      setCheckingCamera(false);
    }
  };

  if (loading && exams.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải danh sách kỳ thi...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="container mx-auto p-6">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">Kỳ thi</h1>
          <p className="text-gray-600 text-lg">Chọn kỳ thi để bắt đầu làm bài</p>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex bg-white rounded-lg p-1 shadow-sm border">
            {STATUS_TABS.map(tab => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${statusFilter === tab.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {exams.length === 0 ? (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="bg-gradient-to-br from-blue-100 to-purple-100 p-6 rounded-full mb-6">
                <BookOpen className="h-16 w-16 text-blue-600" />
              </div>
              <p className="text-gray-700 text-xl font-semibold">
                {statusFilter === 'ALL'
                  ? 'Hiện tại không có kỳ thi nào'
                  : `Không có kỳ thi nào ở trạng thái "${STATUS_TABS.find(t => t.key === statusFilter)?.label}"`
                }
              </p>
              <p className="text-gray-500 text-sm mt-2">Vui lòng quay lại sau</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exams.map((exam) => (
              <Card key={exam.id} className="hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-0 shadow-md bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-xl">{exam.name}</CardTitle>
                    {getExamStatusBadge(exam)}
                  </div>
                  <CardDescription className="line-clamp-2">
                    {exam.description || 'Không có mô tả'}
                  </CardDescription>
                  {/* SEB Badge */}
                  {(exam.browserMode === 'SEB_REQUIRED' || exam.browserMode === 'SEB_OPTIONAL') && (
                    <div className="mt-2 flex">
                      <Badge variant={exam.browserMode === 'SEB_REQUIRED' ? 'destructive' : 'secondary'} className="flex items-center gap-1 text-xs">
                        <Shield className="w-3 h-3" />
                        {exam.browserMode === 'SEB_REQUIRED' ? 'Yêu cầu SEB' : 'Khuyên dùng SEB'}
                      </Badge>
                    </div>
                  )}
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>Bắt đầu: {formatDate(exam.startTime)}</span>
                  </div>

                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="w-4 h-4 mr-2" />
                    <span>Kết thúc: {formatDate(exam.endTime)}</span>
                  </div>

                  <div className="flex items-center text-sm text-gray-600">
                    <Clock className="w-4 h-4 mr-2" />
                    <span>Thời gian: {exam.durationMinutes} phút</span>
                  </div>
                </CardContent>

                <CardFooter>
                  <Button
                    className="w-full"
                    disabled={!isExamAvailable(exam) || checkingCamera}
                    onClick={() => handleStartExam(exam.id)}
                  >
                    {checkingCamera ? 'Đang kiểm tra camera...' :
                      isExamAvailable(exam) ? 'Bắt đầu thi' : 'Chưa khả dụng'}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
