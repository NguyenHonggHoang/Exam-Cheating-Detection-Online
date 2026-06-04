import { useEffect, useCallback, useRef } from 'react';

interface UseAntiScreenshotOptions {
    enabled?: boolean;
    blurDurationMs?: number;
    onScreenshotAttempt?: () => void;
}

export function useAntiScreenshot(options: UseAntiScreenshotOptions = {}) {
    const {
        enabled = true,
        blurDurationMs = 1000,
        onScreenshotAttempt
    } = options;

    const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const blurContent = useCallback((message: string = '⚠️ Screenshot không được phép!', notifyParent: boolean = true) => {
        // Check if overlay already exists
        let overlay = document.getElementById('screenshot-blur-overlay');

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'screenshot-blur-overlay';
            overlay.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(20px);
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: bold;
          color: #333;
          pointer-events: none; /* Ensure clicks pass through if needed, though usually we want to block */
        `;
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = message;

        if (blurTimeoutRef.current) {
            clearTimeout(blurTimeoutRef.current);
            blurTimeoutRef.current = null;
        }

        blurTimeoutRef.current = setTimeout(() => {
            const currentOverlay = document.getElementById('screenshot-blur-overlay');
            if (currentOverlay) {
                currentOverlay.remove();
            }
            blurTimeoutRef.current = null;
        }, blurDurationMs);

        if (notifyParent) {
            onScreenshotAttempt?.();
        }
    }, [blurDurationMs, onScreenshotAttempt]);

    const lastBlurTimeRef = useRef<number>(0);

    // Flag to track if a screenshot action (key press) just happened
    const isScreenshotActionRef = useRef<boolean>(false);

    // Heuristic: Rapid Blur/Focus cycle (< 2s) usually implies Snipping Tool usage
    useEffect(() => {
        if (!enabled) return;

        const handleWindowBlur = () => {
            lastBlurTimeRef.current = Date.now();
        };

        const handleWindowFocus = () => {
            const now = Date.now();
            const timeSinceBlur = now - lastBlurTimeRef.current;

            // If a screenshot action was detected recently (last 3s), skip this heuristic warning
            // because the explicit screenshot warning is more accurate/important.
            if (isScreenshotActionRef.current) {
                console.log('[Security] Skipping rapid blur check due to recent screenshot action');
                return;
            }

            // If focus returns within 100ms - 2000ms, it's suspicious
            // (Too fast for a normal "check another tab" action, matches "Snippet Tool" behavior)
            if (timeSinceBlur > 100 && timeSinceBlur < 2000) {
                console.warn('[Security] Rapid blur/focus cycle detected - Potential Screenshot Tool');
                // notifyParent = false to avoid triggering critical violation loop
                blurContent('⚠️ Phát hiện chuyển đổi cửa sổ nhanh (Nghi vấn chụp màn hình)!', false);
            }
        };

        window.addEventListener('blur', handleWindowBlur);
        window.addEventListener('focus', handleWindowFocus);

        return () => {
            window.removeEventListener('blur', handleWindowBlur);
            window.removeEventListener('focus', handleWindowFocus);
        };
    }, [enabled, blurContent]);

    useEffect(() => {
        if (!enabled) return;

        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            return false;
        };

        const markScreenshotAction = () => {
            isScreenshotActionRef.current = true;
            // Reset flag after 3s (enough time for focus cycle to complete)
            setTimeout(() => {
                isScreenshotActionRef.current = false;
            }, 3000);
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            // PrintScreen (key or keyCode 44)
            if (e.key === 'PrintScreen' || e.keyCode === 44) {
                e.preventDefault();
                markScreenshotAction();
                blurContent(); // strict violation = true
                return false;
            }

            // Ctrl+P (Print)
            if (e.ctrlKey && (e.key === 'p' || e.key === 'P' || e.keyCode === 80)) {
                e.preventDefault();
                return false;
            }

            // Ctrl+S (Save)
            if (e.ctrlKey && (e.key === 's' || e.key === 'S' || e.keyCode === 83)) {
                e.preventDefault();
                return false;
            }

            // Ctrl+Shift+S (Save As)
            if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's' || e.keyCode === 83)) {
                e.preventDefault();
                return false;
            }

            // Ctrl+Shift+I (Dev Tools)
            if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i' || e.keyCode === 73)) {
                e.preventDefault();
                return false;
            }

            // F12 (Dev Tools)
            if (e.key === 'F12' || e.keyCode === 123) {
                e.preventDefault();
                return false;
            }

            // Win+Shift+S (Windows Screenshot) - Hard to catch as OS intercepts 'Win' key combinations
            // But we can try catching the specific sequence if browser sees it
            if (e.metaKey && e.shiftKey && (e.key === 's' || e.key === 'S' || e.keyCode === 83)) {
                e.preventDefault();
                markScreenshotAction();
                blurContent();
                return false;
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'PrintScreen' || e.keyCode === 44) {
                e.preventDefault();
                markScreenshotAction();
                blurContent();
                return false;
            }
        };

        const handleDragStart = (e: DragEvent) => {
            e.preventDefault();
            return false;
        };
        const handleSelectStart = (e: Event) => {
            let target = e.target as Node;
            if (target.nodeType === Node.TEXT_NODE && target.parentElement) {
                target = target.parentElement;
            }

            if (target instanceof Element && target.closest('.question-content')) {
                e.preventDefault();
                return false;
            }
        };

        const style = document.createElement('style');
        style.id = 'anti-screenshot-style';
        style.textContent = `
      .question-content {
        user-select: none !important;
        -webkit-user-select: none !important;
        -moz-user-select: none !important;
        -ms-user-select: none !important;
      }
      
      .question-content * {
        user-select: none !important;
      }
      
      /* Prevent printing */
      @media print {
        body * {
          visibility: hidden !important;
        }
        body::after {
          content: "In ấn không được phép!";
          visibility: visible !important;
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-size: 48px;
          font-weight: bold;
        }
      }
    `;
        document.head.appendChild(style);

        document.addEventListener('contextmenu', handleContextMenu, true); // capture: true
        document.addEventListener('keydown', handleKeyDown, true); // capture: true
        document.addEventListener('keyup', handleKeyUp, true); // capture: true
        document.addEventListener('dragstart', handleDragStart);
        document.addEventListener('selectstart', handleSelectStart);

        return () => {
            document.removeEventListener('contextmenu', handleContextMenu, true);
            document.removeEventListener('keydown', handleKeyDown, true);
            document.removeEventListener('keyup', handleKeyUp, true);
            document.removeEventListener('dragstart', handleDragStart);
            document.removeEventListener('selectstart', handleSelectStart);
            style.remove();
        };
    }, [enabled, blurContent]);
}

export default useAntiScreenshot;
