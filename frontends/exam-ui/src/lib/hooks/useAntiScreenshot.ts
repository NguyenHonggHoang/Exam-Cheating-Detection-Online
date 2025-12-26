/**
 * Anti-Screenshot Hook
 * 
 * Prevents or hinders screenshot/screen recording attempts.
 * - Disables right-click context menu
 * - Blocks PrintScreen key
 * - Disables common keyboard shortcuts
 * - Blurs content momentarily on screenshot attempt
 * - Detects rapid blur/focus cycles (heuristic for external screenshot tools)
 */

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

    // Blur the content temporarily
    const blurContent = useCallback(() => {
        const overlay = document.createElement('div');
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
    `;
        overlay.innerHTML = '⚠️ Screenshot không được phép!';
        document.body.appendChild(overlay);

        setTimeout(() => {
            overlay.remove();
        }, blurDurationMs);

        onScreenshotAttempt?.();
    }, [blurDurationMs, onScreenshotAttempt]);

    // Heuristic Detection State
    const lastBlurTimeRef = useRef<number>(0);

    // Heuristic: Rapid Blur/Focus cycle (< 2s) usually implies Snipping Tool usage
    useEffect(() => {
        if (!enabled) return;

        const handleWindowBlur = () => {
            lastBlurTimeRef.current = Date.now();
        };

        const handleWindowFocus = () => {
            const now = Date.now();
            const timeSinceBlur = now - lastBlurTimeRef.current;

            // If focus returns within 100ms - 2000ms, it's suspicious
            // (Too fast for a normal "check another tab" action, matches "Snippet Tool" behavior)
            if (timeSinceBlur > 100 && timeSinceBlur < 2000) {
                console.warn('[Security] Rapid blur/focus cycle detected - Potential Screenshot Tool');
                // Updated warning message as requested
                const overlay = document.getElementById('screenshot-blur-overlay');
                if (overlay) {
                    overlay.innerHTML = '⚠️ Phát hiện chuyển đổi cửa sổ nhanh (Nghi vấn chụp màn hình)!';
                }
                blurContent();
            }
        };

        window.addEventListener('blur', handleWindowBlur);
        window.addEventListener('focus', handleWindowFocus);

        return () => {
            window.removeEventListener('blur', handleWindowBlur);
            window.removeEventListener('focus', handleWindowFocus);
        };
    }, [enabled, blurContent]);

    // Static Preventions (Keyboard/Mouse)
    useEffect(() => {
        if (!enabled) return;

        // Disable right-click context menu
        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault();
            return false;
        };

        // Disable various keyboard shortcuts
        const handleKeyDown = (e: KeyboardEvent) => {
            // PrintScreen
            if (e.key === 'PrintScreen') {
                e.preventDefault();
                blurContent();
                return false;
            }

            // Ctrl+P (Print)
            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                return false;
            }

            // Ctrl+S (Save)
            if (e.ctrlKey && e.key === 's') {
                e.preventDefault();
                return false;
            }

            // Ctrl+Shift+S (Save As)
            if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) {
                e.preventDefault();
                return false;
            }

            // Ctrl+Shift+I (Dev Tools)
            if (e.ctrlKey && e.shiftKey && (e.key === 'I' || e.key === 'i')) {
                e.preventDefault();
                return false;
            }

            // F12 (Dev Tools)
            if (e.key === 'F12') {
                e.preventDefault();
                return false;
            }

            // Win+Shift+S (Windows Screenshot)
            if (e.metaKey && e.shiftKey && (e.key === 's' || e.key === 'S')) {
                e.preventDefault();
                blurContent();
                return false;
            }
        };

        // Disable drag and drop
        const handleDragStart = (e: DragEvent) => {
            e.preventDefault();
            return false;
        };

        // Disable text selection on question content
        const handleSelectStart = (e: Event) => {
            const target = e.target as HTMLElement;
            if (target.closest('.question-content')) {
                e.preventDefault();
                return false;
            }
        };

        // Add CSS to disable selection on question content
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

        // Add event listeners
        document.addEventListener('contextmenu', handleContextMenu, true); // capture: true
        document.addEventListener('keydown', handleKeyDown, true); // capture: true
        document.addEventListener('dragstart', handleDragStart);
        document.addEventListener('selectstart', handleSelectStart);

        // Cleanup
        return () => {
            document.removeEventListener('contextmenu', handleContextMenu, true);
            document.removeEventListener('keydown', handleKeyDown, true);
            document.removeEventListener('dragstart', handleDragStart);
            document.removeEventListener('selectstart', handleSelectStart);
            style.remove();
        };
    }, [enabled, blurContent]);
}

export default useAntiScreenshot;
