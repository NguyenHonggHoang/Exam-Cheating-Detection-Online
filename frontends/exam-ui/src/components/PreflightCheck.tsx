import { useState, useEffect } from 'react';
import { runPreflightCheck, PreflightResult } from '@/lib/utils/preflightChecks';
import { Button } from '@/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';

interface PreflightCheckProps {
    videoElement: HTMLVideoElement | null;
    requireSEB?: boolean;
    onComplete: (result: PreflightResult) => void;
}

export function PreflightCheck({
    videoElement,
    requireSEB = false,
    onComplete
}: PreflightCheckProps) {
    const [checking, setChecking] = useState(false);
    const [result, setResult] = useState<PreflightResult | null>(null);

    const runCheck = async () => {
        setChecking(true);
        const checkResult = await runPreflightCheck(videoElement, requireSEB);
        setResult(checkResult);
        setChecking(false);
    };

    useEffect(() => {
        if (videoElement) {
            // Auto-run check when video element is ready
            setTimeout(runCheck, 1000);
        }
    }, [videoElement]);

    return (
        <Card className="w-full max-w-2xl">
            <CardHeader>
                <CardTitle>System Pre-flight Check</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {checking && (
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Running pre-flight checks...</span>
                    </div>
                )}

                {result && (
                    <>
                        {/* Critical Issues */}
                        {result.critical.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="font-semibold text-red-600 flex items-center gap-2">
                                    <XCircle className="h-5 w-5" />
                                    Critical Issues
                                </h3>
                                <ul className="list-disc ml-6 text-red-600 space-y-1">
                                    {result.critical.map((issue, idx) => (
                                        <li key={idx} className="whitespace-pre-line">{issue}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Warnings */}
                        {result.warnings.length > 0 && (
                            <div className="space-y-2">
                                <h3 className="font-semibold text-yellow-600 flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5" />
                                    Warnings
                                </h3>
                                <ul className="list-disc ml-6 text-yellow-600 space-y-1">
                                    {result.warnings.map((warning, idx) => (
                                        <li key={idx}>{warning}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* System Info */}
                        <div className="space-y-2">
                            <h3 className="font-semibold flex items-center gap-2">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                System Information
                            </h3>
                            <ul className="ml-6 space-y-1 text-sm">
                                <li>
                                    Browser: {result.info.sebDetected ? (
                                        <span className="text-green-600 font-semibold">✅ Safe Exam Browser</span>
                                    ) : (
                                        <span className="text-yellow-600">⚠️ Standard Browser</span>
                                    )}
                                </li>
                                <li>
                                    AI Backend: <span className="font-mono">{result.info.tfBackend.toUpperCase()}</span>
                                </li>
                                <li>
                                    Camera: {result.info.cameraAccess ? (
                                        <span className="text-green-600">✅ Active</span>
                                    ) : (
                                        <span className="text-red-600">❌ Not Available</span>
                                    )}
                                </li>
                                <li>
                                    Lighting: <span className={
                                        result.info.lightingQuality === 'good' ? 'text-green-600' :
                                            result.info.lightingQuality === 'dark' || result.info.lightingQuality === 'bright' ? 'text-yellow-600' :
                                                'text-gray-600'
                                    }>
                                        {result.info.lightingQuality.toUpperCase()}
                                    </span> ({Math.round(result.info.brightness)}/255)
                                </li>
                            </ul>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-4">
                            <Button onClick={runCheck} variant="outline">
                                Re-check
                            </Button>
                            <Button
                                onClick={() => onComplete(result)}
                                disabled={!result.passed}
                                className="flex-1"
                            >
                                {result.passed ? 'Continue to Exam' : 'Fix Issues First'}
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
