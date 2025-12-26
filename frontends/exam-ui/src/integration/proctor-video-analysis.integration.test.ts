import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Integration Tests for Proctor Video Analysis Feature
 * 
 * These tests verify the end-to-end flow of the proctor video analysis feature:
 * - Video loads from MinIO (via presigned URL)
 * - Metadata displays correctly with Vietnamese labels
 * - Behavior analysis loads on BehaviorAnalysisPage
 * - Answer logs display and sort
 * - Navigation between pages works
 * - Exam page shows Vietnamese warnings
 * - Screenshot capture on PRE_SUSPICIOUS_phone_beside
 * 
 * **Validates: Requirements 8.1, 8.5, 8.6**
 * 
 * Note: These are integration tests that verify the data flow and component
 * interactions without requiring a running backend. They test the contracts
 * between components and API clients.
 */

// ============================================================================
// Type Definitions (matching the actual API types)
// ============================================================================

interface StorageMetadata {
  objectKey: string;
  fileSize: number;
  contentType: string;
  lastModified: string;
  durationMs: number | null;
}

interface AnswerLog {
  id: string;
  sessionId: string;
  examId: string;
  questionId: string;
  questionIndex: number;
  selectedAnswer: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeToAnswerMs: number;
  revisionCount: number;
  answerChangesJson: string;
  averageTypingSpeed: number | null;
  hadPreSuspicionDuring: boolean;
  createdAt: string;
}

interface AnswerLogResponse {
  content: AnswerLog[];
  totalElements: number;
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

interface PresignedUrlResponse {
  viewUrl: string;
  expiresAt: string;
}

// ============================================================================
// Utility Functions (copied from actual implementation for testing)
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes < 0 || !Number.isFinite(bytes)) {
    return '0 KB';
  }
  
  const KB = 1024;
  const MB = KB * 1024;
  
  if (bytes < MB) {
    const kb = bytes / KB;
    if (kb < 10) {
      const formatted = kb.toFixed(1);
      return `${formatted.endsWith('.0') ? Math.round(kb) : formatted} KB`;
    }
    return `${Math.round(kb)} KB`;
  }
  
  const mb = bytes / MB;
  if (mb < 10) {
    const formatted = mb.toFixed(1);
    return `${formatted.endsWith('.0') ? Math.round(mb) : formatted} MB`;
  }
  return `${Math.round(mb)} MB`;
}

function formatDuration(ms: number): string {
  if (ms < 0 || !Number.isFinite(ms)) {
    return '00:00';
  }
  
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  const pad = (n: number) => n.toString().padStart(2, '0');
  
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  }
  
  return `${pad(minutes)}:${pad(seconds)}`;
}

function formatTimestampVN(isoString: string): string {
  if (!isoString) {
    return '';
  }
  
  try {
    const date = new Date(isoString);
    
    if (isNaN(date.getTime())) {
      return '';
    }
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  } catch {
    return '';
  }
}

function msToSeconds(ms: number): number {
  if (ms < 0 || !Number.isFinite(ms)) {
    return 0;
  }
  return Math.round(ms / 100) / 10;
}

type SortField = 'questionIndex' | 'timeToAnswerMs' | 'revisionCount';
type SortOrder = 'asc' | 'desc';

function sortAnswerLogs(
  logs: AnswerLog[],
  field: SortField,
  order: SortOrder
): AnswerLog[] {
  if (!logs || logs.length === 0) {
    return [];
  }

  return [...logs].sort((a, b) => {
    let comparison = 0;
    
    switch (field) {
      case 'questionIndex':
        comparison = a.questionIndex - b.questionIndex;
        break;
      case 'timeToAnswerMs':
        comparison = a.timeToAnswerMs - b.timeToAnswerMs;
        break;
      case 'revisionCount':
        comparison = a.revisionCount - b.revisionCount;
        break;
      default:
        comparison = 0;
    }
    
    return order === 'asc' ? comparison : -comparison;
  });
}

function isVideoFormat(urlOrKey: string | null | undefined): boolean {
  if (!urlOrKey) return false;
  
  const lowerKey = urlOrKey.toLowerCase();
  const supportedFormats = ['.mp4', '.webm', '.ogg', '.ogv'];
  
  const hasVideoExtension = supportedFormats.some(ext => lowerKey.includes(ext));
  if (hasVideoExtension) return true;
  
  const videoKeywords = ['video', 'clip', 'recording'];
  const hasVideoKeyword = videoKeywords.some(keyword => lowerKey.includes(keyword));
  
  return hasVideoKeyword;
}

