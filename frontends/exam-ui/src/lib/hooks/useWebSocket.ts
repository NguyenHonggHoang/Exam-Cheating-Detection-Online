/**
 * useWebSocket Hook
 * 
 * React hook for WebSocket connection with session-service.
 * Provides realtime notifications for proctors and students.
 * 
 * Note: Uses native WebSocket. For STOMP support, install @stomp/stompjs and sockjs-client.
 */

import { useState, useEffect, useCallback, useRef } from 'react';

// WebSocket endpoint - use relative path for Vite proxy
const WS_URL = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

export interface WebSocketMessage {
    type: string;
    [key: string]: unknown;
}

interface UseWebSocketOptions {
    enabled?: boolean;
    onMessage?: (topic: string, message: WebSocketMessage) => void;
    onError?: (error: Error) => void;
    onConnect?: () => void;
    onDisconnect?: () => void;
}

interface UseWebSocketReturn {
    isConnected: boolean;
    subscribe: (topic: string, callback: (message: WebSocketMessage) => void) => () => void;
    unsubscribe: (topic: string) => void;
    send: (destination: string, body: object) => void;
}

interface SubscriptionEntry {
    callback: (msg: WebSocketMessage) => void;
    unsubscribe: () => void;
}

export function useWebSocket(options: UseWebSocketOptions = {}): UseWebSocketReturn {
    const {
        enabled = true,
        onMessage,
        onError,
        onConnect,
        onDisconnect,
    } = options;

    const [isConnected, setIsConnected] = useState(false);
    const wsRef = useRef<WebSocket | null>(null);
    const subscriptionsRef = useRef<Map<string, SubscriptionEntry>>(new Map());
    const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Connect to WebSocket
    const connect = useCallback(() => {
        if (!enabled || wsRef.current?.readyState === WebSocket.OPEN) {
            return;
        }

        try {
            const ws = new WebSocket(WS_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[WS] Connected');
                setIsConnected(true);
                onConnect?.();

                // Send subscription messages if needed
                subscriptionsRef.current.forEach((_, topic) => {
                    ws.send(JSON.stringify({ type: 'SUBSCRIBE', topic }));
                });
            };

            ws.onmessage = (event: MessageEvent) => {
                try {
                    const data = JSON.parse(event.data as string) as { topic?: string } & WebSocketMessage;
                    const topic = data.topic || '';

                    // Call topic-specific callback
                    const sub = subscriptionsRef.current.get(topic);
                    if (sub) {
                        sub.callback(data);
                    }

                    // Call global callback
                    onMessage?.(topic, data);
                } catch (e) {
                    console.error('[WS] Failed to parse message', e);
                }
            };

            ws.onerror = (event: Event) => {
                console.error('[WS] Error:', event);
                onError?.(new Error('WebSocket error'));
            };

            ws.onclose = () => {
                console.log('[WS] Disconnected');
                setIsConnected(false);
                onDisconnect?.();
                wsRef.current = null;

                // Reconnect after 30 seconds (reduced frequency)
                if (enabled) {
                    reconnectTimeoutRef.current = setTimeout(connect, 30000);
                }
            };
        } catch (e) {
            console.error('[WS] Connection error:', e);
            onError?.(e instanceof Error ? e : new Error('Connection error'));
        }
    }, [enabled, onConnect, onDisconnect, onError, onMessage]);

    useEffect(() => {
        if (enabled) {
            connect();
        }

        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            wsRef.current?.close();
            wsRef.current = null;
            setIsConnected(false);
        };
    }, [enabled, connect]);

    // Subscribe to a topic
    const subscribe = useCallback((topic: string, callback: (message: WebSocketMessage) => void) => {
        const subEntry: SubscriptionEntry = { callback, unsubscribe: () => { } };
        subscriptionsRef.current.set(topic, subEntry);

        // If connected, send subscribe message
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'SUBSCRIBE', topic }));
        }

        subEntry.unsubscribe = () => {
            subscriptionsRef.current.delete(topic);
            if (wsRef.current?.readyState === WebSocket.OPEN) {
                wsRef.current.send(JSON.stringify({ type: 'UNSUBSCRIBE', topic }));
            }
        };

        return () => subEntry.unsubscribe();
    }, []);

    // Unsubscribe from a topic
    const unsubscribe = useCallback((topic: string) => {
        const sub = subscriptionsRef.current.get(topic);
        if (sub) {
            sub.unsubscribe();
        }
    }, []);

    // Send message to a destination
    const send = useCallback((destination: string, body: object) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ destination, ...body }));
        } else {
            console.warn('[WS] Cannot send - not connected');
        }
    }, []);

    return {
        isConnected,
        subscribe,
        unsubscribe,
        send,
    };
}

