import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { formatFileSize, formatDuration, formatTimestampVN, msToSeconds } from './formatters';

/**
 * Property-Based Tests for Formatting Functions
 * 
 * These tests validate the correctness properties defined in the design document
 * using fast-check for property-based testing.
 */

describe('formatFileSize', () => {
  /**
   * **Property 4: File Size Formatting**
   * *For any* file size in bytes, the formatFileSize function SHALL return a 
   * human-readable string in KB (for sizes < 1MB) or MB (for sizes >= 1MB) 
   * with appropriate decimal precision.
   * **Validates: Requirements 7.1**
   */
  it('Property 4: should return KB for sizes < 1MB and MB for sizes >= 1MB', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 * 1024 * 1024 * 1024 }), // 0 to 10GB
        (bytes) => {
          const result = formatFileSize(bytes);
          const MB = 1024 * 1024;
          
          if (bytes < MB) {
            // Should be in KB format
            expect(result).toMatch(/^\d+(\.\d)? KB$/);
          } else {
            // Should be in MB format
            expect(result).toMatch(/^\d+(\.\d)? MB$/);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 4: should handle edge cases correctly', () => {
    // Zero bytes
    expect(formatFileSize(0)).toBe('0 KB');
    
    // Negative bytes
    expect(formatFileSize(-100)).toBe('0 KB');
    
    // Infinity
    expect(formatFileSize(Infinity)).toBe('0 KB');
    
    // NaN
    expect(formatFileSize(NaN)).toBe('0 KB');
  });

  it('Property 4: should format specific values correctly', () => {
    // 512 bytes = 0.5 KB
    expect(formatFileSize(512)).toBe('0.5 KB');
    
    // 1024 bytes = 1 KB
    expect(formatFileSize(1024)).toBe('1 KB');
    
    // 1MB = 1024 * 1024 bytes
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    
    // 2.5 MB
    expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });
});

