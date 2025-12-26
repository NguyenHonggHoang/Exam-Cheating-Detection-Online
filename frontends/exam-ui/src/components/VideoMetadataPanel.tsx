import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Badge } from '@/ui/badge';
import { FileVideo, HardDrive, Clock, Calendar, User, AlertTriangle, Loader2, RefreshCw } from 'lucide-react';
import { storageApi, StorageMetadata } from '@/api/storage';
import { formatFileSize, formatDuration, formatTimestampVN } from '@/lib/utils/formatters';
import { getViolationLabel } from '@/lib/utils/violationLabels';

interface VideoMetadataPanelProps {
  /** The object key (path) in MinIO storage */
  objectKey: string;
  /** The session ID associated with this video */
  sessionId: string;
  /** The type of violation that triggered the recording */
  violationType: string;
}

/**
 * VideoMetadataPanel Component
 * 
 * Displays metadata for evidence videos including file size, duration,
 * creation timestamp, session ID, and violation type.
 * 
 * Fetches metadata from the backend storage API.
 * 
 * **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6**
 */
export const VideoMetadataPanel: React.FC<VideoMetadataPanelProps> = ({
  objectKey,
  sessionId,
  violationType
}) => {
  const [metadata, setMetadata] = useState<StorageMetadata | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetadata = async () => {
    if (!objectKey) {
      setLoading(false);
      setError('Không có object key');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await storageApi.getStorageMetadata(objectKey);
      setMetadata(data);
    } catch (err: any) {
      console.warn('[VideoMetadataPanel] Metadata not available:', err.response?.status);

      // 404 is not critical - metadata might not be indexed yet
      // Continue showing UI with basic info from props
      if (err.response?.status === 404) {
        setError(null); // Don't show error for missing metadata
        setMetadata(null); // Will show fallback values
      } else {
        setError('Không thể tải thông tin video');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetadata();
  }, [objectKey]);

  // Loading state
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileVideo className="w-5 h-5" />
            Thông tin Video
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4 text-gray-500">
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
            <FileVideo className="w-5 h-5" />
            Thông tin Video
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-4 text-gray-500">
            <AlertTriangle className="w-8 h-8 text-yellow-500 mb-2" />
            <p className="text-sm mb-3">{error}</p>
            <button
              onClick={fetchMetadata}
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileVideo className="w-5 h-5" />
          Thông tin Video
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* File Size - Requirements 7.1 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-600">
              <HardDrive className="w-4 h-4" />
              <span className="text-sm">Kích thước</span>
            </div>
            <span className="font-medium">
              {metadata?.fileSize ? formatFileSize(metadata.fileSize) : '-'}
            </span>
          </div>

          {/* Duration - Requirements 7.2 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Thời lượng</span>
            </div>
            <span className="font-medium">
              {metadata?.durationMs ? formatDuration(metadata.durationMs) : '-'}
            </span>
          </div>

          {/* Creation Timestamp - Requirements 7.3 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-600">
              <Calendar className="w-4 h-4" />
              <span className="text-sm">Thời gian tạo</span>
            </div>
            <span className="font-medium">
              {metadata?.lastModified ? formatTimestampVN(metadata.lastModified) : '-'}
            </span>
          </div>

          {/* Session ID - Requirements 7.4 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-600">
              <User className="w-4 h-4" />
              <span className="text-sm">Session ID</span>
            </div>
            <span className="font-mono text-sm text-gray-700 truncate max-w-[180px]" title={sessionId}>
              {sessionId}
            </span>
          </div>

          {/* Violation Type - Requirements 7.5 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-600">
              <AlertTriangle className="w-4 h-4" />
              <span className="text-sm">Loại vi phạm</span>
            </div>
            <Badge variant="destructive">
              {getViolationLabel(violationType)}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default VideoMetadataPanel;
