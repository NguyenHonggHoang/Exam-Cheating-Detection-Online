import { sessionsApi } from '@/api/sessions';
import { incidentsApi, type IncidentType } from '@/api/incidents';

// Re-export IncidentType for consumers
export type { IncidentType };

export interface UploadResult {
    success: boolean;
    url?: string;
    objectKey?: string;
    error?: string;
}

export interface StorageQuota {
    usageBytes: number;
    limitBytes: number;
    fileCount: number;
    canUpload: boolean;
}

// Upload throttling - increased limits for continuous violations
// Evidence is critical for review, so we allow more uploads
const UPLOAD_LIMITS = {
    SNAPSHOT: { maxPerMinute: 20, intervalMs: 60000 },  // 20 snapshots/minute
    CLIP: { maxPerMinute: 5, intervalMs: 60000 }         // 5 clips/minute
};

const uploadCounts = new Map<string, { count: number; resetAt: number }>();

/**
 * Check if upload is allowed (throttling)
 */
function checkThrottling(type: 'snapshot' | 'clip'): boolean {
    const key = type.toUpperCase();
    const limit = UPLOAD_LIMITS[key as keyof typeof UPLOAD_LIMITS];
    const now = Date.now();

    const current = uploadCounts.get(key) || { count: 0, resetAt: now + limit.intervalMs };

    // Reset if interval passed
    if (now >= current.resetAt) {
        uploadCounts.set(key, { count: 1, resetAt: now + limit.intervalMs });
        return true;
    }

    // Check limit
    if (current.count >= limit.maxPerMinute) {
        return false;
    }

    // Increment count
    uploadCounts.set(key, { count: current.count + 1, resetAt: current.resetAt });
    return true;
}

/**
 * Get storage quota for session
 */
export async function getStorageQuota(sessionId: string): Promise<StorageQuota> {
    try {
        const usage = await sessionsApi.getStorageUsage(sessionId);
        return {
            usageBytes: usage.usageBytes,
            limitBytes: usage.limitBytes,
            fileCount: usage.fileCount,
            canUpload: !usage.quotaExceeded
        };
    } catch (error) {
        console.error('[MinIO] Failed to get quota:', error);
        return {
            usageBytes: 0,
            limitBytes: 50 * 1024 * 1024, // 50MB default
            fileCount: 0,
            canUpload: true
        };
    }
}

/**
 * Upload snapshot to MinIO
 */