describe('formatTimestampVN', () => {
  /**
   * **Property 5: Timestamp Formatting**
   * *For any* valid ISO timestamp, the formatTimestamp function SHALL return 
   * a string formatted in Vietnamese locale (dd/MM/yyyy HH:mm).
   * **Validates: Requirements 7.3**
   */
  it('Property 5: should format valid ISO timestamps to Vietnamese locale', () => {
    fc.assert(
      fc.property(
        // Generate timestamps as integers to avoid invalid date issues
        fc.integer({ min: 946684800000, max: 4102444800000 }), // 2000-01-01 to 2100-01-01 in ms
        (timestamp) => {
          const date = new Date(timestamp);
          // Skip if date is invalid (shouldn't happen with integer timestamps)
          if (isNaN(date.getTime())) {
            return true; // Skip this test case
          }
          
          const isoString = date.toISOString();
          const result = formatTimestampVN(isoString);
          
          // Should match dd/MM/yyyy HH:mm format
          expect(result).toMatch(/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
          
          // Verify the date components are correct
          const [datePart, timePart] = result.split(' ');
          const [day, month, year] = datePart.split('/').map(Number);
          const [hours, minutes] = timePart.split(':').map(Number);
          
          // Day should be 1-31
          expect(day).toBeGreaterThanOrEqual(1);
          expect(day).toBeLessThanOrEqual(31);
          
          // Month should be 1-12
          expect(month).toBeGreaterThanOrEqual(1);
          expect(month).toBeLessThanOrEqual(12);
          
          // Year should be 4 digits
          expect(year).toBeGreaterThanOrEqual(2000);
          expect(year).toBeLessThanOrEqual(2100);
          
          // Hours should be 0-23
          expect(hours).toBeGreaterThanOrEqual(0);
          expect(hours).toBeLessThanOrEqual(23);
          
          // Minutes should be 0-59
          expect(minutes).toBeGreaterThanOrEqual(0);
          expect(minutes).toBeLessThanOrEqual(59);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 5: should handle invalid inputs gracefully', () => {
    // Empty string
    expect(formatTimestampVN('')).toBe('');
    
    // Invalid date string
    expect(formatTimestampVN('not-a-date')).toBe('');
    
    // Null-like values
    expect(formatTimestampVN(null as unknown as string)).toBe('');
    expect(formatTimestampVN(undefined as unknown as string)).toBe('');
  });

  it('Property 5: should format specific timestamps correctly', () => {
    // Note: The output depends on the local timezone
    const result = formatTimestampVN('2025-01-15T10:30:00Z');
    expect(result).toMatch(/^\d{2}\/01\/2025 \d{2}:\d{2}$/);
  });
});

describe('msToSeconds', () => {
  /**
   * **Property 9: Time Conversion**
   * *For any* time value in milliseconds, the conversion to seconds SHALL be 
   * accurate (ms / 1000) with one decimal place precision.
   * **Validates: Requirements 4.3**
   */
  it('Property 9: should convert milliseconds to seconds with one decimal precision', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10000000 }), // 0 to ~2.7 hours in ms
        (ms) => {
          const result = msToSeconds(ms);
          const expected = Math.round(ms / 100) / 10;
          
          expect(result).toBe(expected);
          
          // Verify one decimal place precision
          const decimalPlaces = (result.toString().split('.')[1] || '').length;
          expect(decimalPlaces).toBeLessThanOrEqual(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property 9: should handle edge cases correctly', () => {
    // Zero
    expect(msToSeconds(0)).toBe(0);
    
    // Negative values
    expect(msToSeconds(-1000)).toBe(0);
    
    // Infinity
    expect(msToSeconds(Infinity)).toBe(0);
    
    // NaN
    expect(msToSeconds(NaN)).toBe(0);
  });

  it('Property 9: should convert specific values correctly', () => {
    expect(msToSeconds(1000)).toBe(1);
    expect(msToSeconds(1500)).toBe(1.5);
    expect(msToSeconds(15000)).toBe(15);
    expect(msToSeconds(15500)).toBe(15.5);
  });
});

describe('formatDuration', () => {
  /**
   * Additional property test for duration formatting
   * Validates that duration is formatted correctly as MM:SS or HH:MM:SS
   */
  it('should format duration correctly for various millisecond values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 24 * 60 * 60 * 1000 }), // 0 to 24 hours in ms
        (ms) => {
          const result = formatDuration(ms);
          
          // Should match either MM:SS or HH:MM:SS format
          expect(result).toMatch(/^(\d{2}:\d{2}:\d{2}|\d{2}:\d{2})$/);
          
          const parts = result.split(':').map(Number);
          
          if (parts.length === 2) {
            // MM:SS format
            const [minutes, seconds] = parts;
            expect(minutes).toBeGreaterThanOrEqual(0);
            expect(minutes).toBeLessThanOrEqual(59);
            expect(seconds).toBeGreaterThanOrEqual(0);
            expect(seconds).toBeLessThanOrEqual(59);
          } else {
            // HH:MM:SS format
            const [hours, minutes, seconds] = parts;
            expect(hours).toBeGreaterThanOrEqual(0);
            expect(minutes).toBeGreaterThanOrEqual(0);
            expect(minutes).toBeLessThanOrEqual(59);
            expect(seconds).toBeGreaterThanOrEqual(0);
            expect(seconds).toBeLessThanOrEqual(59);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle edge cases correctly', () => {
    // Zero
    expect(formatDuration(0)).toBe('00:00');
    
    // Negative values
    expect(formatDuration(-1000)).toBe('00:00');
    
    // Infinity
    expect(formatDuration(Infinity)).toBe('00:00');
    
    // NaN
    expect(formatDuration(NaN)).toBe('00:00');
  });

  it('should format specific durations correctly', () => {
    // 30 seconds
    expect(formatDuration(30000)).toBe('00:30');
    
    // 1 minute 30 seconds
    expect(formatDuration(90000)).toBe('01:30');
    
    // 1 hour
    expect(formatDuration(3600000)).toBe('01:00:00');
    
    // 1 hour 30 minutes 45 seconds
    expect(formatDuration(5445000)).toBe('01:30:45');
  });
});
