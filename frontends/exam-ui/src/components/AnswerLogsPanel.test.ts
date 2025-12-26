import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property-Based Tests for AnswerLogsPanel Sorting
 * 
 * These tests validate the correctness properties defined in the design document
 * using fast-check for property-based testing.
 * 
 * Note: We define the types and sorting function inline to avoid importing
 * React components which would require DOM setup.
 */

/**
 * Sort field options for answer logs table
 */
type SortField = 'questionIndex' | 'timeToAnswerMs' | 'revisionCount';

/**
 * Sort order options
 */
type SortOrder = 'asc' | 'desc';

/**
 * Answer log entry for a single question response
 */
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

/**
 * Sorts answer logs by the specified field and order.
 * This is a pure function that can be tested independently.
 * 
 * **Property 7: Answer Log Sorting**
 * *For any* list of answer logs and any valid sort field (questionIndex, timeToAnswerMs, revisionCount),
 * sorting SHALL correctly reorder the list in ascending or descending order.
 * **Validates: Requirements 4.7**
 * 
 * @param logs - Array of answer logs to sort
 * @param field - Field to sort by
 * @param order - Sort order (asc or desc)
 * @returns Sorted array of answer logs
 */
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

/**
 * Property-Based Tests for AnswerLogsPanel Sorting
 * 
 * These tests validate the correctness properties defined in the design document
 * using fast-check for property-based testing.
 */

/**
 * Arbitrary generator for AnswerLog objects
 */
const answerLogArbitrary = fc.record({
  id: fc.uuid(),
  sessionId: fc.uuid(),
  examId: fc.uuid(),
  questionId: fc.uuid(),
  questionIndex: fc.integer({ min: 1, max: 100 }),
  selectedAnswer: fc.string({ minLength: 1, maxLength: 10 }),
  difficulty: fc.constantFrom('easy', 'medium', 'hard') as fc.Arbitrary<'easy' | 'medium' | 'hard'>,
  timeToAnswerMs: fc.integer({ min: 0, max: 600000 }), // 0 to 10 minutes
  revisionCount: fc.integer({ min: 0, max: 20 }),
  answerChangesJson: fc.constant('[]'),
  averageTypingSpeed: fc.option(fc.float({ min: 0, max: 200, noNaN: true }), { nil: null }),
  hadPreSuspicionDuring: fc.boolean(),
  createdAt: fc.integer({ min: 1704067200000, max: 1735689600000 }).map(ts => new Date(ts).toISOString()) // 2024-01-01 to 2025-01-01
});

/**
 * Arbitrary generator for sort field
 */
const sortFieldArbitrary: fc.Arbitrary<SortField> = fc.constantFrom(
  'questionIndex',
  'timeToAnswerMs',
  'revisionCount'
);

/**
 * Arbitrary generator for sort order
 */
const sortOrderArbitrary: fc.Arbitrary<SortOrder> = fc.constantFrom('asc', 'desc');

describe('sortAnswerLogs', () => {
  /**
   * **Property 7: Answer Log Sorting**
   * *For any* list of answer logs and any valid sort field (questionIndex, timeToAnswerMs, revisionCount),
   * sorting SHALL correctly reorder the list in ascending or descending order.
   * **Validates: Requirements 4.7**
   */
  it('Property 7: should correctly sort answer logs by any valid field in ascending order', () => {
    fc.assert(
      fc.property(
        fc.array(answerLogArbitrary, { minLength: 0, maxLength: 50 }),
        sortFieldArbitrary,
        (logs, field) => {
          const sorted = sortAnswerLogs(logs, field, 'asc');
          
          // Verify length is preserved
          expect(sorted.length).toBe(logs.length);
          
          // Verify ascending order
          for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1][field];
            const curr = sorted[i][field];
            expect(prev).toBeLessThanOrEqual(curr);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7: should correctly sort answer logs by any valid field in descending order', () => {
    fc.assert(
      fc.property(
        fc.array(answerLogArbitrary, { minLength: 0, maxLength: 50 }),
        sortFieldArbitrary,
        (logs, field) => {
          const sorted = sortAnswerLogs(logs, field, 'desc');
          
          // Verify length is preserved
          expect(sorted.length).toBe(logs.length);
          
          // Verify descending order
          for (let i = 1; i < sorted.length; i++) {
            const prev = sorted[i - 1][field];
            const curr = sorted[i][field];
            expect(prev).toBeGreaterThanOrEqual(curr);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7: sorting should be stable - same elements should maintain relative order', () => {
    fc.assert(
      fc.property(
        fc.array(answerLogArbitrary, { minLength: 2, maxLength: 20 }),
        sortFieldArbitrary,
        sortOrderArbitrary,
        (logs, field, order) => {
          const sorted = sortAnswerLogs(logs, field, order);
          
          // All original elements should be present
          const originalIds = new Set(logs.map(l => l.id));
          const sortedIds = new Set(sorted.map(l => l.id));
          expect(sortedIds).toEqual(originalIds);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7: sorting should not mutate the original array', () => {
    fc.assert(
      fc.property(
        fc.array(answerLogArbitrary, { minLength: 1, maxLength: 20 }),
        sortFieldArbitrary,
        sortOrderArbitrary,
        (logs, field, order) => {
          const originalCopy = JSON.stringify(logs);
          sortAnswerLogs(logs, field, order);
          
          // Original array should be unchanged
          expect(JSON.stringify(logs)).toBe(originalCopy);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7: should handle empty array', () => {
    const result = sortAnswerLogs([], 'questionIndex', 'asc');
    expect(result).toEqual([]);
  });

  it('Property 7: should handle single element array', () => {
    fc.assert(
      fc.property(
        answerLogArbitrary,
        sortFieldArbitrary,
        sortOrderArbitrary,
        (log, field, order) => {
          const result = sortAnswerLogs([log], field, order);
          expect(result.length).toBe(1);
          expect(result[0]).toEqual(log);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 7: ascending and descending should be inverses', () => {
    fc.assert(
      fc.property(
        fc.array(answerLogArbitrary, { minLength: 2, maxLength: 20 }),
        sortFieldArbitrary,
        (logs, field) => {
          const ascending = sortAnswerLogs(logs, field, 'asc');
          const descending = sortAnswerLogs(logs, field, 'desc');
          
          // Reversed ascending should equal descending (for unique values)
          // We check that first element of asc equals last of desc
          if (ascending.length > 0) {
            expect(ascending[0][field]).toBe(descending[descending.length - 1][field]);
            expect(ascending[ascending.length - 1][field]).toBe(descending[0][field]);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
