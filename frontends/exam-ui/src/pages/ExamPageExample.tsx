import { useSharedStream } from '@/lib/hooks/useSharedStream';
import { useLiveKitToken } from '@/lib/hooks/useLiveKitToken';
import { useOptimizedDetection } from '@/lib/hooks/useOptimizedDetection';
import { ExamRoom } from '@/components/ExamRoom';

interface ExamPageProps {
    sessionId: string;
    examId: string;
}

/**
 * Exam Page - Integration Example
 * 
 * Demonstrates proper usage of shared stream architecture:
 * 1. useSharedStream creates ONE stream with clones
 * 2. LiveKit uses livekit clone for WebRTC
 * 3. TensorFlow uses tensorflow clone for AI detection
 * 4. CircularBuffer uses recorder clone (via useOptimizedDetection)
 */
export function ExamPage({ sessionId, examId }: ExamPageProps) {
    // Step 1: Initialize shared stream (SINGLE getUserMedia call)
    const { streams, isReady: streamReady, error: streamError, retry } = useSharedStream({
        video: {
            width: { ideal: 640 },
            height: { ideal: 480 },
            facingMode: 'user',
            frameRate: { ideal: 30 }
        },
        audio: true,
        enabled: true
    });

    // Step 2: Fetch LiveKit token
    const { data: livekitData, loading: livekitLoading, error: livekitError } = useLiveKitToken(sessionId);

    // Step 3: Initialize TensorFlow detection with tensorflow clone
    const {
        displayCanvasRef,
        inferenceCanvasRef,
        detectionResult,
        uploading,
        bufferStatus,
        tfReady,
        error: detectionError
    } = useOptimizedDetection({
        sessionId,
        stream: streams.tensorflow,  // Use TensorFlow clone
        enabled: streamReady,
        config: {
            mode: 'balanced',  // Optimized for Hybrid AI
            enabledViolations: ['MULTIPLE_FACES', 'NO_FACE', 'LOOKING_AWAY', 'TAB_SWITCH']
        },
        onViolation: (type, severity) => {
            console.log(`Violation detected: ${type} (${severity})`);
        },
        onEvidenceUploaded: (type, url) => {
            console.log(`Evidence uploaded: ${type} → ${url}`);
        }
    });

    // Error handling
    if (streamError) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded">
                <h2 className="text-xl font-bold text-red-800 mb-2">Camera Access Error</h2>
                <p className="text-red-700 mb-4">{streamError.message}</p>
                <button
                    onClick={retry}
                    className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                    Retry
                </button>
            </div>
        );
    }

    if (livekitError) {
        return (
            <div className="p-6 bg-red-50 border border-red-200 rounded">
                <h2 className="text-xl font-bold text-red-800 mb-2">Connection Error</h2>
                <p className="text-red-700">{livekitError.message}</p>
            </div>
        );
    }

    // Loading state
    if (!streamReady || livekitLoading || !livekitData) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">
                        {!streamReady && 'Initializing camera...'}
                        {streamReady && livekitLoading && 'Connecting to media server...'}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="exam-page h-screen flex flex-col">
            {/* Header */}
            <header className="bg-gray-800 text-white p-4">
                <div className="flex justify-between items-center">
                    <div>
                        <h1 className="text-xl font-bold">Exam: {examId}</h1>
                        <p className="text-sm text-gray-300">Session: {sessionId}</p>
                    </div>
                    <div className="flex items-center gap-4">
                        {/* Detection status */}
                        <div className="flex items-center gap-2">
                            {tfReady ? (
                                <>
                                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                    <span className="text-sm">AI Monitoring</span>
                                </>
                            ) : (
                                <span className="text-sm text-gray-400">Loading AI...</span>
                            )}
                        </div>

                        {/* Upload status */}
                        {uploading && (
                            <div className="flex items-center gap-2">
                                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                <span className="text-sm">Uploading evidence...</span>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Main content */}
            <div className="flex-1 flex">
                {/* Exam content area */}
                <main className="flex-1 p-6 overflow-auto">
                    <h2 className="text-2xl font-bold mb-4">Exam Questions</h2>
                    {/* TODO: Render exam questions */}
                    <p className="text-gray-600">Exam content goes here...</p>
                </main>

                {/* Sidebar: Video monitoring */}
                <aside className="w-80 bg-gray-100 p-4 border-l">
                    <h3 className="font-bold mb-4">Video Monitoring</h3>

                    {/* Display canvas (user preview) */}
                    <div className="mb-4">
                        <div className="relative bg-black rounded overflow-hidden">
                            <canvas
                                ref={displayCanvasRef}
                                className="w-full h-auto"
                            />
                            <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
                                REC
                            </div>
                        </div>
                        <p className="text-xs text-gray-600 mt-1">Your camera (640x480)</p>
                    </div>

                    {/* Detection stats */}
                    {detectionResult && (
                        <div className="bg-white rounded p-3 mb-4 text-sm">
                            <h4 className="font-semibold mb-2">Detection Status</h4>
                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <span>Faces:</span>
                                    <span className={detectionResult.faceCount === 1 ? 'text-green-600' : 'text-red-600'}>
                                        {detectionResult.faceCount}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Confidence:</span>
                                    <span>{(detectionResult.confidence * 100).toFixed(0)}%</span>
                                </div>
                                {detectionResult.headPose && (
                                    <div className="text-xs text-gray-600 mt-2">
                                        Pitch: {detectionResult.headPose.pitch.toFixed(1)}° |
                                        Yaw: {detectionResult.headPose.yaw.toFixed(1)}°
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Buffer status */}
                    {bufferStatus && (
                        <div className="bg-white rounded p-3 text-sm">
                            <h4 className="font-semibold mb-2">Recording Buffer</h4>
                            <div className="space-y-1">
                                <div className="flex justify-between">
                                    <span>Status:</span>
                                    <span className={bufferStatus.isRecording ? 'text-green-600' : 'text-gray-400'}>
                                        {bufferStatus.isRecording ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Buffer:</span>
                                    <span>{bufferStatus.chunkCount} chunks</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Duration:</span>
                                    <span>{(bufferStatus.totalDurationMs / 1000).toFixed(1)}s</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Hidden inference canvas */}
                    <canvas
                        ref={inferenceCanvasRef}
                        width={320}
                        height={240}
                        style={{ display: 'none' }}
                    />
                </aside>
            </div>

            {/* LiveKit Room (WebRTC streaming) - Hidden from UI */}
            <div style={{ display: 'none' }}>
                <ExamRoom
                    sessionId={sessionId}
                    stream={streams.livekit}  // Use LiveKit clone
                    token={livekitData.token}
                    wsUrl={livekitData.wsUrl}
                    onRoomConnected={() => console.log('LiveKit room connected')}
                    onRoomDisconnected={() => console.log('LiveKit room disconnected')}
                />
            </div>
        </div>
    );
}
