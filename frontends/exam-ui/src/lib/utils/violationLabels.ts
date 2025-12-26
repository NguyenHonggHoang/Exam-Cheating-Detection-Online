/**
 * ViolationLabelUtils - Centralized utility for mapping violation type codes to Vietnamese labels
 * 
 * This module provides consistent Vietnamese translations for all violation types
 * used throughout the exam proctoring system.
 */

/**
 * Map violation type codes to Vietnamese labels
 * Centralized for consistency across all components
 */
export const VIOLATION_LABELS: Record<string, string> = {
  // Face detection
  'MULTIPLE_FACES': 'Phát hiện nhiều khuôn mặt',
  'NO_FACE': 'Không thấy khuôn mặt',
  'LOOKING_AWAY': 'Nhìn ra ngoài màn hình',

  // Browser events
  'TAB_SWITCH': 'Chuyển tab trình duyệt',
  'PASTE': 'Dán văn bản từ clipboard',
  'BLUR': 'Mất focus cửa sổ',
  'FOCUS': 'Lấy lại focus cửa sổ',

  // Pre-suspicion patterns (multiple formats for compatibility)
  'PRE_SUSPICIOUS_phone_beside': 'Nghi ngờ điện thoại bên cạnh',
  'PRE_SUSPICIOUS_phone_below': 'Nghi ngờ điện thoại phía dưới',
  'PRE_SUSPICIOUS_looking_down': 'Nghi ngờ nhìn xuống',
  'PRE_SUSPICION': 'Phát hiện dấu hiệu nghi ngờ',
  'PRE_SUSPICIOUS': 'Phát hiện dấu hiệu nghi ngờ',

  // AI detection
  'PHONE_DETECTED': 'Phát hiện điện thoại',
  'SCREEN_GLOW': 'Phát hiện ánh sáng màn hình phụ',
  'SUSPICIOUS_OBJECT': 'Phát hiện vật thể đáng ngờ',

  // Behavior analysis
  'BEHAVIOR_ANALYSIS': 'Phân tích hành vi bất thường',
  'ANSWER_BEHAVIOR_ANOMALY': 'Hành vi trả lời bất thường',
  'BEHAVIOR_RISK_SCORE': 'Điểm rủi ro hành vi cao',
  'TEMPORAL_ANOMALY': 'Bất thường về thời gian',
  'COMPOSITE_PATTERN': 'Phát hiện mẫu hành vi phức hợp',

  // Security
  'SCREENSHOT_ATTEMPT': 'Cố gắng chụp màn hình',
  'SCREEN_CAPTURE': 'Cố gắng ghi màn hình',

  // Other
  'DEVICE_CHANGE': 'Thay đổi thiết bị',
  'BROWSER_EXTENSION': 'Phát hiện extension trình duyệt',
  'USER_IDLE': 'Không hoạt động quá lâu',
  'FULLSCREEN_EXIT': 'Thoát chế độ toàn màn hình',
  'WINDOW_RESIZE': 'Thay đổi kích thước cửa sổ',
  
  // Evidence types (from backend)
  'EVIDENCE_TAB_SWITCH': 'Chuyển tab trình duyệt',
  'EVIDENCE_PASTE': 'Dán văn bản từ clipboard',
  'EVIDENCE_BLUR': 'Mất focus cửa sổ',
  'EVIDENCE_FOCUS': 'Lấy lại focus cửa sổ'
};

/**
 * Get Vietnamese label for violation type
 * @param type - Violation type code
 * @returns Vietnamese label or original type if not found
 */
export function getViolationLabel(type: string): string {
  return VIOLATION_LABELS[type] || type;
}

/**
 * Warning messages for exam page overlay
 * These are more detailed messages shown to students during the exam
 */
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
  'SCREEN_GLOW': 'Phát hiện ánh sáng màn hình phụ - Vui lòng tắt thiết bị khác',
  'PASTE': 'Phát hiện dán văn bản - Hành vi này được ghi nhận',
  'BLUR': 'Phát hiện mất focus cửa sổ - Vui lòng quay lại bài thi',
  'USER_IDLE': 'Không phát hiện hoạt động - Vui lòng tiếp tục làm bài',
  'FULLSCREEN_EXIT': 'Vui lòng quay lại chế độ toàn màn hình',
  'WINDOW_RESIZE': 'Phát hiện thay đổi kích thước cửa sổ - Hành vi này được ghi nhận'
};

/**
 * Get warning message for exam page overlay
 * @param type - Violation type code
 * @returns Warning message in Vietnamese
 */
export function getViolationWarningMessage(type: string): string {
  return WARNING_MESSAGES[type] || `Cảnh báo: ${getViolationLabel(type)}`;
}

/**
 * Check if a violation type is critical (requires acknowledgment)
 * @param type - Violation type code
 * @returns true if the violation is critical
 */
export function isCriticalViolation(type: string): boolean {
  const criticalTypes = ['SCREENSHOT_ATTEMPT', 'SCREEN_CAPTURE'];
  return criticalTypes.includes(type);
}

/**
 * Get all known violation types
 * @returns Array of all violation type codes
 */
export function getAllViolationTypes(): string[] {
  return Object.keys(VIOLATION_LABELS);
}
