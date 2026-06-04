import { useState, useEffect, useCallback, useRef } from 'react';
import { type Incident } from '@/api/incidents';


interface SSEState {
    incidents: Incident[];
    isConnected: boolean;
    error: string | null;
    connectionCount: number;
}

interface UseIncidentSSEOptions {
    examId?: string;
    enabled?: boolean;
    maxIncidents?: number;  // Maximum incidents to keep in memory
    onNewIncident?: (incident: Incident) => void;
}

export function useIncidentSSE(options: UseIncidentSSEOptions = {}) {
    const {
        examId,
        enabled = true,
        maxIncidents = 100,
        onNewIncident
    } = options;

    const [state, setState] = useState<SSEState>({
        incidents: [],
        isConnected: false,
        error: null,
        connectionCount: 0
    });

    const eventSourceRef = useRef<EventSource | null>(null);
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttempts = useRef(0);
    const maxReconnectAttempts = 5;

    // Use ref for callback to avoid re-creating EventSource on callback change
    const onNewIncidentRef = useRef(onNewIncident);
    onNewIncidentRef.current = onNewIncident;

    const connect = useCallback(() => {
        if (!enabled) return;

        // Prevent duplicate connections - close existing first
        if (eventSourceRef.current) {
            console.log('[SSE] Closing existing connection before reconnecting');
            eventSourceRef.current.close();
            eventSourceRef.current = null;
        }

        // Build URL based on whether we're filtering by exam
        const baseUrl = '/api/proxy/incidents/stream';
        const url = examId ? `${baseUrl}/exam/${examId}` : baseUrl;

        console.log(`[SSE] Connecting to ${url}...`);

        try {
            const es = new EventSource(url, { withCredentials: true });
            eventSourceRef.current = es;

            es.onopen = () => {
                console.log('[SSE] Connection established');
                reconnectAttempts.current = 0;
                setState(prev => ({
                    ...prev,
                    isConnected: true,
                    error: null
                }));
            };

            // Handle connected event
            es.addEventListener('connected', (e) => {
                console.log('[SSE] Received connected event:', e.data);
            });

            // Handle new incident event
            es.addEventListener('new-incident', (e) => {
                try {
                    const incident = JSON.parse(e.data) as Incident;
                    console.log('[SSE] New incident received:', incident.id, incident.type);

                    setState(prev => ({
                        ...prev,
                        incidents: [incident, ...prev.incidents].slice(0, maxIncidents),
                        connectionCount: prev.connectionCount + 1
                    }));

                    if (onNewIncidentRef.current) {
                        onNewIncidentRef.current(incident);
                    }
                } catch (parseError) {
                    console.error('[SSE] Failed to parse incident:', parseError);
                }
            });

            // Handle status update event
            es.addEventListener('status-update', (e) => {
                try {
                    const update = JSON.parse(e.data);
                    console.log('[SSE] Status update:', update.incidentId, '->', update.status);

                    setState(prev => ({
                        ...prev,
                        incidents: prev.incidents.map(inc =>
                            inc.id === update.incidentId
                                ? { ...inc, status: update.status }
                                : inc
                        )
                    }));
                } catch (parseError) {
                    console.error('[SSE] Failed to parse status update:', parseError);
                }
            });

            // Handle heartbeat (keep-alive)
            es.addEventListener('heartbeat', () => {
                // Silent heartbeat - just confirms connection is alive
            });

            es.onerror = (error) => {
                console.error('[SSE] Connection error:', error);
                es.close();
                eventSourceRef.current = null;

                setState(prev => ({
                    ...prev,
                    isConnected: false,
                    error: 'Connection lost'
                }));

                // Reconnect with exponential backoff
                if (reconnectAttempts.current < maxReconnectAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
                    console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1})`);

                    reconnectTimeoutRef.current = setTimeout(() => {
                        reconnectAttempts.current++;
                        connect();
                    }, delay);
                } else {
                    console.error('[SSE] Max reconnection attempts reached');
                    setState(prev => ({
                        ...prev,
                        error: 'Unable to connect after multiple attempts'
                    }));
                }
            };

        } catch (err) {
            console.error('[SSE] Failed to create EventSource:', err);
            setState(prev => ({
                ...prev,
                error: 'Failed to establish connection'
            }));
        }
    }, [enabled, examId, maxIncidents]); // Removed onNewIncident - now uses ref

    // Connect on mount
    useEffect(() => {
        if (enabled) {
            connect();
        }

        return () => {
            if (eventSourceRef.current) {
                eventSourceRef.current.close();
                eventSourceRef.current = null;
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
        };
    }, [connect, enabled]);

    // Manual reconnect function
    const reconnect = useCallback(() => {
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }
        reconnectAttempts.current = 0;
        connect();
    }, [connect]);

    // Clear incidents
    const clearIncidents = useCallback(() => {
        setState(prev => ({ ...prev, incidents: [] }));
    }, []);

    return {
        ...state,
        reconnect,
        clearIncidents
    };
}

export default useIncidentSSE;
