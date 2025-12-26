/**
 * Calibration Overlay Component
 * 
 * Real-time visual guidance for calibration during check-in.
 * Shows directional arrows and face position guidance.
 */

import React, { useEffect, useState } from 'react';
import { CalibrationValidation, CalibrationIssue } from '../lib/utils/preSuspicionDetector';

interface CalibrationOverlayProps {
    validation: CalibrationValidation | null;
    progress: number;  // 0-100
    isCalibrating: boolean;
    onComplete?: () => void;
}

const DIRECTION_ARROWS: Record<string, string> = {
    up: '⬆️',
    down: '⬇️',
    left: '⬅️',
    right: '➡️',
    forward: '🔍',
    backward: '🔎'
};

export const CalibrationOverlay: React.FC<CalibrationOverlayProps> = ({
    validation,
    progress,
    isCalibrating,
    onComplete
}) => {
    const [pulseClass, setPulseClass] = useState('');

    // Pulse effect on guidance change
    useEffect(() => {
        if (validation?.guidance) {
            setPulseClass('animate-pulse');
            const timer = setTimeout(() => setPulseClass(''), 500);
            return () => clearTimeout(timer);
        }
    }, [validation?.guidance]);

    if (!isCalibrating) return null;

    const isValid = validation?.valid ?? false;
    const primaryIssue = validation?.issues?.[0];

    return (
        <div className="absolute inset-0 pointer-events-none z-20">
            {/* Face guide frame */}
            <div className="absolute inset-0 flex items-center justify-center">
                <div
                    className={`relative border-4 rounded-xl transition-all duration-200 ${isValid
                            ? 'border-green-500 shadow-lg shadow-green-500/30'
                            : 'border-yellow-500 shadow-lg shadow-yellow-500/30'
                        }`}
                    style={{
                        width: '200px',
                        height: '280px'
                    }}
                >
                    {/* Corner markers */}
                    <div className="absolute -top-1 -left-1 w-4 h-4 border-t-4 border-l-4 border-current rounded-tl" />
                    <div className="absolute -top-1 -right-1 w-4 h-4 border-t-4 border-r-4 border-current rounded-tr" />
                    <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-4 border-l-4 border-current rounded-bl" />
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-4 border-r-4 border-current rounded-br" />

                    {/* "Đặt mặt vào khung" text */}
                    {!isValid && (
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap text-white text-sm bg-black/60 px-3 py-1 rounded-full">
                            Đặt mặt vào khung
                        </div>
                    )}

                    {/* Valid check mark */}
                    {isValid && (
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="text-6xl text-green-500 animate-bounce-slow">✓</div>
                        </div>
                    )}
                </div>
            </div>

            {/* Directional guidance */}
            {primaryIssue?.direction && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <DirectionArrow direction={primaryIssue.direction} />
                </div>
            )}

            {/* Guidance message */}
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2">
                <div
                    className={`bg-black/80 text-white px-6 py-3 rounded-xl text-center min-w-[250px] ${pulseClass}`}
                >
                    {isValid ? (
                        <div className="text-green-400 font-semibold">
                            ✓ Tư thế đúng - Giữ nguyên
                        </div>
                    ) : validation?.guidance ? (
                        <div className="text-yellow-300 font-semibold text-lg">
                            {validation.guidance}
                        </div>
                    ) : (
                        <div className="text-gray-300">Đang kiểm tra...</div>
                    )}
                </div>
            </div>

            {/* Progress bar */}
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 w-64">
                <div className="bg-gray-700 rounded-full h-3 overflow-hidden">
                    <div
                        className={`h-full transition-all duration-200 ${isValid ? 'bg-green-500' : 'bg-yellow-500'
                            }`}
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="text-center text-white text-sm mt-1">
                    {Math.round(progress)}% hoàn thành
                </div>
            </div>

            {/* Issues list (small, bottom corner) */}
            {validation?.issues && validation.issues.length > 0 && (
                <div className="absolute bottom-4 right-4 text-xs text-white/70 bg-black/40 px-2 py-1 rounded">
                    {validation.issues.map((issue, i) => (
                        <div key={i}>{DIRECTION_ARROWS[issue.direction || ''] || '•'} {issue.message}</div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Directional arrow component
const DirectionArrow: React.FC<{ direction: string }> = ({ direction }) => {
    const arrowStyles: Record<string, React.CSSProperties> = {
        up: { top: '-100px', left: '50%', transform: 'translateX(-50%)' },
        down: { bottom: '-100px', left: '50%', transform: 'translateX(-50%)' },
        left: { left: '-130px', top: '50%', transform: 'translateY(-50%)' },
        right: { right: '-130px', top: '50%', transform: 'translateY(-50%)' },
        forward: { bottom: '-100px', left: '50%', transform: 'translateX(-50%)' },
        backward: { bottom: '-100px', left: '50%', transform: 'translateX(-50%)' }
    };

    const arrowEmoji = DIRECTION_ARROWS[direction] || '•';

    return (
        <div
            className="absolute text-5xl animate-bounce text-yellow-400"
            style={{
                ...arrowStyles[direction],
                position: 'absolute',
                filter: 'drop-shadow(0 0 10px rgba(250, 204, 21, 0.5))'
            }}
        >
            {arrowEmoji}
        </div>
    );
};

// Checklist component for requirements
export const CalibrationChecklist: React.FC<{
    items: Array<{ label: string; checked: boolean }>;
}> = ({ items }) => (
    <div className="bg-black/60 rounded-lg p-3 text-white text-sm">
        {items.map((item, i) => (
            <div key={i} className="flex items-center gap-2 py-1">
                <span className={item.checked ? 'text-green-400' : 'text-gray-400'}>
                    {item.checked ? '✓' : '○'}
                </span>
                <span className={item.checked ? 'text-white' : 'text-gray-400'}>
                    {item.label}
                </span>
            </div>
        ))}
    </div>
);

export default CalibrationOverlay;
