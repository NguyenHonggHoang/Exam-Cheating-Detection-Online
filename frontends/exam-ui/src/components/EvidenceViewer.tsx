import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ImageIcon, Video, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

/**
 * Supported video formats as per Requirements 6.5
 */
export const SUPPORTED_VIDEO_FORMATS = ['.mp4', '.webm', '.ogg', '.ogv'] as const;
export type SupportedVideoFormat = typeof SUPPORTED_VIDEO_FORMATS[number];

/**
 * Video MIME types mapping
 */
export const VIDEO_MIME_TYPES: Record<string, SupportedVideoFormat> = {
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/ogg': '.ogg',
    'video/ogv': '.ogv',
};

/**
 * Video metadata interface for onMetadataLoaded callback
 * Enhanced to include all relevant metadata fields
 */
export interface VideoMetadata {
    fileSize?: number;
    contentType?: string;
    lastModified?: string;
    duration?: number;
    objectKey?: string;
    width?: number;
    height?: number;
    /** Detected video format */
    format?: SupportedVideoFormat | null;
    /** Whether the media is a video */
    isVideo?: boolean;
}

interface EvidenceViewerProps {
    url: string | null | undefined;
    className?: string;
    objectKey?: string;
    /** Callback fired when video/image metadata is loaded */
    onMetadataLoaded?: (metadata: VideoMetadata) => void;
    /** Optional initial retry delay in ms (default: 1000) */
    retryDelayMs?: number;
}

/**
 * Detects if a URL or key represents a video file based on extension or MIME type
 * Supports: MP4, WebM, OGG as per Requirements 6.5
 * 
 * @param urlOrKey - URL or object key to check
 * @param contentType - Optional content type header for more accurate detection
 * @returns true if the URL/key represents a supported video format
 */
export function isVideoFormat(urlOrKey: string | null | undefined, contentType?: string): boolean {
    // Check content type first if provided (most reliable)
    if (contentType) {
        const lowerContentType = contentType.toLowerCase();
        if (lowerContentType.startsWith('video/')) {
            return true;
        }
    }
    
    if (!urlOrKey) return false;
    
    const lowerKey = urlOrKey.toLowerCase();
    
    // Remove query parameters for extension checking
    const pathWithoutQuery = lowerKey.split('?')[0];
    
    // Check for supported video extensions
    const hasVideoExtension = SUPPORTED_VIDEO_FORMATS.some(ext => pathWithoutQuery.endsWith(ext));
    if (hasVideoExtension) return true;
    
    // Check if extension is in the middle of the path (e.g., file.mp4?token=xxx)
    const hasVideoExtensionInPath = SUPPORTED_VIDEO_FORMATS.some(ext => lowerKey.includes(ext));
    if (hasVideoExtensionInPath) return true;
    
    // Check for video-related keywords in the path
    const videoKeywords = ['video', 'clip', 'recording'];
    const hasVideoKeyword = videoKeywords.some(keyword => lowerKey.includes(keyword));
    
    return hasVideoKeyword;
}

/**
 * Extracts the video format from a URL or key
 * Enhanced to handle query parameters and various URL formats
 * 
 * @param urlOrKey - URL or object key to check
 * @param contentType - Optional content type for more accurate detection
 * @returns The detected format or null if not a video
 */
export function detectVideoFormat(urlOrKey: string | null | undefined, contentType?: string): SupportedVideoFormat | null {
    // Check content type first if provided
    if (contentType) {
        const format = VIDEO_MIME_TYPES[contentType.toLowerCase()];
        if (format) return format;
    }
    
    if (!urlOrKey) return null;
    
    const lowerKey = urlOrKey.toLowerCase();
    
    // Remove query parameters for cleaner extension checking
    const pathWithoutQuery = lowerKey.split('?')[0];
    
    // Check for extension at end of path first (most reliable)
    for (const format of SUPPORTED_VIDEO_FORMATS) {
        if (pathWithoutQuery.endsWith(format)) {
            return format;
        }
    }
    
    // Fallback: check if extension exists anywhere in the URL
    for (const format of SUPPORTED_VIDEO_FORMATS) {
        if (lowerKey.includes(format)) {
            return format;
        }
    }
    
    return null;
}

