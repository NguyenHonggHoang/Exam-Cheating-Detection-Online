import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/ui/card';
import { Alert, AlertDescription } from '@/ui/alert';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import { AlertTriangle, TrendingUp, Clock, RefreshCw, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import axios, { AxiosError } from 'axios';

const API_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '/api/proxy';

interface BehaviorAnomaly {
    type: string;
    severity: 'low' | 'medium' | 'high';
    score: number;
    description: string;
    evidence?: any;
}

interface BehaviorStatistics {
    averageTimePerQuestion: number;
    averageRevisions: number;
    rapidAnswers: number;
    slowAnswers: number;
}

interface BehaviorPatterns {
    preSuspicionCount: number;
    timeClusterAnomalies: number;
}

interface BehaviorAnalysis {
    id: string;
    sessionId: string;
    examId: string;
    overallScore: number;
    anomaliesJson: string;
    statisticsJson: string;
    patternsJson: string;
    analyzedAt: string;
}

interface AnswerBehaviorDashboardProps {
    sessionId: string;
}

/**
 * Returns the appropriate CSS classes for risk score color coding.
 * - Green: score < 30 (Normal - No Concerns)
 * - Yellow: score 30-49 (Low Risk - Minor Concerns)
 * - Orange: score 50-69 (Medium Risk - Monitor Closely)
 * - Red: score >= 70 (High Risk - Review Required)
 * 
 * **Validates: Requirements 3.2**
 */
export function getRiskScoreColorClass(score: number): string {
    if (score >= 70) return 'text-red-600 bg-red-50 border-red-200';
    if (score >= 50) return 'text-orange-600 bg-orange-50 border-orange-200';
    if (score >= 30) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-green-600 bg-green-50 border-green-200';
}

/**
 * Returns the appropriate progress bar color class for risk score.
 */
export function getRiskScoreProgressClass(score: number): string {
    if (score >= 70) return 'bg-red-600';
    if (score >= 50) return 'bg-orange-500';
    if (score >= 30) return 'bg-yellow-500';
    return 'bg-green-500';
}

/**
 * Returns the risk level description based on score.
 */
export function getRiskLevelDescription(score: number): string {
    if (score >= 70) return 'High Risk - Review Required';
    if (score >= 50) return 'Medium Risk - Monitor Closely';
    if (score >= 30) return 'Low Risk - Minor Concerns';
    return 'Normal - No Concerns';
}

export function AnswerBehaviorDashboard({ sessionId }: AnswerBehaviorDashboardProps) {
    const [analysis, setAnalysis] = useState<BehaviorAnalysis | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchAnalysis = useCallback(async () => {
        if (!sessionId) {
            setError('Session ID is required');
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);
            // Endpoint: /api/proxy/api/behavior/session/{sessionId}
            // The BFF proxy routes /api/proxy/api/behavior/* to incident-service
            const response = await axios.get(`${API_BASE_URL}/api/behavior/session/${sessionId}`);
            setAnalysis(response.data);
        } catch (err) {
            const axiosError = err as AxiosError;
            
            if (axiosError.response?.status === 404) {
                setError('Chưa có phân tích hành vi cho session này.');
            } else if (axiosError.response?.status === 400) {
                setError('Session ID không hợp lệ.');
            } else if (axiosError.response?.status === 401) {
                setError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
            } else if (axiosError.code === 'ECONNABORTED' || axiosError.message?.includes('timeout')) {
                setError('Kết nối bị timeout. Vui lòng thử lại.');
            } else if (!axiosError.response) {
                setError('Lỗi kết nối. Vui lòng kiểm tra mạng.');
            } else {
                setError('Không thể tải phân tích hành vi. Vui lòng thử lại.');
            }
            console.error('Failed to fetch behavior analysis:', err);
        } finally {
            setLoading(false);
        }
    }, [sessionId]);

    useEffect(() => {
        fetchAnalysis();
    }, [fetchAnalysis]);

    const handleRetry = () => {
        fetchAnalysis();
    };

    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Answer Behavior Analysis
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-500">Đang tải phân tích...</p>
                </CardContent>
            </Card>
        );
    }

    if (error || !analysis) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle>Answer Behavior Analysis</CardTitle>
                </CardHeader>
                <CardContent>
                    <Alert>
                        <AlertDescription className="flex items-center justify-between">
                            <span>{error || 'Không có dữ liệu phân tích'}</span>
                            {error && !error.includes('Session ID') && (
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    onClick={handleRetry}
                                    className="ml-4"
                                >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Thử lại
                                </Button>
                            )}
                        </AlertDescription>
                    </Alert>
                </CardContent>
            </Card>
        );
    }

    // Parse JSON fields
    const anomalies: BehaviorAnomaly[] = analysis.anomaliesJson ? JSON.parse(analysis.anomaliesJson) : [];
    const statistics: BehaviorStatistics = analysis.statisticsJson ? JSON.parse(analysis.statisticsJson) : null;
    const patterns: BehaviorPatterns = analysis.patternsJson ? JSON.parse(analysis.patternsJson) : null;

    const getSeverityBadge = (severity: string) => {
        const colors = {
            high: 'bg-red-100 text-red-800 border-red-300',
            medium: 'bg-orange-100 text-orange-800 border-orange-300',
            low: 'bg-yellow-100 text-yellow-800 border-yellow-300'
        };
        return colors[severity as keyof typeof colors] || colors.low;
    };

    return (
        <div className="space-y-4">
            {/* Overall Risk Score */}
            <Card className={`border-2 ${getRiskScoreColorClass(analysis.overallScore)}`}>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        <span>Overall Risk Score</span>
                        <div className="flex items-center gap-2">
                            {analysis.overallScore >= 70 ? (
                                <XCircle className="w-6 h-6" />
                            ) : (
                                <CheckCircle className="w-6 h-6" />
                            )}
                            <span className="text-3xl font-bold">{analysis.overallScore.toFixed(0)}</span>
                        </div>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <div className="w-full bg-gray-200 rounded-full h-4">
                            <div
                                className={`h-4 rounded-full ${getRiskScoreProgressClass(analysis.overallScore)}`}
                                style={{ width: `${Math.min(100, analysis.overallScore)}%` }}
                            />
                        </div>
                        <p className="text-sm">
                            {getRiskLevelDescription(analysis.overallScore)}
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Anomalies */}
            {anomalies.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5" />
                            Detected Anomalies ({anomalies.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {anomalies.map((anomaly, index) => (
                                <div key={index} className="border rounded-lg p-3">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <Badge className={getSeverityBadge(anomaly.severity)}>
                                                {anomaly.severity.toUpperCase()}
                                            </Badge>
                                            <span className="ml-2 font-medium">{anomaly.type.replace(/_/g, ' ')}</span>
                                        </div>
                                        <span className="text-sm text-gray-500">Score: {anomaly.score}</span>
                                    </div>
                                    <p className="text-sm text-gray-700">{anomaly.description}</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Statistics */}
            {statistics && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="w-5 h-5" />
                            Answer Statistics
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="border rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <Clock className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm font-medium">Avg Time/Question</span>
                                </div>
                                <p className="text-2xl font-bold">
                                    {(statistics.averageTimePerQuestion / 1000).toFixed(1)}s
                                </p>
                            </div>

                            <div className="border rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <RefreshCw className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm font-medium">Avg Revisions</span>
                                </div>
                                <p className="text-2xl font-bold">
                                    {statistics.averageRevisions.toFixed(1)}
                                </p>
                            </div>

                            <div className="border rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <AlertTriangle className="w-4 h-4 text-orange-500" />
                                    <span className="text-sm font-medium">Rapid Answers</span>
                                </div>
                                <p className="text-2xl font-bold text-orange-600">
                                    {statistics.rapidAnswers}
                                </p>
                            </div>

                            <div className="border rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-1">
                                    <Clock className="w-4 h-4 text-blue-500" />
                                    <span className="text-sm font-medium">Slow Answers</span>
                                </div>
                                <p className="text-2xl font-bold text-blue-600">
                                    {statistics.slowAnswers}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Patterns */}
            {patterns && (
                <Card>
                    <CardHeader>
                        <CardTitle>Behavioral Patterns</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span>Answered During Pre-Suspicion</span>
                                <Badge variant={patterns.preSuspicionCount > 0 ? 'destructive' : 'secondary'}>
                                    {patterns.preSuspicionCount} questions
                                </Badge>
                            </div>
                            <div className="flex justify-between items-center">
                                <span>Time Cluster Anomalies</span>
                                <Badge variant="secondary">
                                    {patterns.timeClusterAnomalies}
                                </Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
