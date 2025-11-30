import { useState, useEffect } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { sessionsApi, type Session } from '@/api/sessions';
import { incidentsApi, type Incident } from '@/api/incidents';
import { examsApi } from '@/api/exams';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Alert, AlertDescription } from '@/ui/alert';
import { Badge } from '@/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/ui/table';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';

interface ViolationWithDetails extends Incident {
  examName?: string;
}

export const MyViolationsPage = () => {
  const { user } = useAuth();
  const [violations, setViolations] = useState<ViolationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  useEffect(() => {
    if (user) {
      loadViolations();
    }
  }, [user]);

  const loadViolations = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);
      
      // Get all user sessions
      const sessions = await sessionsApi.getByUser(user.id);
      
      // Get incidents for all sessions
      const allViolations: ViolationWithDetails[] = [];
      
      for (const session of sessions) {
        try {
          const incidents = await incidentsApi.getAll({ sessionId: session.id }) as Incident[];
          
          // Get exam name
          let examName = 'Unknown Exam';
          try {
            const exam = await examsApi.getById(session.examId);
            examName = exam.name;
          } catch (err) {
            console.error('Error loading exam:', err);
          }
          
          if (Array.isArray(incidents)) {
            const violationsWithExam = incidents.map(incident => ({
              ...incident,
              examName
            }));
            allViolations.push(...violationsWithExam);
          }
        } catch (err) {
          console.error(`Error loading incidents for session ${session.id}:`, err);
        }
      }
      
      // Sort by timestamp descending
      allViolations.sort((a, b) => b.ts - a.ts);
      
      setViolations(allViolations);
    } catch (err) {
      console.error('Error loading violations:', err);
      setError('Không thể tải danh sách vi phạm. Vui lòng thử lại sau.');
    } finally {
      setLoading(false);
    }
  };

  const getFilteredViolations = () => {
    return violations.filter(violation => {
      const typeMatch = filterType === 'ALL' || violation.type === filterType;
      const statusMatch = filterStatus === 'ALL' || violation.status === filterStatus;
      return typeMatch && statusMatch;
    });
  };

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts); // ts is already in milliseconds
    return date.toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getStatusBadge = (status: Incident['status']) => {
    switch (status) {
      case 'OPEN':
        return <Badge className="bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-800 border border-yellow-200">⏳ Chờ duyệt</Badge>;
      case 'CONFIRMED':
        return <Badge className="bg-gradient-to-r from-red-500 to-rose-500 text-white border-0 shadow-sm">✕ Đã xác nhận</Badge>;
      case 'REJECTED':
        return <Badge className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200">✓ Đã từ chối</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getTypeBadge = (type: Incident['type']) => {
    const typeConfig: Record<Incident['type'], { label: string; color: string }> = {
      'TAB_ABUSE': { label: '🔄 Chuyển tab nhiều', color: 'bg-blue-100 text-blue-800 border-blue-200' },
      'NO_FACE': { label: '👤 Không phát hiện mặt', color: 'bg-purple-100 text-purple-800 border-purple-200' },
      'MULTI_FACE': { label: '👥 Nhiều khuôn mặt', color: 'bg-orange-100 text-orange-800 border-orange-200' },
      'PASTE_DETECTED': { label: '📋 Phát hiện dán', color: 'bg-pink-100 text-pink-800 border-pink-200' },
      'UNAUTHORIZED_DEVICE': { label: '🔒 Thiết bị không hợp lệ', color: 'bg-red-100 text-red-800 border-red-200' }
    };
    const config = typeConfig[type] || { label: type, color: 'bg-gray-100 text-gray-800 border-gray-200' };
    return <Badge className={`${config.color} border`}>{config.label}</Badge>;
  };

  const getSeverityColor = (score: number) => {
    if (score >= 0.8) return 'text-red-600 font-semibold';
    if (score >= 0.5) return 'text-orange-600 font-semibold';
    return 'text-yellow-600';
  };

  const filteredViolations = getFilteredViolations();
  const violationTypes = ['ALL', ...Array.from(new Set(violations.map(v => v.type)))];
  const violationStatuses = ['ALL', 'OPEN', 'CONFIRMED', 'REJECTED'];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Đang tải danh sách vi phạm...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50">
      <div className="container mx-auto p-6">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-red-600 to-orange-600 bg-clip-text text-transparent mb-3">Vi phạm của tôi</h1>
          <p className="text-gray-600 text-lg">Xem lại các vi phạm đã được phát hiện trong các kỳ thi</p>
        </div>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Info Alert */}
        <Alert className="mb-6 bg-blue-50 border-blue-200">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Lưu ý:</strong> Các vi phạm với trạng thái "Chờ duyệt" sẽ được giám thị xem xét. 
            Vi phạm "Đã xác nhận" có thể ảnh hưởng đến kết quả thi của bạn.
          </AlertDescription>
        </Alert>

        {/* Filters */}
        <Card className="mb-6 border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-orange-50 to-yellow-50">
            <CardTitle className="text-xl text-gray-800">🔍 Bộ lọc</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Loại vi phạm</label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn loại" />
                </SelectTrigger>
                <SelectContent>
                  {violationTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type === 'ALL' ? 'Tất cả' : type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Trạng thái</label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Chọn trạng thái" />
                </SelectTrigger>
                <SelectContent>
                  {violationStatuses.map(status => (
                    <SelectItem key={status} value={status}>
                      {status === 'ALL' ? 'Tất cả' : 
                       status === 'OPEN' ? 'Chờ duyệt' :
                       status === 'CONFIRMED' ? 'Đã xác nhận' : 'Đã từ chối'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Violations List */}
      {filteredViolations.length === 0 ? (
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="bg-gradient-to-br from-green-100 to-emerald-100 p-6 rounded-full mb-6">
              {violations.length === 0 ? (
                <span className="text-6xl">✓</span>
              ) : (
                <AlertTriangle className="h-16 w-16 text-yellow-600" />
              )}
            </div>
            <p className="text-gray-700 text-xl font-semibold">
              {violations.length === 0 
                ? 'Bạn không có vi phạm nào' 
                : 'Không tìm thấy vi phạm nào với bộ lọc hiện tại'}
            </p>
            <p className="text-gray-500 text-sm mt-2">
              {violations.length === 0 
                ? 'Hãy tiếp tục duy trì kỷ luật thi cử!' 
                : 'Thử thay đổi bộ lọc để xem các vi phạm khác'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50">
            <CardTitle className="text-2xl text-gray-800">
              ⚠️ Danh sách vi phạm ({filteredViolations.length}/{violations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kỳ thi</TableHead>
                  <TableHead>Loại vi phạm</TableHead>
                  <TableHead>Thời gian</TableHead>
                  <TableHead>Mức độ</TableHead>
                  <TableHead>Lý do</TableHead>
                  <TableHead>Trạng thái</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredViolations.map((violation) => (
                  <TableRow key={violation.id}>
                    <TableCell className="font-medium">
                      {violation.examName || 'Unknown'}
                    </TableCell>
                    <TableCell>{getTypeBadge(violation.type)}</TableCell>
                    <TableCell className="text-sm">
                      {formatTimestamp(violation.ts)}
                    </TableCell>
                    <TableCell>
                      <span className={getSeverityColor(violation.score)}>
                        {(violation.score * 100).toFixed(0)}%
                      </span>
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={violation.reason}>
                      {violation.reason}
                    </TableCell>
                    <TableCell>{getStatusBadge(violation.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Summary Statistics */}
      {violations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                📊 Tổng số vi phạm
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{violations.length}</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-red-50 to-rose-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                ✕ Đã xác nhận
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">
                {violations.filter(v => v.status === 'CONFIRMED').length}
              </p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-emerald-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                ✓ Đã từ chối
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                {violations.filter(v => v.status === 'REJECTED').length}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
};
