import { useEffect, useRef } from 'react';

export type EventType =
  | 'TAB_SWITCH'
  | 'PASTE'
  | 'FOCUS'
  | 'BLUR'
  | 'MULTIPLE_FACES'
  | 'NO_FACE'
  | 'LOOKING_AWAY'
  | 'SCREENSHOT_ATTEMPT'
  | 'WINDOW_RESIZE';

export interface UseEventDetectionOptions {
  sessionId: string | null;
  onEvent: (eventType: EventType) => void;
  enabled?: boolean;
}

export const useEventDetection = (options: UseEventDetectionOptions) => {
  const { sessionId, onEvent, enabled = true } = options;

  const lastSpecialEventRef = useRef<number>(0);
  const BLUR_SUPPRESS_MS = 500;

  useEffect(() => {
    if (!enabled || !sessionId) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        lastSpecialEventRef.current = Date.now();
        onEvent('TAB_SWITCH');
      }
    };

    const handleBlur = () => {
      const now = Date.now();
      if (now - lastSpecialEventRef.current < BLUR_SUPPRESS_MS) {
        console.log('[EventDetection] Suppressing BLUR (recent special event)');
        return;
      }
      onEvent('BLUR');
    };

    const handleFocus = () => {
      onEvent('FOCUS');
    };

    const handlePaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        onEvent('PASTE');
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F12') {
        console.warn('[EventDetection] Developer Tools shortcut detected: F12');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [sessionId, onEvent, enabled]);
};