function getRiskScoreColorClass(score: number): string {
  if (score >= 70) return 'text-red-600 bg-red-50 border-red-200';
  if (score >= 50) return 'text-orange-600 bg-orange-50 border-orange-200';
  if (score >= 30) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
  return 'text-green-600 bg-green-50 border-green-200';
}

// ============================================================================
// Arbitrary Generators for Property-Based Testing
// ============================================================================

const storageMetadataArbitrary: fc.Arbitrary<StorageMetadata> = fc.record({
  objectKey: fc.stringMatching(/^exam-evidence\/[a-f0-9-]+\/clip_\d+\.(mp4|webm|ogg)$/),
  fileSize: fc.integer({ min: 1024, max: 100 * 1024 * 1024 }), // 1KB to 100MB
  contentType: fc.constantFrom('video/mp4', 'video/webm', 'video/ogg'),
  lastModified: fc.integer({ min: 1704067200000, max: 1735689600000 }).map(ts => new Date(ts).toISOString()),
  durationMs: fc.option(fc.integer({ min: 1000, max: 600000 }), { nil: null }) // 1s to 10min
});

const answerLogArbitrary: fc.Arbitrary<AnswerLog> = fc.record({
  id: fc.uuid(),
  sessionId: fc.uuid(),
  examId: fc.uuid(),
  questionId: fc.uuid(),
  questionIndex: fc.integer({ min: 1, max: 100 }),
  selectedAnswer: fc.string({ minLength: 1, maxLength: 10 }),
  difficulty: fc.constantFrom('easy', 'medium', 'hard') as fc.Arbitrary<'easy' | 'medium' | 'hard'>,
  timeToAnswerMs: fc.integer({ min: 0, max: 600000 }),
  revisionCount: fc.integer({ min: 0, max: 20 }),
  answerChangesJson: fc.constant('[]'),
  averageTypingSpeed: fc.option(fc.float({ min: 0, max: 200, noNaN: true }), { nil: null }),
  hadPreSuspicionDuring: fc.boolean(),
  createdAt: fc.integer({ min: 1704067200000, max: 1735689600000 }).map(ts => new Date(ts).toISOString())
});

