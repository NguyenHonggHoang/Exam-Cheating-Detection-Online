import { useState, useEffect, useCallback } from 'react';
import {
    LiveKitRoom,
    VideoTrack,
    useRemoteParticipants,
    useTracks
} from '@livekit/components-react';
import type { TrackReferenceOrPlaceholder } from '@livekit/components-react';
import { Track, ConnectionState } from 'livekit-client';
import { sessionsApi, type Session } from '@/api/sessions';
import { Card, CardContent } from '@/ui/card';
import { Button } from '@/ui/button';
import {
    Video, VideoOff, Maximize2, Minimize2,
    AlertTriangle, Wifi, WifiOff, User,
    Volume2, VolumeX, Grid, LayoutGrid
} from 'lucide-react';

interface LiveCameraGridProps {
    examId: string;
    sessions: Session[];
    onSelectSession?: (sessionId: string) => void;
}

interface StudentCameraProps {
    session: Session;
    isSelected?: boolean;
    isExpanded?: boolean;
    onSelect?: () => void;
    onExpand?: () => void;
}

/**
 * LiveCameraGrid - Display grid of student cameras for proctors
 * 
 * Shows all active sessions with their video streams
 */
export function LiveCameraGrid({ examId, sessions, onSelectSession }: LiveCameraGridProps) {
    const [expandedSession, setExpandedSession] = useState<string | null>(null);
    const [gridSize, setGridSize] = useState<2 | 3 | 4>(3); // columns

    const activeSessions = sessions.filter(s => s.status === 'ACTIVE');

    if (activeSessions.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Video className="w-12 h-12 mb-4 opacity-50" />
                <p>No active sessions</p>
                <p className="text-sm">Students will appear here when they start the exam</p>
            </div>
        );
    }

    // Expanded view - single camera
    if (expandedSession) {
        const session = sessions.find(s => s.id === expandedSession);
        if (!session) return null;

        return (
            <div className="relative">
                <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-4 right-4 z-10"
                    onClick={() => setExpandedSession(null)}
                >
                    <Minimize2 className="w-4 h-4 mr-2" />
                    Back to Grid
                </Button>
                <StudentCamera
                    session={session}
                    isExpanded={true}
                    onSelect={() => onSelectSession?.(session.id)}
                />
            </div>
        );
    }

    // Grid view
    return (
        <div>
            {/* Grid controls */}
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-gray-600">
                    {activeSessions.length} active student{activeSessions.length !== 1 ? 's' : ''}
                </p>
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-500">Grid:</span>
                    {[2, 3, 4].map(size => (
                        <Button
                            key={size}
                            variant={gridSize === size ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setGridSize(size as 2 | 3 | 4)}
                        >
                            {size}x{size}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Camera grid */}
            <div
                className="grid gap-4"
                style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
            >
                {activeSessions.map(session => (
                    <StudentCamera
                        key={session.id}
                        session={session}
                        isSelected={false}
                        onSelect={() => onSelectSession?.(session.id)}
                        onExpand={() => setExpandedSession(session.id)}
                    />
                ))}
            </div>
        </div>
    );
}

/**
 * StudentCamera - Individual student camera view with LiveKit connection
 */
function StudentCamera({ session, isSelected, isExpanded, onSelect, onExpand }: StudentCameraProps) {
    const [token, setToken] = useState<string | null>(null);
    const [wsUrl, setWsUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);

    // Room name follows convention: sessionId (UUID)
    const roomName = session.id;

    // Fetch proctor token
    useEffect(() => {
        let cancelled = false;

        const fetchToken = async () => {
            try {
                setLoading(true);
                setError(null);
                console.log(`[Proctor] Fetching token for room: ${roomName}`);
                const data = await sessionsApi.getProctorToken(roomName);

                if (!cancelled) {
                    setToken(data.token);
                    // Fix internal Docker URL to localhost
                    const url = (data.wsUrl || '')
                        .replace('ws://livekit:7880', 'ws://localhost:7880')
                        .replace('wss://livekit:7880', 'wss://localhost:7880')
                        .replace('ws://host.docker.internal:7880', 'ws://localhost:7880')
                        .replace('wss://host.docker.internal:7880', 'wss://localhost:7880');
                    console.log(`[Proctor] Token received, wsUrl: ${url}`);
                    setWsUrl(url);
                }
            } catch (err) {
                console.error('[Proctor] Failed to get token:', err);
                if (!cancelled) {
                    setError('Failed to connect');
                }
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchToken();

        return () => {
            cancelled = true;
        };
    }, [roomName]);

    // Handle room events
    const handleRoomConnected = useCallback(() => {
        console.log(`[Proctor] Connected to room: ${roomName}`);
        setConnectionState(ConnectionState.Connected);
    }, [roomName]);

    const handleRoomDisconnected = useCallback(() => {
        console.log(`[Proctor] Disconnected from room: ${roomName}`);
        setConnectionState(ConnectionState.Disconnected);
    }, [roomName]);

    if (loading) {
        return (
            <Card className={`overflow-hidden ${isExpanded ? 'h-[600px]' : 'aspect-video'}`}>
                <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
                    <div className="text-center">
                        <div className="animate-spin w-8 h-8 border-2 border-white border-t-transparent rounded-full mx-auto mb-2" />
                        <p className="text-sm">Connecting...</p>
                    </div>
                </div>
            </Card>
        );
    }

    if (error || !token || !wsUrl) {
        return (
            <Card className={`overflow-hidden ${isExpanded ? 'h-[600px]' : 'aspect-video'}`}>
                <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
                    <div className="text-center">
                        <VideoOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">{error || 'No stream'}</p>
                        <p className="text-xs text-gray-400 mt-1">{session.id.substring(0, 8)}</p>
                    </div>
                </div>
            </Card>
        );
    }

    return (
        <div
            className={`overflow-hidden relative group cursor-pointer rounded-lg border bg-card ${isSelected ? 'ring-2 ring-blue-500' : ''
                } ${isExpanded ? 'h-[600px]' : 'aspect-video'}`}
            onClick={onSelect}
        >
            <LiveKitRoom
                serverUrl={wsUrl}
                token={token}
                connect={true}
                audio={false}
                video={false}
                onConnected={handleRoomConnected}
                onDisconnected={handleRoomDisconnected}
            >
                <RoomContent
                    session={session}
                    isExpanded={isExpanded}
                    connectionState={connectionState}
                />
            </LiveKitRoom>

            {/* Overlay controls */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors">
                {/* Top info bar */}
                <div className="absolute top-0 left-0 right-0 p-2 bg-gradient-to-b from-black/70 to-transparent">
                    <div className="flex items-center justify-between text-white text-xs">
                        <div className="flex items-center gap-2">
                            <User className="w-3 h-3" />
                            <span>{session.userId.substring(0, 8)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            {connectionState === ConnectionState.Connected ? (
                                <Wifi className="w-3 h-3 text-green-400" />
                            ) : (
                                <WifiOff className="w-3 h-3 text-red-400" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Expand button (shown on hover) */}
                {!isExpanded && onExpand && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onExpand();
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-black/50 rounded opacity-0 group-hover:opacity-100 transition-opacity text-white hover:bg-black/70"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
}

/**
 * RoomContent - Renders video tracks from remote participants
 */
function RoomContent({
    session,
    isExpanded,
    connectionState
}: {
    session: Session;
    isExpanded?: boolean;
    connectionState: ConnectionState;
}) {
    const participants = useRemoteParticipants();
    // Get ALL track sources, not just Camera
    const tracks = useTracks([
        Track.Source.Camera,
        Track.Source.Microphone,
        Track.Source.ScreenShare,
        Track.Source.Unknown
    ]);

    // Debug logging
    useEffect(() => {
        console.log(`[RoomContent] sessionId=${session.id.substring(0, 8)}, connectionState=${connectionState}`);
        console.log(`[RoomContent] Remote participants:`, participants.length);

        // Log each participant's published tracks
        participants.forEach(p => {
            console.log(`[RoomContent] Participant ${p.identity}:`, {
                videoTracks: Array.from(p.videoTrackPublications.values()).map(t => ({ sid: t.trackSid, source: t.source })),
                audioTracks: Array.from(p.audioTrackPublications.values()).map(t => ({ sid: t.trackSid, source: t.source }))
            });
        });

        console.log(`[RoomContent] All tracks from useTracks:`, tracks.length, tracks.map(t => ({
            source: t.source,
            participant: t.participant?.identity,
            isSubscribed: 'publication' in t && t.publication?.isSubscribed
        })));
    }, [session.id, connectionState, participants, tracks]);

    // Find the student's video track
    // Priority: 1. Match by participant identity, 2. Camera source, 3. Any video track
    const videoTrack = (() => {
        // First, try to find track by matching participant identity
        const matchedTrack = tracks.find(
            (track: TrackReferenceOrPlaceholder) =>
                track.participant.identity.includes(session.userId.substring(0, 8)) &&
                (track.source === Track.Source.Camera || track.source === Track.Source.Unknown)
        );
        if (matchedTrack) return matchedTrack;

        // Fallback: Find any camera track
        const cameraTrack = tracks.find(
            (track: TrackReferenceOrPlaceholder) => track.source === Track.Source.Camera
        );
        if (cameraTrack) return cameraTrack;

        // Fallback: Find any video track (Unknown source)
        const anyVideoTrack = tracks.find(
            (track: TrackReferenceOrPlaceholder) =>
                track.source === Track.Source.Unknown ||
                track.source === Track.Source.Camera ||
                track.source === Track.Source.ScreenShare
        );
        return anyVideoTrack;
    })();

    // Debug selected track
    useEffect(() => {
        if (videoTrack) {
            console.log(`[RoomContent] ✅ Selected videoTrack:`, {
                source: videoTrack.source,
                participant: videoTrack.participant?.identity,
                hasTrack: 'track' in videoTrack && !!videoTrack.track,
                isSubscribed: 'publication' in videoTrack && videoTrack.publication?.isSubscribed,
                trackEnabled: 'track' in videoTrack && videoTrack.track?.isEnabled
            });
        } else {
            console.log(`[RoomContent] ⚠️ No videoTrack found. Available tracks:`, tracks.map(t => ({
                source: t.source,
                participant: t.participant?.identity
            })));
        }
    }, [videoTrack, tracks]);

    if (connectionState !== ConnectionState.Connected) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                    <div className="animate-pulse">
                        <Video className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    </div>
                    <p className="text-sm">Connecting to room...</p>
                </div>
            </div>
        );
    }

    if (!videoTrack) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                    <VideoOff className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Waiting for video...</p>
                    <p className="text-xs text-gray-400 mt-1">
                        {participants.length} participant{participants.length !== 1 ? 's' : ''} in room
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-gray-900">
            <VideoTrack
                trackRef={videoTrack}
                className="w-full h-full object-contain"
            />
        </div>
    );
}

export default LiveCameraGrid;
