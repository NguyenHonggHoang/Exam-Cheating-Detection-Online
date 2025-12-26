/**
 * Window Monitor Hook
 * 
 * Detects split-screen attacks by monitoring:
 * - Window size vs screen size (must be >= 90%)
 * - Fullscreen exit events
 * - Window resize events
 * 
 * Attack scenario: User splits screen 50-50 with exam on one side,
 * documents/ChatGPT on the other. No tab switch needed.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

// ========== Types ==========

export interface WindowState {
    width: number;
    height: number;
    screenWidth: number;
    screenHeight: number;
    widthRatio: number;
    heightRatio: number;
    isFullWidth: boolean;
    isFullHeight: boolean;
    isAcceptable: boolean;
}

export interface WindowViolation {
    type: 'WINDOW_RESIZE' | 'WINDOW_TOO_SMALL' | 'NOT_MAXIMIZED';
    state: WindowState;
    timestamp: number;
    message: string;
}

export interface UseWindowMonitorOptions {
    enabled?: boolean;
    minWidthRatio?: number;   // Default 0.9 (90%)
    minHeightRatio?: number;  // Default 0.85 (85%)
    checkIntervalMs?: number; // Default 5000 (5s)
    onViolation?: (violation: WindowViolation) => void;
    onStateChange?: (state: WindowState) => void;
}

// ========== Constants ==========

const DEFAULT_OPTIONS = {
    minWidthRatio: 0.9,
    minHeightRatio: 0.85,
    checkIntervalMs: 5000,
};

// ========== Hook ==========

export function useWindowMonitor(options: UseWindowMonitorOptions = {}) {
    const {
        enabled = true,
        minWidthRatio = DEFAULT_OPTIONS.minWidthRatio,
        minHeightRatio = DEFAULT_OPTIONS.minHeightRatio,
        checkIntervalMs = DEFAULT_OPTIONS.checkIntervalMs,
        onViolation,
        onStateChange,
    } = options;

    const [windowState, setWindowState] = useState<WindowState | null>(null);
    const [violationCount, setViolationCount] = useState(0);
    const lastViolationTimeRef = useRef<number>(0);
    const wasAcceptableRef = useRef<boolean>(true);

    // Store callbacks in refs to avoid re-running effects
    const onViolationRef = useRef(onViolation);
    const onStateChangeRef = useRef(onStateChange);
    onViolationRef.current = onViolation;
    onStateChangeRef.current = onStateChange;

    /**
     * Check current window state
     */
    const checkWindowState = useCallback((): WindowState => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const screenWidth = window.screen.availWidth;
        const screenHeight = window.screen.availHeight;

        const widthRatio = width / screenWidth;
        const heightRatio = height / screenHeight;

        const isFullWidth = widthRatio >= minWidthRatio;
        const isFullHeight = heightRatio >= minHeightRatio;
        const isAcceptable = isFullWidth && isFullHeight;

        return {
            width,
            height,
            screenWidth,
            screenHeight,
            widthRatio,
            heightRatio,
            isFullWidth,
            isFullHeight,
            isAcceptable,
        };
    }, [minWidthRatio, minHeightRatio]);

    /**
     * Handle window state change and detect violations
     */
    const handleWindowCheck = useCallback(() => {
        const state = checkWindowState();
        setWindowState(state);
        onStateChangeRef.current?.(state);

        // Only trigger violation on transition from acceptable to unacceptable
        if (!state.isAcceptable && wasAcceptableRef.current) {
            const now = Date.now();

            // Debounce: minimum 10s between violations
            if (now - lastViolationTimeRef.current > 10000) {
                const violation: WindowViolation = {
                    type: 'WINDOW_RESIZE',
                    state,
                    timestamp: now,
                    message: `Window resized below threshold: ${Math.round(state.widthRatio * 100)}% width, ${Math.round(state.heightRatio * 100)}% height`
                };

                console.log(`[WindowMonitor] 🚨 VIOLATION: ${violation.message}`);

                onViolationRef.current?.(violation);
                setViolationCount(prev => prev + 1);
                lastViolationTimeRef.current = now;
            }
        }

        wasAcceptableRef.current = state.isAcceptable;
    }, [checkWindowState]);

    /**
     * Request fullscreen mode
     */
    const requestFullscreen = useCallback(async (): Promise<boolean> => {
        try {
            if (document.documentElement.requestFullscreen) {
                await document.documentElement.requestFullscreen();
                return true;
            }
            return false;
        } catch (error) {
            console.warn('[WindowMonitor] Fullscreen request failed:', error);
            return false;
        }
    }, []);

    /**
     * Exit fullscreen mode
     */
    const exitFullscreen = useCallback(async (): Promise<boolean> => {
        try {
            if (document.exitFullscreen && document.fullscreenElement) {
                await document.exitFullscreen();
                return true;
            }
            return false;
        } catch (error) {
            console.warn('[WindowMonitor] Exit fullscreen failed:', error);
            return false;
        }
    }, []);

    // Set up event listeners and interval
    useEffect(() => {
        if (!enabled) return;

        // Initial check
        handleWindowCheck();
        console.log('[WindowMonitor] Started monitoring window size');

        // Listen for resize events
        const handleResize = () => {
            handleWindowCheck();
        };

        // Listen for fullscreen changes
        const handleFullscreenChange = () => {
            console.log('[WindowMonitor] Fullscreen state changed:', !!document.fullscreenElement);
            handleWindowCheck();
        };

        // Periodic check (backup for missed events)
        const intervalId = setInterval(handleWindowCheck, checkIntervalMs);

        // Add listeners
        window.addEventListener('resize', handleResize);
        document.addEventListener('fullscreenchange', handleFullscreenChange);

        // Cleanup
        return () => {
            window.removeEventListener('resize', handleResize);
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            clearInterval(intervalId);
            console.log('[WindowMonitor] Stopped monitoring');
        };
    }, [enabled, handleWindowCheck, checkIntervalMs]);

    return {
        windowState,
        violationCount,
        isAcceptable: windowState?.isAcceptable ?? true,
        isFullscreen: !!document.fullscreenElement,
        requestFullscreen,
        exitFullscreen,
        checkNow: handleWindowCheck,
    };
}

export default useWindowMonitor;
