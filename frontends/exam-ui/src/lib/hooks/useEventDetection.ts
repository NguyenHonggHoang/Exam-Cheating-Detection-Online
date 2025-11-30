import { useEffect } from 'react';

export type EventType = 'TAB_SWITCH' | 'PASTE' | 'FOCUS' | 'BLUR';

export interface UseEventDetectionOptions {
  sessionId: string | null;
  onEvent: (eventType: EventType) => void;
  enabled?: boolean;
}

export const useEventDetection = (options: UseEventDetectionOptions) => {
  const { sessionId, onEvent, enabled = true } = options;

  useEffect(() => {
    if (!enabled || !sessionId) return;

    // Tab switch detection (visibility change)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        onEvent('TAB_SWITCH');
      }
    };

    // Focus lost/gained
    const handleBlur = () => {
      onEvent('BLUR');
    };

    const handleFocus = () => {
      onEvent('FOCUS');
    };

    // Paste detection
    const handlePaste = (e: ClipboardEvent) => {
      // Only detect paste in text inputs/textareas
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        onEvent('PASTE');
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('paste', handlePaste);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('paste', handlePaste);
    };
  }, [sessionId, onEvent, enabled]);
};