/**
 * Gets the MIME type for a video format
 * 
 * @param format - The video format extension
 * @returns The corresponding MIME type
 */
export function getVideoMimeType(format: SupportedVideoFormat | null): string {
    switch (format) {
        case '.mp4':
            return 'video/mp4';
        case '.webm':
            return 'video/webm';
        case '.ogg':
        case '.ogv':
            return 'video/ogg';
        default:
            return 'video/mp4'; // Default fallback
    }
}

/**
 * EvidenceViewer Component
 * 
 * Automatically detects and displays either image or video evidence.
 * Uses objectKey to fetch presigned URL from backend if direct URL is not available.
 * 
 * Features:
 * - Automatic video/image detection based on file extension and content type
 * - Presigned URL fetching from backend
 * - Loading states with progress feedback (Requirements 6.2)
 * - Error handling with retry option (Requirements 6.3)
 * - Playback controls for video (Requirements 6.4)
 * - Support for MP4, WebM, OGG formats (Requirements 6.5)
 * - Metadata callback for parent components
 */
export const EvidenceViewer: React.FC<EvidenceViewerProps> = ({
    url,
    className = "w-full h-full object-contain",
    objectKey,
    onMetadataLoaded,
    retryDelayMs = 1000
}) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string>('');
    const [finalUrl, setFinalUrl] = useState<string | null>(null);
    const [fetchingUrl, setFetchingUrl] = useState(false);
    const [retryCount, setRetryCount] = useState(0);
    const [contentType, setContentType] = useState<string | undefined>(undefined);
    const videoRef = useRef<HTMLVideoElement>(null);
    const MAX_RETRIES = 2;

    // Extract objectKey from MinIO URL
    const extractObjectKey = useCallback((url: string | null | undefined): string | null => {
        if (!url) return null;

        // Try to extract from MinIO URL patterns
        const patterns = [
            /\/exam-evidence\/(.+)/,
            /\/exam-identity\/(.+)/,
            /objectKey=([^&]+)/
        ];

        for (const pattern of patterns) {
            const match = url.match(pattern);
            if (match) {
                return match[1].startsWith('exam-') ? match[1] : `exam-evidence/${match[1]}`;
            }
        }

        return null;
    }, []);

    // Build the final URL with retry logic
    const buildUrl = useCallback(async (currentRetry = 0) => {
        setLoading(true);
        setError(false);
        setErrorMessage('');
        setFetchingUrl(true);

        console.log('[EvidenceViewer] Input:', { url, objectKey, currentRetry });

        try {
            // If we have a direct URL that's already a proxy URL or data URL, use it
            if (url && (url.startsWith('/api/') || url.startsWith('data:') || url.startsWith('blob:'))) {
                console.log('[EvidenceViewer] Using direct URL:', url);
                setFinalUrl(url);
                setFetchingUrl(false);
                setLoading(false);
                return;
            }

            // If we have a direct URL that's a full external URL (and not internal minio), use it
            if (url && url.startsWith('http') && !url.includes('minio:9000') && !url.includes('localhost:9002')) {
                setFinalUrl(url);
                setFetchingUrl(false);
                setLoading(false);
                return;
            }

            // If URL is already a proxy URL for incidents, use it directly
            if (url && url.includes('/api/proxy/incidents/') && url.includes('/evidence')) {
                console.log('[EvidenceViewer] Using incident proxy URL:', url);
                setFinalUrl(url);
                setFetchingUrl(false);
                setLoading(false);
                return;
            }

            // Try to get presigned URL using objectKey
            const keyToUse = objectKey || extractObjectKey(url);

            if (keyToUse) {
                console.log('[EvidenceViewer] Fetching presigned URL for:', keyToUse);
                try {
                    const response = await fetch(`/api/proxy/storage/view-url?objectKey=${encodeURIComponent(keyToUse)}`, {
                        credentials: 'include',
                        headers: {
                            'Accept': 'application/json'
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.viewUrl) {
                            console.log('[EvidenceViewer] Got presigned URL');
                            // Store content type if available from response
                            if (data.contentType) {
                                setContentType(data.contentType);
                            }
                            setFinalUrl(data.viewUrl);
                            setFetchingUrl(false);
                            setLoading(false);
                            return;
                        }
                    } else {
                        const errorText = await response.text().catch(() => 'Unknown error');
                        console.error('[EvidenceViewer] Failed to get presigned URL:', response.status, errorText);
                        
                        // Retry on server errors (5xx) or network issues up to MAX_RETRIES times
                        if (response.status >= 500 && currentRetry < MAX_RETRIES) {
                            console.log(`[EvidenceViewer] Retrying... (${currentRetry + 1}/${MAX_RETRIES})`);
                            const delay = retryDelayMs * Math.pow(2, currentRetry); // Exponential backoff
                            await new Promise(resolve => setTimeout(resolve, delay));
                            return buildUrl(currentRetry + 1);
                        }
                        
                        // Set error message based on status
                        if (response.status === 404) {
                            setErrorMessage('Không tìm thấy file');
                        } else if (response.status === 403) {
                            setErrorMessage('Không có quyền truy cập file');
                        } else if (response.status >= 500) {
                            setErrorMessage('Lỗi server. Vui lòng thử lại.');
                        } else {
                            setErrorMessage('Không thể tải file');
                        }
                        setError(true);
                    }
                } catch (fetchError) {
                    console.error('[EvidenceViewer] Fetch error:', fetchError);
                    // Retry on network errors
                    if (currentRetry < MAX_RETRIES) {
                        console.log(`[EvidenceViewer] Retrying after network error... (${currentRetry + 1}/${MAX_RETRIES})`);
                        const delay = retryDelayMs * Math.pow(2, currentRetry);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        return buildUrl(currentRetry + 1);
                    }
                    setErrorMessage('Lỗi kết nối. Vui lòng kiểm tra mạng.');
                    setError(true);
                }
            }

            // Fallback to original URL if available
            if (url) {
                setFinalUrl(url);
                setFetchingUrl(false);
                setLoading(false);
                return;
            }

            // No URL available
            setFinalUrl(null);
            setFetchingUrl(false);
            setLoading(false);
        } catch (err) {
            console.error('[EvidenceViewer] Error building URL:', err);
            setFinalUrl(url || null);
            setFetchingUrl(false);
            setLoading(false);
            setError(true);
            setErrorMessage('Đã xảy ra lỗi không mong muốn');
        }
    }, [url, objectKey, extractObjectKey, retryDelayMs]);

    // Initial URL build
    useEffect(() => {
        let cancelled = false;
        
        const init = async () => {
            if (!cancelled) {
                await buildUrl(0);
            }
        };
        
        init();
        
        return () => {
            cancelled = true;
        };
    }, [url, objectKey, buildUrl]);

    // Handle retry button click
    const handleRetry = useCallback(() => {
        setRetryCount(prev => prev + 1);
        buildUrl(0);
    }, [buildUrl]);

    // Handle video metadata loaded event
    const handleVideoMetadataLoaded = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
        const video = event.currentTarget;
        setLoading(false);
        setError(false);
        
        const detectedKey = objectKey || extractObjectKey(url) || undefined;
        const detectedFormat = detectVideoFormat(detectedKey || finalUrl, contentType);
        
        if (onMetadataLoaded) {
            const metadata: VideoMetadata = {
                duration: video.duration,
                width: video.videoWidth,
                height: video.videoHeight,
                objectKey: detectedKey,
                contentType: contentType || getVideoMimeType(detectedFormat),
                format: detectedFormat,
                isVideo: true
            };
            onMetadataLoaded(metadata);
        }
    }, [onMetadataLoaded, objectKey, url, extractObjectKey, finalUrl, contentType]);

    // Handle video error
    const handleVideoError = useCallback((event: React.SyntheticEvent<HTMLVideoElement>) => {
        console.error('[EvidenceViewer] Video load error:', event);
        setLoading(false);
        setError(true);
        setErrorMessage('Không thể tải video. Vui lòng thử lại.');
    }, []);

    // Handle image error
    const handleImageError = useCallback(() => {
        setLoading(false);
        setError(true);
        setErrorMessage('Không thể tải ảnh. Vui lòng thử lại.');
    }, []);

    // Handle image load success
    const handleImageLoad = useCallback((event: React.SyntheticEvent<HTMLImageElement>) => {
        const img = event.currentTarget;
        setLoading(false);
        setError(false);
        
        if (onMetadataLoaded) {
            const detectedKey = objectKey || extractObjectKey(url) || undefined;
            const metadata: VideoMetadata = {
                width: img.naturalWidth,
                height: img.naturalHeight,
                objectKey: detectedKey,
                isVideo: false
            };
            onMetadataLoaded(metadata);
        }
    }, [onMetadataLoaded, objectKey, url, extractObjectKey]);

    // Determine if this is a video based on objectKey, URL, or content type
    const isVideo = isVideoFormat(objectKey || finalUrl || url, contentType);
    const detectedFormat = detectVideoFormat(objectKey || finalUrl || url, contentType);
    const mimeType = getVideoMimeType(detectedFormat);

    // Loading state while fetching URL
    if (fetchingUrl) {
        return (
            <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 border">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 mx-auto mb-2 animate-spin text-blue-500" />
                    <span>Đang tải...</span>
                </div>
            </div>
        );
    }

    // No URL available state
    if (!finalUrl && !error) {
        return (
            <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 border">
                <div className="text-center">
                    <ImageIcon className="w-12 h-12 mx-auto mb-2" />
                    <span>Không có bằng chứng</span>
                    {objectKey && (
                        <div className="text-xs mt-1 text-gray-500 max-w-xs truncate">
                            Key: {objectKey}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Error state with retry option (Requirements 1.3)
    if (error || (!finalUrl && errorMessage)) {
        return (
            <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 border">
                <div className="text-center">
                    <AlertCircle className="w-12 h-12 mx-auto mb-2 text-red-400" />
                    <span className="text-red-500 block mb-2">
                        {errorMessage || `Không thể tải ${isVideo ? 'video' : 'ảnh'}`}
                    </span>
                    <button
                        onClick={handleRetry}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                    >
                        <RefreshCw className="w-4 h-4" />
                        Thử lại
                    </button>
                    {objectKey && (
                        <div className="text-xs mt-2 text-gray-500 max-w-xs truncate">
                            {objectKey}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // Video rendering with playback controls (Requirements 6.4)
    if (isVideo) {
        return (
            <div className="aspect-video bg-black rounded-lg overflow-hidden border relative">
                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50 z-10">
                        <div className="text-center">
                            <Loader2 className="w-8 h-8 animate-spin text-white mx-auto mb-2" />
                            <span className="text-white text-sm">Đang tải video...</span>
                        </div>
                    </div>
                )}
                <video
                    ref={videoRef}
                    src={finalUrl!}
                    controls
                    className={className}
                    preload="metadata"
                    onLoadedMetadata={handleVideoMetadataLoaded}
                    onError={handleVideoError}
                    onLoadStart={() => setLoading(true)}
                    onCanPlay={() => setLoading(false)}
                >
                    {/* Provide multiple source formats for better compatibility */}
                    <source src={finalUrl!} type={mimeType} />
                    {mimeType !== 'video/mp4' && <source src={finalUrl!} type="video/mp4" />}
                    {mimeType !== 'video/webm' && <source src={finalUrl!} type="video/webm" />}
                    {mimeType !== 'video/ogg' && <source src={finalUrl!} type="video/ogg" />}
                    Trình duyệt không hỗ trợ video.
                </video>
            </div>
        );
    }

    // Image rendering
    return (
        <div className="aspect-video bg-black rounded-lg overflow-hidden border relative">
            {loading && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900/50">
                    <Loader2 className="w-8 h-8 animate-spin text-white" />
                </div>
            )}
            <img
                src={finalUrl!}
                alt="Evidence"
                className={className}
                onLoad={handleImageLoad}
                onError={handleImageError}
            />
        </div>
    );
};

export default EvidenceViewer;
