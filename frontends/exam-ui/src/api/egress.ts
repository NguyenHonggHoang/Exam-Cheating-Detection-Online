/**
 * Egress API Client
 * 
 * Interfaces with session-service to trigger LiveKit Egress
 * for server-side video recording of violations
 */

export interface StartRecordingParams {
    sessionId: string;
    roomName: string;
    violationType: string;
    trackId?: string;
    durationSeconds?: number;
}

export interface StartRecordingResponse {
    status: 'recording' | 'error';
    egressId?: string;
    message?: string;
    durationSeconds?: number;
}

/**
 * Start server-side video recording via LiveKit Egress
 * 
 * Called when violation is detected to record evidence
 * instead of using client-side CircularVideoBuffer
 * 
 * @param params Recording parameters
 * @returns Recording response with egressId
 */
export async function startEgressRecording(params: StartRecordingParams): Promise<StartRecordingResponse> {
    try {
        console.log(`[Egress] Starting recording: session=${params.sessionId}, violation=${params.violationType}`);

        const response = await fetch('/api/proxy/egress/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                sessionId: params.sessionId,
                roomName: params.roomName,
                violationType: params.violationType,
                trackId: params.trackId,
                durationSeconds: params.durationSeconds || 10
            })
        });

        const data = await response.json();

        if (response.ok) {
            console.log(`[Egress] ✅ Recording started: egressId=${data.egressId}`);
            return data;
        } else {
            console.error(`[Egress] ❌ Failed to start: ${data.message}`);
            return { status: 'error', message: data.message };
        }
    } catch (error) {
        console.error('[Egress] Request failed:', error);
        return {
            status: 'error',
            message: error instanceof Error ? error.message : 'Request failed'
        };
    }
}

/**
 * Stop an active recording
 */
export async function stopEgressRecording(egressId: string): Promise<{ status: string }> {
    try {
        const response = await fetch(`/api/proxy/egress/stop/${egressId}`, {
            method: 'POST',
            credentials: 'include'
        });
        return response.json();
    } catch (error) {
        console.error('[Egress] Stop failed:', error);
        return { status: 'error' };
    }
}

/**
 * List active recordings
 */
export async function listActiveRecordings(): Promise<{ count: number; recordings: string[] }> {
    try {
        const response = await fetch('/api/proxy/egress/active', {
            credentials: 'include'
        });
        return response.json();
    } catch (error) {
        console.error('[Egress] List failed:', error);
        return { count: 0, recordings: [] };
    }
}
