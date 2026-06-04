import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { sessionsApi, type Session } from '@/api/sessions';
import { incidentsApi, type Incident, type IncidentSummary, type Review } from '@/api/incidents';
import { useIncidentNotifications, type IncidentNotification, useSessionNotifications, type SessionNotification } from '@/lib/hooks/useWebSocket';
import { useAuth } from '@/auth/AuthContext';
import { LiveCameraGrid } from '@/components/LiveCameraGrid';
import { VerificationEscalationPanel } from '@/components/VerificationEscalationPanel';
import { EvidenceViewer } from '@/components/EvidenceViewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Button } from '@/ui/button';
import { Alert, AlertDescription } from '@/ui/alert';
import {
    Users, AlertTriangle, CheckCircle, XCircle, Clock, Eye,
    ArrowUpCircle, Filter, RefreshCw, ChevronDown, ChevronUp,
    Video, MonitorPlay, List, UserCheck, Volume2, VolumeX, Bell, Play
} from 'lucide-react';

/**
 * Proctor Dashboard - New Page
 * 
 * View all sessions and incidents for an exam
 * Uses new Incident Service endpoints
 */
export const ProctorDashboard = () => {
    const { examId } = useParams<{ examId: string }>();
    const { user } = useAuth();

    // State
    const [sessions, setSessions] = useState<Session[]>([]);
    const [incidents, setIncidents] = useState<Incident[]>([]);
    const [summary, setSummary] = useState<IncidentSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
    const [reviews, setReviews] = useState<Review[]>([]);
    const [starting, setStarting] = useState(false);
    const [examStarted, setExamStarted] = useState(false);

    // Filters & Pagination
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [severityFilter, setSeverityFilter] = useState<string>('');
    const [selectedSessionFilter, setSelectedSessionFilter] = useState<string>('');
    const [page, setPage] = useState<number>(0);
    const [hasMore, setHasMore] = useState<boolean>(true);
    const [expandedSession, setExpandedSession] = useState<string | null>(null);

    // View mode: 'cameras' | 'incidents' | 'verifications'
    const [viewMode, setViewMode] = useState<'cameras' | 'incidents' | 'verifications'>('cameras');

    // Audio alert settings
    const [audioEnabled, setAudioEnabled] = useState(true);
    const [realtimeAlert, setRealtimeAlert] = useState<IncidentNotification | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    // Initialize audio element
    useEffect(() => {
        audioRef.current = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Nno+Ff3R3e4SQnJyVioB4dHZ8hpGalI2EfHd2eYCKk5aMhH13dHZ8g42UkYuCeXV0d36HkZOPiIB4dHV5gImRkYyFfXh2d3uEjJGOiYJ7dnV4fYaOkYyHgHl2dXl/iJCQi4Z/eHZ3eoKKkI6JhH54dnh7g4uQjYiDfHh3eXyFjI+Mh4J8eHd5fYaMj4uGgXt4d3l+h42Oi4WAfHh4en+IjY2KhYB7eHh6gImNjImEf3t4eXuBio2Lh4N+e3l5e4KLjIqGgn17eXp8hIuLiYWBfXp5e36Fi4qIhIF9enl7foaLioeDgH16eXt/h4qJhoOAfXp5fICIioiGg4B9e3p8gYmJh4WCgH17enyBiYmHhYKAf3t7fYKJiIaEgoB+e3x9g4mIhoSDgH98fH6EiIeGhIOBf3x8foSIh4WEg4GAfH1+hYiGhYSDgYB9fX+FiIaFhIOBgH5+f4WIhoWEg4KBf35/hoeGhYSDgoF/foGHhoWFhISCgYB/gYaGhYWEhIKBgICBhoWFhYSEgoGAgIGGhYWFhISCgYGBgYaFhYWEhIOCgYGBhoWFhYSEg4KBgYGGhYaFhISEgoKBgYaFhYWFhISCgoGCho');
    }, []);

    // Play alert sound for HIGH severity
    const playAlertSound = useCallback(() => {
        if (audioEnabled && audioRef.current) {
            audioRef.current.currentTime = 0;
            audioRef.current.play().catch(console.error);
        }
    }, [audioEnabled]);

    // WebSocket for real-time incident notifications
    const { isConnected: wsConnected, latestIncident } = useIncidentNotifications(examId, {
        onNewIncident: (incident) => {
            console.log('[WS] New incident:', incident);
            // Add to incidents list immediately
            setIncidents(prev => {
                // Check if already exists
                if (prev.some(i => i.id === incident.incidentId)) {
                    return prev;
                }
                // Add as partial incident (will be fully loaded on next refresh)
                const newIncident: Incident = {
                    id: incident.incidentId,
                    sessionId: incident.sessionId,
                    type: incident.type as any,
                    severity: incident.severity,
                    status: 'PENDING',
                    evidenceUrl: null,
                    detectedBy: 'FRONTEND_AI',
                    detectedAt: incident.detectedAt,
                };
                return [newIncident, ...prev];
            });
            // Update summary
            setSummary(prev => prev ? {
                ...prev,
                totalIncidents: prev.totalIncidents + 1,
                pendingIncidents: prev.pendingIncidents + 1,
                [`${incident.severity.toLowerCase()}SeverityCount`]: (prev as any)[`${incident.severity.toLowerCase()}SeverityCount`] + 1,
            } : prev);
        },
        onHighSeverity: (incident) => {
            console.log('[WS] HIGH severity incident!', incident);
            setRealtimeAlert(incident);
            playAlertSound();
            // Clear alert after 10 seconds
            setTimeout(() => setRealtimeAlert(null), 10000);
        }
    });

    // WebSocket for real-time session updates
    useSessionNotifications(examId, {
        onSessionStarted: (notification: SessionNotification) => {
            console.log('[WS] New session started:', notification);
            setSessions(prev => {
                if (prev.some(s => s.id === notification.sessionId)) return prev;
                const newSession: Session = {
                    id: notification.sessionId,
                    examId: notification.examId,
                    userId: notification.userId,
                    status: (notification.status || 'ACTIVE') as any,
                    startedAt: notification.timestamp,
                    endedAt: null,
                    createdAt: notification.timestamp,
                };
                return [newSession, ...prev];
            });
        },
        onSessionEnded: (notification: SessionNotification) => {
            setSessions(prev => prev.map(s =>
                s.id === notification.sessionId
                    ? { ...s, status: 'ENDED' as any, endedAt: notification.timestamp }
                    : s
            ));
        },
        onStatusChanged: (notification: SessionNotification) => {
            setSessions(prev => prev.map(s =>
                s.id === notification.sessionId
                    ? { ...s, status: (notification.newStatus || s.status) as any }
                    : s
            ));
        }
    });

    // Load data
    const loadData = useCallback(async (targetPage = 0, isLoadMore = false) => {
        if (!examId) return;

        setLoading(true);
        setError(null);

        try {
            // Load sessions for exam (ACTIVE only first, then fallback)
            let sessionsData = await sessionsApi.getByExam(examId);

            // If no sessions, try loading queue members (waiting students)
            if (sessionsData.length === 0) {
                try {
                    const queueResponse = await fetch(`/api/proxy/exams/${examId}/queue/members`, {
                        credentials: 'include',
                    });
                    if (queueResponse.ok) {
                        const data = await queueResponse.json();
                        // Map queue members to session-like objects
                        const memberSessions: Session[] = (data.members || []).map((member: any) => ({
                            id: member.id || member.userId,
                            examId: examId,
                            userId: member.userId,
                            status: 'WAITING' as any,
                            startedAt: member.joinedAt,
                            endedAt: null,
                            createdAt: member.joinedAt
                        }));
                        sessionsData = memberSessions;
                    }
                } catch (e) {
                    console.warn('Failed to load queue members:', e);
                }
            }

            setSessions(sessionsData);

            // Load incident summary
            const summaryData = await incidentsApi.getSummary({ examId });
            setSummary(summaryData);

            // Load incidents with filters & pagination
            const size = 50;
            const incidentsData = await incidentsApi.list({
                examId,
                sessionId: selectedSessionFilter || undefined,
                status: statusFilter as any || undefined,
                severity: severityFilter as any || undefined,
                page: targetPage,
                size: size
            });

            if (isLoadMore) {
                setIncidents(prev => {
                    const combined = [...prev, ...incidentsData.content];
                    // De-duplicate
                    const unique = combined.filter((item, index, self) =>
                        index === self.findIndex((t) => t.id === item.id)
                    );
                    return unique;
                });
            } else {
                setIncidents(incidentsData.content);
            }

            setHasMore(incidentsData.content.length === size);

        } catch (err) {
            console.error('Error loading dashboard:', err);
            setError('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    }, [examId, statusFilter, severityFilter, selectedSessionFilter]);

    // Handle filter changes and page resets
    useEffect(() => {
        setPage(0);
        loadData(0, false);
    }, [statusFilter, severityFilter, selectedSessionFilter, loadData]);

    // Auto-refresh interval (only fetches first page silently)
    useEffect(() => {
        const interval = setInterval(() => {
            loadData(0, false);
            setPage(0);
        }, 30000);
        return () => clearInterval(interval);
    }, [loadData]);

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        loadData(nextPage, true);
    };

    // Load reviews for selected incident
    useEffect(() => {
        if (!selectedIncident) {
            setReviews([]);
            return;
        }

        incidentsApi.getReviews(selectedIncident)
            .then(setReviews)
            .catch(console.error);
    }, [selectedIncident]);

    // Handle review action
    const handleReview = async (incidentId: string, decision: 'VALID' | 'FALSE_POSITIVE') => {
        try {
            await incidentsApi.createReview(incidentId, {
                reviewedBy: user?.id || user?.email || 'unknown_proctor',
                decision,
                notes: `Marked as ${decision.toLowerCase().replace('_', ' ')} by ${user?.email || 'proctor'}`
            });

            // Reload data
            await loadData();
            setSelectedIncident(null);
        } catch (err) {
            console.error('Failed to create review:', err);
        }
    };

    // Get session incident count
    const getSessionIncidentCount = (sessionId: string) => {
        return incidents.filter(i => i.sessionId === sessionId).length;
    };

    // Handle start exam
    const handleStartExam = async () => {
        if (!examId) return;
        setStarting(true);
        try {
            await fetch(`/api/proxy/exams/${examId}/start`, {
                method: 'POST',
                credentials: 'include',
            });
            setExamStarted(true);
            // Reload to get active sessions
            setTimeout(loadData, 1000);
        } catch (err) {
            console.error('Failed to start exam:', err);
            setError('Failed to start exam');
        } finally {
            setStarting(false);
        }
    };

    if (loading && sessions.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Loading dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-100">
            {/* Header */}
            <div className="bg-white border-b">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold">📹 Proctor Dashboard</h1>
                            <p className="text-gray-600">Exam: {examId}</p>
                        </div>
                        <div className="flex items-center gap-4">
                            {/* View Mode Toggle */}
                            <div className="flex items-center bg-gray-200 rounded-lg p-1 gap-1">
                                <button
                                    type="button"
                                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${viewMode === 'cameras'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    onClick={() => setViewMode('cameras')}
                                >
                                    <Video className="w-4 h-4 mr-2" />
                                    Live Cameras
                                </button>
                                <button
                                    type="button"
                                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${viewMode === 'incidents'
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    onClick={() => setViewMode('incidents')}
                                >
                                    <List className="w-4 h-4 mr-2" />
                                    Incidents
                                </button>
                                <button
                                    type="button"
                                    className={`flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${viewMode === 'verifications'
                                        ? 'bg-white text-orange-600 shadow-sm'
                                        : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    onClick={() => setViewMode('verifications')}
                                >
                                    <UserCheck className="w-4 h-4 mr-2" />
                                    Xác Thực
                                </button>
                            </div>

                            <Button onClick={() => loadData(0, false)} variant="outline" disabled={loading}>
                                <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                                Refresh
                            </Button>

                            {/* Start Exam Button */}
                            {!examStarted && sessions.some(s => s.status === ('WAITING' as any)) && (
                                <Button
                                    onClick={handleStartExam}
                                    disabled={starting}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                    {starting ? (
                                        <>Starting...</>
                                    ) : (
                                        <><Play className="w-4 h-4 mr-2" /> Start Exam</>
                                    )}
                                </Button>
                            )}

                            {/* Audio Toggle */}
                            <Button
                                onClick={() => setAudioEnabled(!audioEnabled)}
                                variant="outline"
                                className={audioEnabled ? 'text-green-600' : 'text-gray-400'}
                                title={audioEnabled ? 'Audio alerts ON' : 'Audio alerts OFF'}
                            >
                                {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                            </Button>

                            {/* WebSocket Status */}
                            <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${wsConnected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                                {wsConnected ? 'Live' : 'Offline'}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Real-time Alert Banner */}
            {realtimeAlert && (
                <div className="bg-red-600 text-white">
                    <div className="container mx-auto px-4 py-3 flex items-center justify-between animate-pulse">
                        <div className="flex items-center gap-3">
                            <Bell className="w-6 h-6" />
                            <div>
                                <span className="font-bold">⚠️ HIGH SEVERITY VIOLATION!</span>
                                <span className="ml-2">{realtimeAlert.type}</span>
                                <span className="ml-2 text-red-200">Session: {realtimeAlert.sessionId.substring(0, 8)}...</span>
                            </div>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            className="text-white border-white hover:bg-red-700"
                            onClick={() => {
                                setSelectedIncident(realtimeAlert.incidentId);
                                setViewMode('incidents');
                                setRealtimeAlert(null);
                            }}
                        >
                            View Details
                        </Button>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            {summary && (
                <div className="container mx-auto px-4 py-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-2">
                                    <Users className="w-5 h-5 text-blue-600" />
                                    <div>
                                        <p className="text-2xl font-bold">{sessions.length}</p>
                                        <p className="text-sm text-gray-500">Sessions</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                                    <div>
                                        <p className="text-2xl font-bold">{summary.totalIncidents}</p>
                                        <p className="text-sm text-gray-500">Total Incidents</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-5 h-5 text-orange-600" />
                                    <div>
                                        <p className="text-2xl font-bold">{summary.pendingIncidents}</p>
                                        <p className="text-sm text-gray-500">Pending</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="pt-4">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    <div>
                                        <p className="text-2xl font-bold">{summary.reviewedIncidents}</p>
                                        <p className="text-sm text-gray-500">Reviewed</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-green-50">
                            <CardContent className="pt-4">
                                <p className="text-2xl font-bold text-green-700">{summary.lowSeverityCount}</p>
                                <p className="text-sm text-green-600">Low Severity</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-yellow-50">
                            <CardContent className="pt-4">
                                <p className="text-2xl font-bold text-yellow-700">{summary.mediumSeverityCount}</p>
                                <p className="text-sm text-yellow-600">Medium</p>
                            </CardContent>
                        </Card>

                        <Card className="bg-red-50">
                            <CardContent className="pt-4">
                                <p className="text-2xl font-bold text-red-700">{summary.highSeverityCount}</p>
                                <p className="text-sm text-red-600">High Severity</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="container mx-auto px-4 pb-4">
                <Card>
                    <CardContent className="pt-4">
                        <div className="flex items-center gap-4 flex-wrap">
                            <Filter className="w-5 h-5 text-gray-400" />

                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="border rounded px-3 py-2"
                            >
                                <option value="">All Statuses</option>
                                <option value="PENDING">Pending</option>
                                <option value="UNDER_REVIEW">Under Review</option>
                                <option value="REVIEWED">Reviewed</option>
                                <option value="DISMISSED">Dismissed</option>
                                <option value="ESCALATED">Escalated</option>
                            </select>

                            <select
                                value={severityFilter}
                                onChange={(e) => setSeverityFilter(e.target.value)}
                                className="border rounded px-3 py-2"
                            >
                                <option value="">All Severities</option>
                                <option value="LOW">Low</option>
                                <option value="MEDIUM">Medium</option>
                                <option value="HIGH">High</option>
                            </select>

                            <select
                                value={selectedSessionFilter}
                                onChange={(e) => setSelectedSessionFilter(e.target.value)}
                                className="border rounded px-3 py-2 max-w-xs"
                            >
                                <option value="">All Students / Sessions</option>
                                {sessions.map(s => (
                                    <option key={s.id} value={s.id}>
                                        Student: {s.userId.substring(0, 8)}... (Session: {s.id.substring(0, 8)}...)
                                    </option>
                                ))}
                            </select>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {error && (
                <div className="container mx-auto px-4 pb-4">
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                </div>
            )}

            {/* Main Content */}
            <div className="container mx-auto px-4 pb-8">
                {viewMode === 'cameras' && (
                    /* Live Camera Grid View */
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MonitorPlay className="w-5 h-5" />
                                Live Student Cameras
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <LiveCameraGrid
                                examId={examId || ''}
                                sessions={sessions}
                                onSelectSession={(sessionId) => {
                                    setExpandedSession(sessionId);
                                    // Switch to incidents to see details
                                    setViewMode('incidents');
                                }}
                            />
                        </CardContent>
                    </Card>
                )}

                {viewMode === 'verifications' && (
                    /* Verification Escalation View */
                    <VerificationEscalationPanel
                        onEscalationReviewed={(id, approved) => {
                            console.log(`Escalation ${id} ${approved ? 'approved' : 'rejected'}`);
                        }}
                    />
                )}

                {viewMode === 'incidents' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Sessions List */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Active Sessions ({sessions.filter(s => s.status === 'ACTIVE').length})</CardTitle>
                            </CardHeader>
                            <CardContent className="max-h-[600px] overflow-y-auto">
                                {sessions.length === 0 ? (
                                    <p className="text-gray-500 text-center py-8">No sessions found</p>
                                ) : (
                                    <div className="space-y-2">
                                        {sessions.map(session => {
                                            const incidentCount = getSessionIncidentCount(session.id);
                                            const isExpanded = expandedSession === session.id;

                                            return (
                                                <div key={session.id} className="border rounded-lg">
                                                    <button
                                                        onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                                                        className="w-full p-4 flex items-center justify-between hover:bg-gray-50"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className={`w-3 h-3 rounded-full ${session.status === 'ACTIVE' ? 'bg-green-500' : 'bg-gray-400'
                                                                }`} />
                                                            <div className="text-left">
                                                                <p className="font-medium">Session {session.id.substring(0, 8)}</p>
                                                                <p className="text-sm text-gray-500">User: {session.userId}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {incidentCount > 0 && (
                                                                <span className={`px-2 py-1 rounded text-xs font-medium ${incidentCount > 3 ? 'bg-red-100 text-red-800' :
                                                                    incidentCount > 0 ? 'bg-yellow-100 text-yellow-800' : ''
                                                                    }`}>
                                                                    {incidentCount} incidents
                                                                </span>
                                                            )}
                                                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                        </div>
                                                    </button>

                                                    {isExpanded && (
                                                        <div className="px-4 pb-4 space-y-2">
                                                            <div className="text-sm text-gray-600">
                                                                <p>Started: {new Date(session.startedAt).toLocaleString()}</p>
                                                                <p>Status: {session.status}</p>
                                                            </div>

                                                            {/* Session incidents */}
                                                            {incidents.filter(i => i.sessionId === session.id).map(incident => (
                                                                <div
                                                                    key={incident.id}
                                                                    onClick={() => setSelectedIncident(incident.id)}
                                                                    className={`p-2 border rounded cursor-pointer hover:bg-gray-50 ${selectedIncident === incident.id ? 'ring-2 ring-blue-500' : ''
                                                                        }`}
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="font-medium text-sm">{incident.type}</span>
                                                                        <span className={`text-xs px-2 py-0.5 rounded ${incident.severity === 'HIGH' ? 'bg-red-100 text-red-800' :
                                                                            incident.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                                                                                'bg-green-100 text-green-800'
                                                                            }`}>
                                                                            {incident.severity}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {hasMore && incidents.length > 0 && (
                                    <div className="mt-4 flex justify-center">
                                        <Button
                                            onClick={handleLoadMore}
                                            variant="outline"
                                            size="sm"
                                            disabled={loading}
                                            className="w-full"
                                        >
                                            {loading ? 'Loading...' : 'Load More Incidents'}
                                        </Button>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Incident Details */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Incident Details</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {!selectedIncident ? (
                                    <p className="text-gray-500 text-center py-8">
                                        Select an incident to view details
                                    </p>
                                ) : (
                                    <IncidentDetails
                                        incidentId={selectedIncident}
                                        reviews={reviews}
                                        onReview={handleReview}
                                        onClose={() => setSelectedIncident(null)}
                                    />
                                )}
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
};

// Incident Details Component
const IncidentDetails = ({
    incidentId,
    reviews,
    onReview,
    onClose
}: {
    incidentId: string;
    reviews: Review[];
    onReview: (id: string, decision: 'VALID' | 'FALSE_POSITIVE') => void;
    onClose: () => void;
}) => {
    const [incident, setIncident] = useState<Incident | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        incidentsApi.getById(incidentId)
            .then(setIncident)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, [incidentId]);

    if (loading || !incident) {
        return <div className="text-center py-4">Loading...</div>;
    }

    return (
        <div className="space-y-4">
            {/* Evidence (Image or Video) */}
            <EvidenceViewer url={incident.evidenceUrl} />

            {/* Incident Info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p className="text-gray-500">Type</p>
                    <p className="font-medium">{incident.type}</p>
                </div>
                <div>
                    <p className="text-gray-500">Severity</p>
                    <p className={`font-medium ${incident.severity === 'HIGH' ? 'text-red-600' :
                        incident.severity === 'MEDIUM' ? 'text-yellow-600' : 'text-green-600'
                        }`}>{incident.severity}</p>
                </div>
                <div>
                    <p className="text-gray-500">Status</p>
                    <p className="font-medium">{incident.status}</p>
                </div>
                <div>
                    <p className="text-gray-500">Detected At</p>
                    <p className="font-medium">{new Date(incident.detectedAt).toLocaleString()}</p>
                </div>
            </div>

            {/* Reviews */}
            {reviews.length > 0 && (
                <div className="border-t pt-4">
                    <p className="font-medium mb-2">Reviews</p>
                    {reviews.map(review => (
                        <div key={review.id} className="text-sm bg-gray-50 p-2 rounded">
                            <p><strong>{review.decision}</strong> by {review.reviewedBy}</p>
                            {review.notes && <p className="text-gray-600">{review.notes}</p>}
                        </div>
                    ))}
                </div>
            )}

            {/* Actions */}
            {incident.status === 'PENDING' && (
                <div className="flex gap-2 pt-4 border-t">
                    <Button
                        onClick={() => onReview(incident.id, 'VALID')}
                        className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        Confirm Violation
                    </Button>
                    <Button
                        onClick={() => onReview(incident.id, 'FALSE_POSITIVE')}
                        variant="outline"
                        className="flex-1"
                    >
                        <XCircle className="w-4 h-4 mr-2" />
                        Dismiss
                    </Button>
                </div>
            )}
        </div>
    );
};

export default ProctorDashboard;