/**
 * Specialized hook for proctor escalation notifications
 */
export function useEscalationNotifications(
    onNewEscalation?: (data: { escalationId: string; sessionId: string; userId: string; reason: string }) => void
) {
    const [latestEscalation, setLatestEscalation] = useState<{
        escalationId: string;
        sessionId: string;
        userId: string;
        reason: string;
        timestamp: string;
    } | null>(null);

    const handleMessage = useCallback((topic: string, message: WebSocketMessage) => {
        if (message.type === 'NEW_ESCALATION') {
            const data = {
                escalationId: message.escalationId as string,
                sessionId: message.sessionId as string,
                userId: message.userId as string,
                reason: message.reason as string,
                timestamp: message.timestamp as string,
            };
            setLatestEscalation(data);
            onNewEscalation?.(data);
        }
    }, [onNewEscalation]);

    const { isConnected, subscribe } = useWebSocket({
        enabled: true,
        onMessage: handleMessage,
    });

    useEffect(() => {
        if (isConnected) {
            const unsub = subscribe('/topic/proctor/escalations', (msg) => {
                handleMessage('/topic/proctor/escalations', msg);
            });
            return unsub;
        }
    }, [isConnected, subscribe, handleMessage]);

    return {
        isConnected,
        latestEscalation,
    };
}

/**
 * Specialized hook for verification decision notifications (student side)
 */
export function useVerificationDecision(
    sessionId: string | undefined,
    onDecision?: (status: 'APPROVED' | 'REJECTED', note: string) => void
) {
    const [decision, setDecision] = useState<{
        status: 'APPROVED' | 'REJECTED';
        note: string;
    } | null>(null);

    const handleMessage = useCallback((topic: string, message: WebSocketMessage) => {
        if (message.type === 'ESCALATION_DECISION') {
            const status = message.status as 'APPROVED' | 'REJECTED';
            const note = (message.proctorNote as string) || '';
            setDecision({ status, note });
            onDecision?.(status, note);
        }
    }, [onDecision]);

    const { isConnected, subscribe } = useWebSocket({
        enabled: !!sessionId,
        onMessage: handleMessage,
    });

    useEffect(() => {
        if (isConnected && sessionId) {
            const unsub = subscribe(`/topic/session/${sessionId}/verification`, (msg) => {
                handleMessage(`/topic/session/${sessionId}/verification`, msg);
            });
            return unsub;
        }
    }, [isConnected, sessionId, subscribe, handleMessage]);

    return {
        isConnected,
        decision,
    };
}

/**
 * Specialized hook for proctor incident notifications
 * Real-time alerts when new incidents are created
 */
export interface IncidentNotification {
    incidentId: string;
    sessionId: string;
    type: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    detectedAt: string;
    userId?: string;
    examId?: string;
}