export async function uploadSnapshot(
    sessionId: string,
    blob: Blob,
    violationType?: IncidentType
): Promise<UploadResult> {
    // Check throttling
    if (!checkThrottling('snapshot')) {
        console.log('[MinIO] Snapshot upload throttled');
        return { success: false, error: 'Upload throttled' };
    }

    try {
        // Get presigned URL
        const presigned = await sessionsApi.getPresignedUrl({
            sessionId,
            type: 'snapshot',
            contentType: blob.type || 'image/jpeg'
        });

        // Upload to MinIO using full presigned URL (includes signature)
        // Note: presigned URLs include AWS S3-compatible signature for authentication
        const uploadResponse = await fetch(presigned.uploadUrl, {
            method: 'PUT',
            body: blob,
            headers: {
                'Content-Type': blob.type || 'image/jpeg'
            }
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('[MinIO] Upload error response:', errorText);
            throw new Error(`Upload failed: ${uploadResponse.status}`);
        }

        console.log(`[MinIO] Snapshot uploaded: ${presigned.publicUrl}`);

        // Send evidence to Incident Service if violation
        if (violationType) {
            await incidentsApi.sendClientEvent({
                sessionId,
                eventType: 'EVIDENCE_SNAPSHOT',
                violationType,
                evidenceUrl: presigned.publicUrl,
                objectKey: presigned.objectKey,
                fileSize: blob.size,
                timestamp: Date.now(),
                source: 'FRONTEND_AI'
            });
        }

        return {
            success: true,
            url: presigned.publicUrl,
            objectKey: presigned.objectKey
        };
    } catch (error) {
        console.error('[MinIO] Snapshot upload error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Upload failed'
        };
    }
}

/**
 * Upload video clip to MinIO
 */
export async function uploadClip(
    sessionId: string,
    blob: Blob,
    violationType?: IncidentType
): Promise<UploadResult> {
    // Check throttling
    if (!checkThrottling('clip')) {
        console.log('[MinIO] Clip upload throttled');
        return { success: false, error: 'Upload throttled' };
    }

    try {
        // Get presigned URL
        const presigned = await sessionsApi.getPresignedUrl({
            sessionId,
            type: 'clip',
            contentType: blob.type || 'video/webm'
        });

        // Upload to MinIO using full presigned URL (includes signature)
        const uploadResponse = await fetch(presigned.uploadUrl, {
            method: 'PUT',
            body: blob,
            headers: {
                'Content-Type': blob.type || 'video/webm'
            }
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            console.error('[MinIO] Upload error response:', errorText);
            throw new Error(`Upload failed: ${uploadResponse.status}`);
        }

        console.log(`[MinIO] Clip uploaded: ${presigned.publicUrl}`);

        // Send evidence to Incident Service if violation
        if (violationType) {
            await incidentsApi.sendClientEvent({
                sessionId,
                eventType: 'EVIDENCE_CLIP',
                violationType,
                evidenceUrl: presigned.publicUrl,
                objectKey: presigned.objectKey,
                fileSize: blob.size,
                timestamp: Date.now(),
                source: 'FRONTEND_AI'
            });

            // Queue for Python AI analysis (YOLO detection)
            try {
                await sessionsApi.queueVideoAnalysis({
                    sessionId,
                    objectKey: presigned.objectKey,
                    publicUrl: presigned.publicUrl,
                    violationType,
                    timestamp: Date.now(),
                    durationMs: 5000, // Default 5 seconds
                    mimeType: blob.type || 'video/webm',
                    fileSize: blob.size
                });
                console.log(`[MinIO] Video queued for AI analysis: ${violationType}`);
            } catch (analysisError) {
                // Non-blocking - don't fail upload if analysis queue fails
                console.warn('[MinIO] Failed to queue video analysis:', analysisError);
            }
        }

        return {
            success: true,
            url: presigned.publicUrl,
            objectKey: presigned.objectKey
        };
    } catch (error) {
        console.error('[MinIO] Clip upload error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Upload failed'
        };
    }
}

/**
 * Check if upload is allowed (quota + throttling)
 */
export async function canUpload(
    sessionId: string,
    type: 'snapshot' | 'clip',
    fileSize: number
): Promise<{ allowed: boolean; reason?: string }> {
    // Check throttling
    const key = type.toUpperCase();
    const limit = UPLOAD_LIMITS[key as keyof typeof UPLOAD_LIMITS];
    const now = Date.now();
    const current = uploadCounts.get(key) || { count: 0, resetAt: now + limit.intervalMs };

    if (now < current.resetAt && current.count >= limit.maxPerMinute) {
        return { allowed: false, reason: `Rate limit: max ${limit.maxPerMinute} ${type}s per minute` };
    }

    // Check quota
    try {
        const quota = await getStorageQuota(sessionId);

        if (quota.usageBytes + fileSize > quota.limitBytes) {
            return { allowed: false, reason: 'Storage quota exceeded' };
        }

        return { allowed: true };
    } catch {
        // Allow if quota check fails (graceful degradation)
        return { allowed: true };
    }
}

/**
 * Capture canvas content as blob
 */
export async function captureCanvasAsBlob(
    canvas: HTMLCanvasElement,
    quality: number = 0.8
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Failed to capture canvas as blob'));
                }
            },
            'image/jpeg',
            quality
        );
    });
}

export interface UploadProgress {
    percent: number;
    loaded: number;
    total: number;
}

export interface EvidenceMetadata {
    detectionResult?: unknown;
    consecutiveCount?: number;
    firstDetectedAt?: number;
}

/**
 * Upload evidence to MinIO (unified function for violations)
 */
