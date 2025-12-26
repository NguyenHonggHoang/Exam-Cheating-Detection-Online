import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  VIOLATION_LABELS,
  getViolationLabel,
  getViolationWarningMessage,
  isCriticalViolation,
  getAllViolationTypes
} from './violationLabels';

/**
 * Unit Tests and Property-Based Tests for ViolationLabelUtils
 * 
 * **Property 1: Violation Label Mapping**
 * *For any* violation type code in the system, the `getViolationLabel()` function 
 * SHALL return a non-empty Vietnamese string.
 * **Validates: Requirements 1.1-1.13**
 */

describe('ViolationLabelUtils', () => {
  describe('getViolationLabel', () => {
    /**
     * Property 1: Violation Label Mapping
     * For any known violation type, getViolationLabel SHALL return a non-empty Vietnamese string
     */
    it('Property 1: should return non-empty Vietnamese label for all known violation types', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.keys(VIOLATION_LABELS)),
          (violationType) => {
            const label = getViolationLabel(violationType);
            
            // Should return a non-empty string
            expect(label).toBeTruthy();
            expect(typeof label).toBe('string');
            expect(label.length).toBeGreaterThan(0);
            
            // Should not return the original type code (should be translated)
            expect(label).not.toBe(violationType);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 1: should return original type for unknown violation types', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !VIOLATION_LABELS[s]),
          (unknownType) => {
            const label = getViolationLabel(unknownType);
            expect(label).toBe(unknownType);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Specific tests for each required violation type (Requirements 1.1-1.13)
    it('Requirement 1.2: should display "Phân tích hành vi bất thường" for BEHAVIOR_ANALYSIS', () => {
      expect(getViolationLabel('BEHAVIOR_ANALYSIS')).toBe('Phân tích hành vi bất thường');
    });

    it('Requirement 1.3: should display "Nghi ngờ điện thoại bên cạnh" for PRE_SUSPICIOUS_phone_beside', () => {
      expect(getViolationLabel('PRE_SUSPICIOUS_phone_beside')).toBe('Nghi ngờ điện thoại bên cạnh');
    });

    it('Requirement 1.4: should display "Nghi ngờ điện thoại phía dưới" for PRE_SUSPICIOUS_phone_below', () => {
      expect(getViolationLabel('PRE_SUSPICIOUS_phone_below')).toBe('Nghi ngờ điện thoại phía dưới');
    });

    it('Requirement 1.5: should display "Cố gắng chụp màn hình" for SCREENSHOT_ATTEMPT', () => {
      expect(getViolationLabel('SCREENSHOT_ATTEMPT')).toBe('Cố gắng chụp màn hình');
    });

    it('Requirement 1.6: should display "Phát hiện nhiều khuôn mặt" for MULTIPLE_FACES', () => {
      expect(getViolationLabel('MULTIPLE_FACES')).toBe('Phát hiện nhiều khuôn mặt');
    });

    it('Requirement 1.7: should display "Không thấy khuôn mặt" for NO_FACE', () => {
      expect(getViolationLabel('NO_FACE')).toBe('Không thấy khuôn mặt');
    });

    it('Requirement 1.8: should display "Nhìn ra ngoài màn hình" for LOOKING_AWAY', () => {
      expect(getViolationLabel('LOOKING_AWAY')).toBe('Nhìn ra ngoài màn hình');
    });

    it('Requirement 1.9: should display "Chuyển tab trình duyệt" for TAB_SWITCH', () => {
      expect(getViolationLabel('TAB_SWITCH')).toBe('Chuyển tab trình duyệt');
    });

    it('Requirement 1.10: should display "Dán văn bản từ clipboard" for PASTE', () => {
      expect(getViolationLabel('PASTE')).toBe('Dán văn bản từ clipboard');
    });

    it('Requirement 1.11: should display "Phát hiện điện thoại" for PHONE_DETECTED', () => {
      expect(getViolationLabel('PHONE_DETECTED')).toBe('Phát hiện điện thoại');
    });

    it('Requirement 1.12: should display "Phát hiện ánh sáng màn hình phụ" for SCREEN_GLOW', () => {
      expect(getViolationLabel('SCREEN_GLOW')).toBe('Phát hiện ánh sáng màn hình phụ');
    });
  });

  describe('getViolationWarningMessage', () => {
    /**
     * Property 2: Warning Message Completeness
     * For any violation type that triggers a warning, getViolationWarningMessage 
     * SHALL return a user-friendly Vietnamese message
     */
    it('Property 2: should return non-empty warning message for all known violation types', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...Object.keys(VIOLATION_LABELS)),
          (violationType) => {
            const message = getViolationWarningMessage(violationType);
            
            // Should return a non-empty string
            expect(message).toBeTruthy();
            expect(typeof message).toBe('string');
            expect(message.length).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('Property 2: should return fallback message for unknown violation types', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(s => !VIOLATION_LABELS[s]),
          (unknownType) => {
            const message = getViolationWarningMessage(unknownType);
            
            // Should return a fallback message containing "Cảnh báo:"
            expect(message).toContain('Cảnh báo:');
            expect(message).toContain(unknownType);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Specific tests for warning messages (Requirements 2.1-2.8)
    it('Requirement 2.2: should display correct warning for PRE_SUSPICIOUS_phone_beside', () => {
      const message = getViolationWarningMessage('PRE_SUSPICIOUS_phone_beside');
      expect(message).toBe('Phát hiện nghi ngờ điện thoại bên cạnh - Vui lòng di chuyển điện thoại ra xa');
    });

    it('Requirement 2.3: should display correct warning for PRE_SUSPICIOUS_phone_below', () => {
      const message = getViolationWarningMessage('PRE_SUSPICIOUS_phone_below');
      expect(message).toBe('Phát hiện nghi ngờ điện thoại phía dưới - Vui lòng di chuyển điện thoại ra xa');
    });

    it('Requirement 2.4: should display correct warning for BEHAVIOR_ANALYSIS', () => {
      const message = getViolationWarningMessage('BEHAVIOR_ANALYSIS');
      expect(message).toBe('Phát hiện hành vi bất thường - Vui lòng tập trung vào bài thi');
    });

    it('Requirement 2.5: should display correct warning for SCREENSHOT_ATTEMPT', () => {
      const message = getViolationWarningMessage('SCREENSHOT_ATTEMPT');
      expect(message).toBe('⚠️ Cấm chụp màn hình! Hành vi này được ghi nhận');
    });

    it('should display correct warning for MULTIPLE_FACES', () => {
      const message = getViolationWarningMessage('MULTIPLE_FACES');
      expect(message).toBe('Phát hiện nhiều người - Chỉ thí sinh được phép trong khung hình');
    });

    it('should display correct warning for NO_FACE', () => {
      const message = getViolationWarningMessage('NO_FACE');
      expect(message).toBe('Không thấy khuôn mặt - Vui lòng nhìn vào camera');
    });

    it('should display correct warning for LOOKING_AWAY', () => {
      const message = getViolationWarningMessage('LOOKING_AWAY');
      expect(message).toBe('Vui lòng tập trung nhìn vào màn hình');
    });

    it('should display correct warning for TAB_SWITCH', () => {
      const message = getViolationWarningMessage('TAB_SWITCH');
      expect(message).toBe('Phát hiện chuyển tab - Hành vi này được ghi nhận');
    });

    it('should display correct warning for PHONE_DETECTED', () => {
      const message = getViolationWarningMessage('PHONE_DETECTED');
      expect(message).toBe('Phát hiện điện thoại - Vui lòng cất điện thoại đi');
    });
  });

  describe('isCriticalViolation', () => {
    it('should return true for SCREENSHOT_ATTEMPT', () => {
      expect(isCriticalViolation('SCREENSHOT_ATTEMPT')).toBe(true);
    });

    it('should return true for SCREEN_CAPTURE', () => {
      expect(isCriticalViolation('SCREEN_CAPTURE')).toBe(true);
    });

    it('should return false for non-critical violations', () => {
      const nonCriticalTypes = [
        'MULTIPLE_FACES',
        'NO_FACE',
        'LOOKING_AWAY',
        'TAB_SWITCH',
        'PASTE',
        'PRE_SUSPICIOUS_phone_beside',
        'PRE_SUSPICIOUS_phone_below',
        'PHONE_DETECTED',
        'BEHAVIOR_ANALYSIS'
      ];

      nonCriticalTypes.forEach(type => {
        expect(isCriticalViolation(type)).toBe(false);
      });
    });
  });

  describe('getAllViolationTypes', () => {
    it('should return all known violation types', () => {
      const types = getAllViolationTypes();
      
      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBe(Object.keys(VIOLATION_LABELS).length);
      
      // Verify all required types are included
      expect(types).toContain('BEHAVIOR_ANALYSIS');
      expect(types).toContain('PRE_SUSPICIOUS_phone_beside');
      expect(types).toContain('PRE_SUSPICIOUS_phone_below');
      expect(types).toContain('SCREENSHOT_ATTEMPT');
      expect(types).toContain('MULTIPLE_FACES');
      expect(types).toContain('NO_FACE');
      expect(types).toContain('LOOKING_AWAY');
      expect(types).toContain('TAB_SWITCH');
      expect(types).toContain('PASTE');
      expect(types).toContain('PHONE_DETECTED');
      expect(types).toContain('SCREEN_GLOW');
    });
  });

  describe('VIOLATION_LABELS constant', () => {
    it('should contain all required violation types from Requirements 1.1-1.13', () => {
      const requiredTypes = [
        'BEHAVIOR_ANALYSIS',
        'PRE_SUSPICIOUS_phone_beside',
        'PRE_SUSPICIOUS_phone_below',
        'SCREENSHOT_ATTEMPT',
        'MULTIPLE_FACES',
        'NO_FACE',
        'LOOKING_AWAY',
        'TAB_SWITCH',
        'PASTE',
        'PHONE_DETECTED',
        'SCREEN_GLOW'
      ];

      requiredTypes.forEach(type => {
        expect(VIOLATION_LABELS).toHaveProperty(type);
        expect(VIOLATION_LABELS[type]).toBeTruthy();
      });
    });
  });
});