export function useIncidentNotifications(
    examId: string | undefined,
    options?: {
        onNewIncident?: (incident: IncidentNotification) => void;
        onHighSeverity?: (incident: IncidentNotification) => void;
    }
) {
    const [latestIncident, setLatestIncident] = useState<IncidentNotification | null>(null);
    const [incidentQueue, setIncidentQueue] = useState<IncidentNotification[]>([]);
    const onNewIncidentRef = useRef(options?.onNewIncident);
    const onHighSeverityRef = useRef(options?.onHighSeverity);

    useEffect(() => {
        onNewIncidentRef.current = options?.onNewIncident;
        onHighSeverityRef.current = options?.onHighSeverity;
    }, [options?.onNewIncident, options?.onHighSeverity]);

    const handleMessage = useCallback((topic: string, message: WebSocketMessage) => {
        if (message.type === 'NEW_INCIDENT') {
            const incident: IncidentNotification = {
                incidentId: message.incidentId as string,
                sessionId: message.sessionId as string,
                type: message.incidentType as string,
                severity: message.severity as 'LOW' | 'MEDIUM' | 'HIGH',
                detectedAt: message.detectedAt as string,
                userId: message.userId as string | undefined,
                examId: message.examId as string | undefined,
            };

            setLatestIncident(incident);
            setIncidentQueue(prev => [incident, ...prev].slice(0, 50)); // Keep last 50

            // Callbacks
            onNewIncidentRef.current?.(incident);

            if (incident.severity === 'HIGH') {
                onHighSeverityRef.current?.(incident);
            }
        }
    }, []);

    const { isConnected, subscribe } = useWebSocket({
        enabled: !!examId,
        onMessage: handleMessage,
    });

    useEffect(() => {
        if (isConnected && examId) {
            const unsub = subscribe(`/topic/exam/${examId}/incidents`, (msg) => {
                handleMessage(`/topic/exam/${examId}/incidents`, msg);
            });
            return unsub;
        }
    }, [isConnected, examId, subscribe, handleMessage]);

    // Clear latest incident after 5 seconds
    useEffect(() => {
        if (latestIncident) {
            const timeout = setTimeout(() => {
                setLatestIncident(null);
            }, 5000);
            return () => clearTimeout(timeout);
        }
    }, [latestIncident]);

    return {
        isConnected,
        latestIncident,
        incidentQueue,
        clearQueue: () => setIncidentQueue([]),
    };
}

/**
 * Specialized hook for candidate AI violation notifications
 * Receives real-time alerts when Python AI worker detects violations (phone, etc.)
 */
export interface AIViolationNotification {
    sessionId: string;
    violationType: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    score: number;
    reasons: string[];
    timestamp: string;
}

export function useAIViolationNotifications(
    sessionId: string | null | undefined,
    options?: {
        onViolation?: (violation: AIViolationNotification) => void;
        enabled?: boolean;
    }
) {
    const [latestViolation, setLatestViolation] = useState<AIViolationNotification | null>(null);
    const [violationCount, setViolationCount] = useState(0);
    const onViolationRef = useRef(options?.onViolation);
    const { enabled = true } = options || {};

    useEffect(() => {
        onViolationRef.current = options?.onViolation;
    }, [options?.onViolation]);

    const handleMessage = useCallback((topic: string, message: WebSocketMessage) => {
        if (message.type === 'AI_VIOLATION') {
            const violation: AIViolationNotification = {
                sessionId: message.sessionId as string,
                violationType: message.violationType as string,
                severity: message.severity as 'LOW' | 'MEDIUM' | 'HIGH',
                score: message.score as number,
                reasons: message.reasons as string[],
                timestamp: message.timestamp as string,
            };

            console.log('[WS] AI Violation received:', violation);
            setLatestViolation(violation);
            setViolationCount(prev => prev + 1);

            // Callback
            onViolationRef.current?.(violation);
        }
    }, []);

    const { isConnected, subscribe } = useWebSocket({
        enabled: enabled && !!sessionId,
        onMessage: handleMessage,
    });

    useEffect(() => {
        if (isConnected && sessionId) {
            const unsub = subscribe(`/topic/session/${sessionId}/ai-violations`, (msg) => {
                handleMessage(`/topic/session/${sessionId}/ai-violations`, msg);
            });
            return unsub;
        }
    }, [isConnected, sessionId, subscribe, handleMessage]);

    // Clear latest violation after timeout
    useEffect(() => {
        if (latestViolation) {
            const timeout = setTimeout(() => {
                setLatestViolation(null);
            }, 15000); // Keep for 15 seconds
            return () => clearTimeout(timeout);
        }
    }, [latestViolation]);

    return {
        isConnected,
        latestViolation,
        violationCount,
        clearViolation: () => setLatestViolation(null),
    };
}

