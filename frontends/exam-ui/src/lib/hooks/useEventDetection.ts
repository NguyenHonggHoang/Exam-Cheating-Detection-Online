import { useEffect, useRef } from 'react';

export type EventType =
  | 'TAB_SWITCH'
  | 'PASTE'
  | 'FOCUS'
  | 'BLUR'
  | 'MULTIPLE_FACES'
  | 'NO_FACE'
  | 'LOOKING_AWAY'
  | 'SCREENSHOT_ATTEMPT';  // ADDED: Detect screenshot hotkeys

export interface UseEventDetectionOptions {
  sessionId: string | null;
  onEvent: (eventType: EventType) => void;
  enabled?: boolean;
}

export const useEventDetection = (options: UseEventDetectionOptions) => {
  const { sessionId, onEvent, enabled = true } = options;

  // Track last screenshot/tab event to suppress duplicate BLUR
  const lastSpecialEventRef = useRef<number>(0);
  const BLUR_SUPPRESS_MS = 500; // Suppress BLUR for 500ms after special events

  useEffect(() => {
    if (!enabled || !sessionId) return;

    // Tab switch detection (visibility change)
    const handleVisibilityChange = () => {
      if (document.hidden) {
        lastSpecialEventRef.current = Date.now();
        onEvent('TAB_SWITCH');
      }
    };

    // Focus lost/gained - with suppression after special events
    const handleBlur = () => {
      const now = Date.now();
      // Suppress BLUR if it happens right after a screenshot attempt or tab switch
      // This prevents duplicate events
      if (now - lastSpecialEventRef.current < BLUR_SUPPRESS_MS) {
        console.log('[EventDetection] Suppressing BLUR (recent special event)');
        return;
      }
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

    // Screenshot hotkey detection
    // Detects common screenshot shortcuts that could be used to capture exam questions
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default for screenshot keys (where possible)
      // Note: Some keys cannot be prevented (browser security)
      
      // PrtScn key (with or without modifiers)
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen') {
        console.warn('[EventDetection] Screenshot attempt detected: PrintScreen');
        e.preventDefault(); // Try to prevent (may not work)
        lastSpecialEventRef.current = Date.now();
        onEvent('SCREENSHOT_ATTEMPT');
        return;
      }

      // Windows Snipping Tool: Win + Shift + S
      // Also detect: Win + Shift + S (Windows key is metaKey on Windows)
      if (e.key === 's' && e.shiftKey && (e.metaKey || e.ctrlKey)) {
        // Check if Windows key is pressed (metaKey on Windows, but also check for Windows key code)
        const isWindows = navigator.platform.toLowerCase().includes('win');
        if (isWindows || e.metaKey) {
          console.warn('[EventDetection] Screenshot attempt detected: Win+Shift+S');
          e.preventDefault();
          lastSpecialEventRef.current = Date.now();
          onEvent('SCREENSHOT_ATTEMPT');
          return;
        }
      }

      // macOS: Cmd + Shift + 3/4/5 (screenshot shortcuts)
      if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) {
        console.warn('[EventDetection] Screenshot attempt detected: Cmd+Shift+' + e.key);
        e.preventDefault();
        lastSpecialEventRef.current = Date.now();
        onEvent('SCREENSHOT_ATTEMPT');
        return;
      }

      // Ctrl + PrtScn (some Linux systems)
      if ((e.key === 'PrintScreen' || e.code === 'PrintScreen') && e.ctrlKey) {
        console.warn('[EventDetection] Screenshot attempt detected: Ctrl+PrintScreen');
        e.preventDefault();
        lastSpecialEventRef.current = Date.now();
        onEvent('SCREENSHOT_ATTEMPT');
        return;
      }

      // Alt + PrtScn (window screenshot on some systems)
      if ((e.key === 'PrintScreen' || e.code === 'PrintScreen') && e.altKey) {
        console.warn('[EventDetection] Screenshot attempt detected: Alt+PrintScreen');
        e.preventDefault();
        lastSpecialEventRef.current = Date.now();
        onEvent('SCREENSHOT_ATTEMPT');
        return;
      }

      // F12 (Developer Tools - can be used to inspect/screenshot)
      // Note: We don't block F12 as it's commonly used for debugging, but we can detect it
      if (e.key === 'F12') {
        console.warn('[EventDetection] Developer Tools shortcut detected: F12');
        // Don't trigger screenshot event, but log it
      }
    };

    // Add event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [sessionId, onEvent, enabled]);
};