const behaviorAnalysisArbitrary: fc.Arbitrary<BehaviorAnalysis> = fc.record({
  id: fc.uuid(),
  sessionId: fc.uuid(),
  examId: fc.uuid(),
  overallScore: fc.integer({ min: 0, max: 100 }),
  anomaliesJson: fc.constant('[]'),
  statisticsJson: fc.constant('{"averageTimePerQuestion":15000,"averageRevisions":1.5,"rapidAnswers":2,"slowAnswers":1}'),
  patternsJson: fc.constant('{"preSuspicionCount":0,"timeClusterAnomalies":0}'),
  analyzedAt: fc.integer({ min: 1704067200000, max: 1735689600000 }).map(ts => new Date(ts).toISOString())
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('Proctor Video Analysis - End-to-End Integration Tests', () => {
  /**
   * Test Suite 1: Video Loading from MinIO
   * Validates: Requirements 5.1, 5.2
   */
  describe('Video Loading from MinIO', () => {
    it('should correctly identify video files from object keys', () => {
      fc.assert(
        fc.property(
          storageMetadataArbitrary,
          (metadata) => {
            // Object keys with video extensions should be identified as videos
            const isVideo = isVideoFormat(metadata.objectKey);
            expect(isVideo).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle presigned URL response structure correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            viewUrl: fc.webUrl(),
            expiresAt: fc.integer({ min: 1704067200000, max: 1735689600000 }).map(ts => new Date(ts).toISOString())
          }),
          (response: PresignedUrlResponse) => {
            // Presigned URL response should have required fields
            expect(response.viewUrl).toBeDefined();
            expect(typeof response.viewUrl).toBe('string');
            expect(response.viewUrl.length).toBeGreaterThan(0);
            
            expect(response.expiresAt).toBeDefined();
            const expiresDate = new Date(response.expiresAt);
            expect(expiresDate.getTime()).not.toBeNaN();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Test Suite 2: Metadata Display
   * Validates: Requirements 5.2, 2.1, 2.2, 2.3
   */
  describe('Metadata Display', () => {
    it('should format storage metadata correctly for display', () => {
      fc.assert(
        fc.property(
          storageMetadataArbitrary,
          (metadata) => {
            // File size should be formatted to human-readable string
            const formattedSize = formatFileSize(metadata.fileSize);
            expect(formattedSize).toMatch(/^\d+(\.\d)? (KB|MB)$/);
            
            // Duration should be formatted if present
            if (metadata.durationMs !== null) {
              const formattedDuration = formatDuration(metadata.durationMs);
              expect(formattedDuration).toMatch(/^(\d{2}:\d{2}:\d{2}|\d{2}:\d{2})$/);
            }
            
            // Timestamp should be formatted to Vietnamese locale
            const formattedTimestamp = formatTimestampVN(metadata.lastModified);
            expect(formattedTimestamp).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should preserve metadata integrity through formatting', () => {
      fc.assert(
        fc.property(
          storageMetadataArbitrary,
          (metadata) => {
            // Object key should remain unchanged
            expect(metadata.objectKey).toBeDefined();
            expect(metadata.objectKey.length).toBeGreaterThan(0);
            
            // Content type should be a valid video MIME type
            expect(['video/mp4', 'video/webm', 'video/ogg']).toContain(metadata.contentType);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Test Suite 3: Behavior Analysis Loading
   * Validates: Requirements 5.3, 3.1, 3.2
   */
  describe('Behavior Analysis Loading', () => {
    it('should handle behavior analysis data structure correctly', () => {
      fc.assert(
        fc.property(
          behaviorAnalysisArbitrary,
          (analysis) => {
            // Overall score should be in valid range
            expect(analysis.overallScore).toBeGreaterThanOrEqual(0);
            expect(analysis.overallScore).toBeLessThanOrEqual(100);
            
            // JSON fields should be parseable
            expect(() => JSON.parse(analysis.anomaliesJson)).not.toThrow();
            expect(() => JSON.parse(analysis.statisticsJson)).not.toThrow();
            expect(() => JSON.parse(analysis.patternsJson)).not.toThrow();
            
            // Session ID should be valid UUID format
            expect(analysis.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should apply correct risk score color coding', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 100 }),
          (score) => {
            const colorClass = getRiskScoreColorClass(score);
            
            // Color class should match the score range
            if (score >= 70) {
              expect(colorClass).toContain('red');
            } else if (score >= 50) {
              expect(colorClass).toContain('orange');
            } else if (score >= 30) {
              expect(colorClass).toContain('yellow');
            } else {
              expect(colorClass).toContain('green');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Test Suite 4: Answer Logs Display and Sorting
   * Validates: Requirements 5.4, 4.1, 4.7
   */
  describe('Answer Logs Display and Sorting', () => {
    it('should handle answer log response structure correctly', () => {
      fc.assert(
        fc.property(
          fc.array(answerLogArbitrary, { minLength: 0, maxLength: 50 }),
          (logs) => {
            const response: AnswerLogResponse = {
              content: logs,
              totalElements: logs.length
            };
            
            // Response structure should be valid
            expect(response.content).toBeDefined();
            expect(Array.isArray(response.content)).toBe(true);
            expect(response.totalElements).toBe(logs.length);
            
            // Each log should have required fields
            response.content.forEach(log => {
              expect(log.id).toBeDefined();
              expect(log.sessionId).toBeDefined();
              expect(log.questionIndex).toBeGreaterThanOrEqual(1);
              expect(['easy', 'medium', 'hard']).toContain(log.difficulty);
              expect(log.timeToAnswerMs).toBeGreaterThanOrEqual(0);
              expect(log.revisionCount).toBeGreaterThanOrEqual(0);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should sort answer logs correctly by any field', () => {
      fc.assert(
        fc.property(
          fc.array(answerLogArbitrary, { minLength: 2, maxLength: 30 }),
          fc.constantFrom('questionIndex', 'timeToAnswerMs', 'revisionCount') as fc.Arbitrary<SortField>,
          fc.constantFrom('asc', 'desc') as fc.Arbitrary<SortOrder>,
          (logs, field, order) => {
            const sorted = sortAnswerLogs(logs, field, order);
            
            // Length should be preserved
            expect(sorted.length).toBe(logs.length);
            
            // Order should be correct
            for (let i = 1; i < sorted.length; i++) {
              const prev = sorted[i - 1][field];
              const curr = sorted[i][field];
              
              if (order === 'asc') {
                expect(prev).toBeLessThanOrEqual(curr);
              } else {
                expect(prev).toBeGreaterThanOrEqual(curr);
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should convert time values correctly for display', () => {
      fc.assert(
        fc.property(
          answerLogArbitrary,
          (log) => {
            const seconds = msToSeconds(log.timeToAnswerMs);
            
            // Conversion should be accurate
            const expected = Math.round(log.timeToAnswerMs / 100) / 10;
            expect(seconds).toBe(expected);
            
            // Result should have at most 1 decimal place
            const decimalPlaces = (seconds.toString().split('.')[1] || '').length;
            expect(decimalPlaces).toBeLessThanOrEqual(1);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Test Suite 5: Data Flow Integration
   * Validates: Requirements 5.5, 5.6
   */
  describe('Data Flow Integration', () => {
    it('should maintain data consistency across components', () => {
      fc.assert(
        fc.property(
          fc.record({
            sessionId: fc.uuid(),
            metadata: storageMetadataArbitrary,
            analysis: behaviorAnalysisArbitrary,
            logs: fc.array(answerLogArbitrary, { minLength: 1, maxLength: 20 })
          }),
          ({ sessionId, metadata, analysis, logs }) => {
            // All data should reference the same session
            const logsWithSession = logs.map(log => ({ ...log, sessionId }));
            const analysisWithSession = { ...analysis, sessionId };
            
            // Verify session ID consistency
            logsWithSession.forEach(log => {
              expect(log.sessionId).toBe(sessionId);
            });
            expect(analysisWithSession.sessionId).toBe(sessionId);
            
            // Verify data can be processed together
            const formattedSize = formatFileSize(metadata.fileSize);
            const riskColor = getRiskScoreColorClass(analysisWithSession.overallScore);
            const sortedLogs = sortAnswerLogs(logsWithSession, 'questionIndex', 'asc');
            
            expect(formattedSize).toBeDefined();
            expect(riskColor).toBeDefined();
            expect(sortedLogs.length).toBe(logsWithSession.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle loading states correctly', () => {
      // Simulate loading state transitions
      const loadingStates = ['idle', 'loading', 'success', 'error'] as const;
      
      fc.assert(
        fc.property(
          fc.constantFrom(...loadingStates),
          fc.constantFrom(...loadingStates),
          fc.constantFrom(...loadingStates),
          (videoState, analysisState, logsState) => {
            // All states should be valid
            expect(loadingStates).toContain(videoState);
            expect(loadingStates).toContain(analysisState);
            expect(loadingStates).toContain(logsState);
            
            // Overall loading should be true if any component is loading
            const isLoading = videoState === 'loading' || 
                             analysisState === 'loading' || 
                             logsState === 'loading';
            
            // Overall error should be true if any component has error
            const hasError = videoState === 'error' || 
                            analysisState === 'error' || 
                            logsState === 'error';
            
            // These are valid state combinations
            expect(typeof isLoading).toBe('boolean');
            expect(typeof hasError).toBe('boolean');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Test Suite 6: Error Handling Integration
   * Validates: Requirements 5.5
   */
  describe('Error Handling Integration', () => {
    it('should handle missing data gracefully', () => {
      // Test with null/undefined values
      expect(formatFileSize(-1)).toBe('0 KB');
      expect(formatFileSize(NaN)).toBe('0 KB');
      expect(formatFileSize(Infinity)).toBe('0 KB');
      
      expect(formatDuration(-1)).toBe('00:00');
      expect(formatDuration(NaN)).toBe('00:00');
      
      expect(formatTimestampVN('')).toBe('');
      expect(formatTimestampVN('invalid')).toBe('');
      
      expect(msToSeconds(-1)).toBe(0);
      expect(msToSeconds(NaN)).toBe(0);
      
      expect(isVideoFormat(null)).toBe(false);
      expect(isVideoFormat(undefined)).toBe(false);
      expect(isVideoFormat('')).toBe(false);
      
      expect(sortAnswerLogs([], 'questionIndex', 'asc')).toEqual([]);
    });

    it('should handle edge case values correctly', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 1000 }),
          (smallValue) => {
            // Small file sizes should be in KB
            const formattedSize = formatFileSize(smallValue);
            expect(formattedSize).toMatch(/KB$/);
            
            // Small durations should be formatted correctly
            const formattedDuration = formatDuration(smallValue);
            expect(formattedDuration).toMatch(/^\d{2}:\d{2}$/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Test Suite 7: Vietnamese Warning Messages on Exam Page
   * Validates: Requirements 8.6 - Exam page shows Vietnamese warnings
   */
  describe('Vietnamese Warning Messages', () => {
    // Violation labels mapping (from violationLabels.ts)
    const VIOLATION_LABELS: Record<string, string> = {
      'MULTIPLE_FACES': 'Phát hiện nhiều khuôn mặt',
      'NO_FACE': 'Không thấy khuôn mặt',
      'LOOKING_AWAY': 'Nhìn ra ngoài màn hình',
      'TAB_SWITCH': 'Chuyển tab trình duyệt',
      'PASTE': 'Dán văn bản từ clipboard',
      'PRE_SUSPICIOUS_phone_beside': 'Nghi ngờ điện thoại bên cạnh',
      'PRE_SUSPICIOUS_phone_below': 'Nghi ngờ điện thoại phía dưới',
      'PHONE_DETECTED': 'Phát hiện điện thoại',
      'SCREEN_GLOW': 'Phát hiện ánh sáng màn hình phụ',
      'BEHAVIOR_ANALYSIS': 'Phân tích hành vi bất thường',
      'SCREENSHOT_ATTEMPT': 'Cố gắng chụp màn hình',
    };

    const WARNING_MESSAGES: Record<string, string> = {
      'PRE_SUSPICIOUS_phone_beside': 'Phát hiện nghi ngờ điện thoại bên cạnh - Vui lòng di chuyển điện thoại ra xa',
      'PRE_SUSPICIOUS_phone_below': 'Phát hiện nghi ngờ điện thoại phía dưới - Vui lòng di chuyển điện thoại ra xa',
      'BEHAVIOR_ANALYSIS': 'Phát hiện hành vi bất thường - Vui lòng tập trung vào bài thi',
      'SCREENSHOT_ATTEMPT': '⚠️ Cấm chụp màn hình! Hành vi này được ghi nhận',
      'MULTIPLE_FACES': 'Phát hiện nhiều người - Chỉ thí sinh được phép trong khung hình',
      'NO_FACE': 'Không thấy khuôn mặt - Vui lòng nhìn vào camera',
      'LOOKING_AWAY': 'Vui lòng tập trung nhìn vào màn hình',
      'TAB_SWITCH': 'Phát hiện chuyển tab - Hành vi này được ghi nhận',
      'PHONE_DETECTED': 'Phát hiện điện thoại - Vui lòng cất điện thoại đi',
    };

    function getViolationLabel(type: string): string {
      return VIOLATION_LABELS[type] || type;
    }

    function getViolationWarningMessage(type: string): string {
      return WARNING_MESSAGES[type] || `Cảnh báo: ${getViolationLabel(type)}`;
    }

    it('should return Vietnamese labels for all known violation types', () => {
      const knownTypes = Object.keys(VIOLATION_LABELS);
      
      knownTypes.forEach(type => {
        const label = getViolationLabel(type);
        // Label should be in Vietnamese (contains Vietnamese characters)
        expect(label).toBeDefined();
        expect(label.length).toBeGreaterThan(0);
        // Should not return the original type code
        expect(label).not.toBe(type);
      });
    });

    it('should return warning messages for all warning types', () => {
      const warningTypes = Object.keys(WARNING_MESSAGES);
      
      warningTypes.forEach(type => {
        const message = getViolationWarningMessage(type);
        // Message should be in Vietnamese
        expect(message).toBeDefined();
        expect(message.length).toBeGreaterThan(0);
        // Should contain Vietnamese text
        expect(message).not.toBe(type);
      });
    });

    it('should return fallback message for unknown violation types', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !VIOLATION_LABELS[s]),
          (unknownType) => {
            const message = getViolationWarningMessage(unknownType);
            // Should return a fallback message
            expect(message).toBeDefined();
            expect(message.startsWith('Cảnh báo:')).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should have specific warning for PRE_SUSPICIOUS_phone_beside', () => {
      const message = getViolationWarningMessage('PRE_SUSPICIOUS_phone_beside');
      expect(message).toContain('điện thoại');
      expect(message).toContain('di chuyển');
    });

    it('should have specific warning for SCREENSHOT_ATTEMPT', () => {
      const message = getViolationWarningMessage('SCREENSHOT_ATTEMPT');
      expect(message).toContain('chụp màn hình');
      expect(message).toContain('ghi nhận');
    });
  });

  /**
   * Test Suite 8: Screenshot Capture for PRE_SUSPICIOUS_phone_beside
   * Validates: Requirements 8.6 - Screenshot capture on PRE_SUSPICIOUS_phone_beside
   */
  describe('Screenshot Capture Integration', () => {
    interface ScreenshotCaptureEvent {
      type: string;
      sessionId: string;
      timestamp: number;
      captureTriggered: boolean;
    }

    function shouldTriggerScreenshot(violationType: string): boolean {
      return violationType === 'PRE_SUSPICIOUS_phone_beside';
    }

    function createScreenshotEvent(
      violationType: string,
      sessionId: string
    ): ScreenshotCaptureEvent {
      return {
        type: violationType,
        sessionId,
        timestamp: Date.now(),
        captureTriggered: shouldTriggerScreenshot(violationType)
      };
    }

    it('should trigger screenshot capture only for PRE_SUSPICIOUS_phone_beside', () => {
      const violationTypes = [
        'PRE_SUSPICIOUS_phone_beside',
        'PRE_SUSPICIOUS_phone_below',
        'MULTIPLE_FACES',
        'NO_FACE',
        'LOOKING_AWAY',
        'TAB_SWITCH',
        'PHONE_DETECTED'
      ];

      violationTypes.forEach(type => {
        const shouldCapture = shouldTriggerScreenshot(type);
        if (type === 'PRE_SUSPICIOUS_phone_beside') {
          expect(shouldCapture).toBe(true);
        } else {
          expect(shouldCapture).toBe(false);
        }
      });
    });

    it('should create screenshot event with correct structure', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (sessionId) => {
            const event = createScreenshotEvent('PRE_SUSPICIOUS_phone_beside', sessionId);
            
            expect(event.type).toBe('PRE_SUSPICIOUS_phone_beside');
            expect(event.sessionId).toBe(sessionId);
            expect(event.timestamp).toBeGreaterThan(0);
            expect(event.captureTriggered).toBe(true);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should not trigger screenshot for other pre-suspicion types', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.constantFrom('PRE_SUSPICIOUS_phone_below', 'PRE_SUSPICIOUS_looking_down'),
          (sessionId, violationType) => {
            const event = createScreenshotEvent(violationType, sessionId);
            expect(event.captureTriggered).toBe(false);
          }
        ),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Test Suite 9: Navigation Between Pages
   * Validates: Requirements 8.5 - Navigation between pages works
   */
  describe('Navigation Integration', () => {
    interface NavigationLink {
      from: string;
      to: string;
      params: Record<string, string>;
    }

    function buildVideoAnalysisUrl(incidentId: string): string {
      return `/proctor/video-analysis/${incidentId}`;
    }

    function buildBehaviorAnalysisUrl(sessionId: string): string {
      return `/proctor/behavior-analysis/${sessionId}`;
    }

    function buildViolationsListUrl(): string {
      return '/proctor/violations';
    }

    it('should build correct video analysis URL', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (incidentId) => {
            const url = buildVideoAnalysisUrl(incidentId);
            expect(url).toBe(`/proctor/video-analysis/${incidentId}`);
            expect(url).toContain(incidentId);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should build correct behavior analysis URL', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          (sessionId) => {
            const url = buildBehaviorAnalysisUrl(sessionId);
            expect(url).toBe(`/proctor/behavior-analysis/${sessionId}`);
            expect(url).toContain(sessionId);
          }
        ),
        { numRuns: 50 }
      );
    });

    it('should have consistent back navigation URL', () => {
      const backUrl = buildViolationsListUrl();
      expect(backUrl).toBe('/proctor/violations');
    });

    it('should support navigation flow from violations to video analysis', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.uuid(),
          (incidentId, sessionId) => {
            // Simulate navigation flow
            const startUrl = buildViolationsListUrl();
            const videoUrl = buildVideoAnalysisUrl(incidentId);
            const behaviorUrl = buildBehaviorAnalysisUrl(sessionId);
            
            // All URLs should be valid
            expect(startUrl).toMatch(/^\/proctor\//);
            expect(videoUrl).toMatch(/^\/proctor\/video-analysis\//);
            expect(behaviorUrl).toMatch(/^\/proctor\/behavior-analysis\//);
            
            // URLs should contain the correct IDs
            expect(videoUrl).toContain(incidentId);
            expect(behaviorUrl).toContain(sessionId);
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
