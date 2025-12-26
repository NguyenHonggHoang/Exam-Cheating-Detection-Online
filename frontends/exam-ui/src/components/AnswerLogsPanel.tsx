import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/ui/table';
import { Badge } from '@/ui/badge';
import { 
  FileText, 
  Loader2, 
  AlertTriangle, 
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Keyboard,
  AlertCircle
} from 'lucide-react';
import { sessionsApi, AnswerLog } from '@/api/sessions';
import { msToSeconds } from '@/lib/utils/formatters';

/**
 * Sort field options for answer logs table
 */
export type SortField = 'questionIndex' | 'timeToAnswerMs' | 'revisionCount';

/**
 * Sort order options
 */
export type SortOrder = 'asc' | 'desc';

interface AnswerLogsPanelProps {
  /** The session ID to fetch answer logs for */
  sessionId: string;
}

/**
 * AnswerLogsPanel Component
 * 
 * Displays detailed answer logs for a session in a sortable table.
 * Shows question index, difficulty, time spent, revisions, typing speed,
 * and pre-suspicion status.
 * 
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7**
 */
export const AnswerLogsPanel: React.FC<AnswerLogsPanelProps> = ({ sessionId }) => {
  const [logs, setLogs] = useState<AnswerLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('questionIndex');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const fetchLogs = async () => {
    if (!sessionId) {
      setLoading(false);
      setError('Không có session ID');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await sessionsApi.getAnswerLogs(sessionId);
      setLogs(response.content || []);
    } catch (err: any) {
      console.error('[AnswerLogsPanel] Failed to fetch answer logs:', err);
      if (err.response?.status === 404) {
        setError('Không tìm thấy lịch sử trả lời');
      } else {
        setError('Không thể tải lịch sử trả lời');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [sessionId]);

  /**
   * Sorts answer logs based on current sort field and order
   * **Property 7: Answer Log Sorting**
   * **Validates: Requirements 4.7**
   */
  const sortedLogs = useMemo(() => {
    return sortAnswerLogs(logs, sortField, sortOrder);
  }, [logs, sortField, sortOrder]);

  /**
   * Handles column header click for sorting
   */
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // Toggle order if same field
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // New field, default to ascending
      setSortField(field);
      setSortOrder('asc');
    }
  };

  /**
   * Renders sort indicator icon
   */
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />;
    }
    return sortOrder === 'asc' 
      ? <ArrowUp className="w-4 h-4 ml-1" />
      : <ArrowDown className="w-4 h-4 ml-1" />;
  };

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Lịch sử Trả lời
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-gray-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span>Đang tải...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Lịch sử Trả lời
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <AlertTriangle className="w-8 h-8 text-yellow-500 mb-2" />
            <p className="text-sm mb-3">{error}</p>
            <button
              onClick={fetchLogs}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-md hover:bg-blue-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Thử lại
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Lịch sử Trả lời
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-gray-500">
            <FileText className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">Chưa có lịch sử trả lời</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Lịch sử Trả lời ({logs.length} câu)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              {/* Question Index - Requirements 4.2 */}
              <TableHead>
                <button
                  onClick={() => handleSort('questionIndex')}
                  className="flex items-center hover:text-blue-600 transition-colors"
                >
                  Câu hỏi
                  {renderSortIcon('questionIndex')}
                </button>
              </TableHead>
              
              {/* Difficulty - Requirements 4.2 */}
              <TableHead>Độ khó</TableHead>
              
              {/* Time Spent - Requirements 4.3 */}
              <TableHead>
                <button
                  onClick={() => handleSort('timeToAnswerMs')}
                  className="flex items-center hover:text-blue-600 transition-colors"
                >
                  Thời gian (s)
                  {renderSortIcon('timeToAnswerMs')}
                </button>
              </TableHead>
              
              {/* Revision Count - Requirements 4.4 */}
              <TableHead>
                <button
                  onClick={() => handleSort('revisionCount')}
                  className="flex items-center hover:text-blue-600 transition-colors"
                >
                  Sửa đổi
                  {renderSortIcon('revisionCount')}
                </button>
              </TableHead>
              
              {/* Typing Speed - Requirements 4.5 */}
              <TableHead>Tốc độ gõ</TableHead>
              
              {/* Pre-suspicion - Requirements 4.6 */}
              <TableHead>Nghi ngờ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLogs.map((log) => (
              <TableRow key={log.id}>
                {/* Question Index */}
                <TableCell className="font-medium">
                  #{log.questionIndex}
                </TableCell>
                
                {/* Difficulty Badge */}
                <TableCell>
                  <DifficultyBadge difficulty={log.difficulty} />
                </TableCell>
                
                {/* Time in seconds */}
                <TableCell>
                  {msToSeconds(log.timeToAnswerMs)}s
                </TableCell>
                
                {/* Revision Count */}
                <TableCell>
                  <span className={log.revisionCount > 3 ? 'text-orange-600 font-medium' : ''}>
                    {log.revisionCount}
                  </span>
                </TableCell>
                
                {/* Typing Speed */}
                <TableCell>
                  {log.averageTypingSpeed !== null ? (
                    <span className="flex items-center gap-1">
                      <Keyboard className="w-3 h-3 text-gray-400" />
                      {log.averageTypingSpeed.toFixed(1)} wpm
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </TableCell>
                
                {/* Pre-suspicion Indicator */}
                <TableCell>
                  {log.hadPreSuspicionDuring ? (
                    <span className="flex items-center gap-1 text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      Có
                    </span>
                  ) : (
                    <span className="text-gray-400">Không</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

/**
 * Difficulty badge component with color coding
 */
const DifficultyBadge: React.FC<{ difficulty: AnswerLog['difficulty'] }> = ({ difficulty }) => {
  const variants: Record<AnswerLog['difficulty'], { variant: 'default' | 'secondary' | 'destructive'; label: string }> = {
    easy: { variant: 'secondary', label: 'Dễ' },
    medium: { variant: 'default', label: 'Trung bình' },
    hard: { variant: 'destructive', label: 'Khó' }
  };
  
  const config = variants[difficulty] || variants.medium;
  
  return (
    <Badge variant={config.variant}>
      {config.label}
    </Badge>
  );
};

/**
 * Sorts answer logs by the specified field and order.
 * This is a pure function that can be tested independently.
 * 
 * **Property 7: Answer Log Sorting**
 * *For any* list of answer logs and any valid sort field (questionIndex, timeToAnswerMs, revisionCount),
 * sorting SHALL correctly reorder the list in ascending or descending order.
 * **Validates: Requirements 4.7**
 * 
 * @param logs - Array of answer logs to sort
 * @param field - Field to sort by
 * @param order - Sort order (asc or desc)
 * @returns Sorted array of answer logs
 */
export function sortAnswerLogs(
  logs: AnswerLog[],
  field: SortField,
  order: SortOrder
): AnswerLog[] {
  if (!logs || logs.length === 0) {
    return [];
  }

  return [...logs].sort((a, b) => {
    let comparison = 0;
    
    switch (field) {
      case 'questionIndex':
        comparison = a.questionIndex - b.questionIndex;
        break;
      case 'timeToAnswerMs':
        comparison = a.timeToAnswerMs - b.timeToAnswerMs;
        break;
      case 'revisionCount':
        comparison = a.revisionCount - b.revisionCount;
        break;
      default:
        comparison = 0;
    }
    
    return order === 'asc' ? comparison : -comparison;
  });
}

export default AnswerLogsPanel;