/**
 * Specialized hook for proctor to receive real-time session updates
 * Replaces polling for new students joining the exam
 */
export interface SessionNotification {
    type: 'SESSION_STARTED' | 'SESSION_ENDED' | 'SESSION_STATUS_CHANGED';
    examId: string;
    sessionId: string;
    userId: string;
    status?: string;
    oldStatus?: string;
    newStatus?: string;
    timestamp: string;
}

export function useSessionNotifications(
    examId: string | undefined,
    options?: {
        onSessionStarted?: (notification: SessionNotification) => void;
        onSessionEnded?: (notification: SessionNotification) => void;
        onStatusChanged?: (notification: SessionNotification) => void;
    }
) {
    const [sessions, setSessions] = useState<Map<string, SessionNotification>>(new Map());
    const [latestEvent, setLatestEvent] = useState<SessionNotification | null>(null);
    const onSessionStartedRef = useRef(options?.onSessionStarted);
    const onSessionEndedRef = useRef(options?.onSessionEnded);
    const onStatusChangedRef = useRef(options?.onStatusChanged);

    useEffect(() => {
        onSessionStartedRef.current = options?.onSessionStarted;
        onSessionEndedRef.current = options?.onSessionEnded;
        onStatusChangedRef.current = options?.onStatusChanged;
    }, [options?.onSessionStarted, options?.onSessionEnded, options?.onStatusChanged]);

    const handleMessage = useCallback((topic: string, message: WebSocketMessage) => {
        const notification: SessionNotification = {
            type: message.type as SessionNotification['type'],
            examId: message.examId as string,
            sessionId: message.sessionId as string,
            userId: message.userId as string,
            status: message.status as string | undefined,
            oldStatus: message.oldStatus as string | undefined,
            newStatus: message.newStatus as string | undefined,
            timestamp: message.timestamp as string,
        };

        console.log('[WS] Session notification:', notification);
        setLatestEvent(notification);

        if (message.type === 'SESSION_STARTED') {
            setSessions(prev => {
                const newMap = new Map(prev);
                newMap.set(notification.sessionId, notification);
                return newMap;
            });
            onSessionStartedRef.current?.(notification);
        } else if (message.type === 'SESSION_ENDED') {
            setSessions(prev => {
                const newMap = new Map(prev);
                newMap.delete(notification.sessionId);
                return newMap;
            });
            onSessionEndedRef.current?.(notification);
        } else if (message.type === 'SESSION_STATUS_CHANGED') {
            setSessions(prev => {
                const newMap = new Map(prev);
                newMap.set(notification.sessionId, notification);
                return newMap;
            });
            onStatusChangedRef.current?.(notification);
        }
    }, []);

    const { isConnected, subscribe } = useWebSocket({
        enabled: !!examId,
        onMessage: handleMessage,
    });

    useEffect(() => {
        if (isConnected && examId) {
            const unsub = subscribe(`/topic/exam/${examId}/sessions`, (msg) => {
                handleMessage(`/topic/exam/${examId}/sessions`, msg);
            });
            return unsub;
        }
    }, [isConnected, examId, subscribe, handleMessage]);

    return {
        isConnected,
        latestEvent,
        activeSessions: Array.from(sessions.values()),
    };
}

export default useWebSocket;