export async function uploadEvidence(
    sessionId: string,
    blob: Blob,
    evidenceType: 'snapshot' | 'clip',
    violationType: string,
    _severity: string, // unused but kept for API compatibility
    metadata?: EvidenceMetadata,
    onProgress?: (progress: UploadProgress) => void
): Promise<{ url: string; objectKey: string }> {
    try {
        // Determine content type
        const contentType = blob.type || (evidenceType === 'snapshot' ? 'image/jpeg' : 'video/webm');

        // Get presigned URL
        const presigned = await sessionsApi.getPresignedUrl({
            sessionId,
            type: evidenceType,
            contentType
        });

        console.log(`[MinIO] Got presigned URL:`, {
            uploadUrl: presigned.uploadUrl.substring(0, 150) + '...',
            publicUrl: presigned.publicUrl,
            objectKey: presigned.objectKey,
            blobSize: blob.size,
            blobType: blob.type
        });

        // Upload to MinIO using full presigned URL (includes signature)
        const uploadResponse = await fetch(presigned.uploadUrl, {
            method: 'PUT',
            body: blob,
            headers: {
                'Content-Type': contentType
            }
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text().catch(() => '');
            console.error(`[MinIO] Upload failed: ${uploadResponse.status} - ${errorText}`);
            throw new Error(`Upload failed: ${uploadResponse.status}`);
        }

        // Report progress as complete
        if (onProgress) {
            onProgress({ percent: 100, loaded: blob.size, total: blob.size });
        }

        console.log(`[MinIO] Evidence uploaded: ${presigned.publicUrl}`);

        // NOTE: Do NOT send incident here - the caller (MockExamPage, etc.) is responsible
        // for creating the incident with the returned evidenceUrl.
        // Previously this caused duplicate incidents.

        return {
            url: presigned.publicUrl,
            objectKey: presigned.objectKey
        };
    } catch (error) {
        console.error('[MinIO] Evidence upload error:', error);
        throw error;
    }
}

// ========== LiveKit Egress Integration ==========

export interface EgressRecordingOptions {
    sessionId: string;
    roomName: string;
    violationType: string;
    trackId?: string;  // Optional: record specific track
    durationSeconds?: number;  // Default: 10 seconds
}

export interface EgressRecordingResult {
    success: boolean;
    egressId?: string;
    durationSeconds?: number;
    error?: string;
}

// Track active egress recordings to prevent duplicates
const activeEgressRecordings = new Map<string, { egressId: string; startedAt: number }>();

/**
 * Trigger server-side video recording via LiveKit Egress
 * 
 * Use this instead of local MediaRecorder for:
 * - Higher quality video (server-side encoding)
 * - Reliable recording (no client-side issues)
 * - Automatic upload to MinIO
 * - Automatic Python AI analysis queue
 * 
 * @param options Recording options
 * @returns Egress recording result
 */
export async function triggerEgressRecording(
    options: EgressRecordingOptions
): Promise<EgressRecordingResult> {
    const { sessionId, roomName, violationType, trackId, durationSeconds = 10 } = options;

    // Prevent duplicate recordings for same session/violation
    const recordingKey = `${sessionId}-${violationType}`;
    const existing = activeEgressRecordings.get(recordingKey);

    if (existing && Date.now() - existing.startedAt < (durationSeconds + 5) * 1000) {
        console.log(`[Egress] Recording already in progress for ${recordingKey}`);
        return {
            success: true,
            egressId: existing.egressId,
            durationSeconds
        };
    }

    try {
        console.log(`[Egress] Starting recording: room=${roomName}, violation=${violationType}, duration=${durationSeconds}s`);

        const response = await sessionsApi.startEgressRecording({
            sessionId,
            roomName,
            trackId,
            violationType,
            durationSeconds
        });

        // Track active recording
        activeEgressRecordings.set(recordingKey, {
            egressId: response.egressId,
            startedAt: Date.now()
        });

        // Clean up after recording duration + buffer
        setTimeout(() => {
            activeEgressRecordings.delete(recordingKey);
        }, (durationSeconds + 10) * 1000);

        console.log(`[Egress] Recording started: egressId=${response.egressId}`);

        // REMOVED: Do not send separate incident event for Egress start.
        // The main violation incident is reported by the caller (MockExamPage/useOptimizedDetection).
        // Sending it here creates a duplicate "phantom" incident without a snapshot.
        console.log(`[Egress] Recording started: egressId=${response.egressId}`);

        return {
            success: true,
            egressId: response.egressId,
            durationSeconds: response.durationSeconds
        };
    } catch (error) {
        console.error('[Egress] Failed to start recording:', error);

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to start egress recording'
        };
    }
}

/**
 * Check if egress recording is available for a session
 */
export function isEgressRecordingActive(sessionId: string, violationType: string): boolean {
    const recordingKey = `${sessionId}-${violationType}`;
    return activeEgressRecordings.has(recordingKey);
}

/**
 * Hybrid evidence collection: Snapshot (client) + Video clip (Egress)
 * 
 * This is the recommended approach:
 * - Snapshots are uploaded directly from client (fast, low bandwidth)
 * - Video clips are recorded server-side via LiveKit Egress (high quality, reliable)
 * 
 * @param sessionId Session ID
 * @param roomName LiveKit room name
 * @param violationType Type of violation detected
 * @param snapshotCanvas Canvas element for snapshot capture
 */
export async function collectHybridEvidence(
    sessionId: string,
    roomName: string,
    violationType: IncidentType,
    snapshotCanvas: HTMLCanvasElement
): Promise<{ snapshot: UploadResult; egress: EgressRecordingResult }> {
    // Capture snapshot from client
    const snapshotBlob = await captureCanvasAsBlob(snapshotCanvas, 0.85);

    // Upload snapshot and trigger egress recording in parallel
    const [snapshotResult, egressResult] = await Promise.all([
        uploadSnapshot(sessionId, snapshotBlob, violationType),
        triggerEgressRecording({
            sessionId,
            roomName,
            violationType,
            durationSeconds: 10
        })
    ]);

    console.log(`[Evidence] Hybrid collection complete:`, {
        snapshot: snapshotResult.success ? snapshotResult.url : snapshotResult.error,
        egress: egressResult.success ? egressResult.egressId : egressResult.error
    });

    return {
        snapshot: snapshotResult,
        egress: egressResult
    };
}
