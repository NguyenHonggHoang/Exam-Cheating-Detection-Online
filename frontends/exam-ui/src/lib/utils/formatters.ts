/**
 * Utility functions for formatting values in the Proctor Video Analysis feature
 */

/**
 * Formats a file size in bytes to a human-readable string.
 * Returns KB for sizes < 1MB, MB for sizes >= 1MB.
 * 
 * @param bytes - File size in bytes
 * @returns Human-readable string (e.g., "512 KB", "2.5 MB")
 * 
 * **Validates: Requirements 2.1**
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 0 || !Number.isFinite(bytes)) {
    return '0 KB';
  }
  
  const KB = 1024;
  const MB = KB * 1024;
  
  if (bytes < MB) {
    const kb = bytes / KB;
    // Use toFixed(1) for values < 10, but remove trailing .0
    if (kb < 10) {
      const formatted = kb.toFixed(1);
      return `${formatted.endsWith('.0') ? Math.round(kb) : formatted} KB`;
    }
    return `${Math.round(kb)} KB`;
  }
  
  const mb = bytes / MB;
  // Use toFixed(1) for values < 10, but remove trailing .0
  if (mb < 10) {
    const formatted = mb.toFixed(1);
    return `${formatted.endsWith('.0') ? Math.round(mb) : formatted} MB`;
  }
  return `${Math.round(mb)} MB`;
}

/**
 * Formats a duration in milliseconds to a human-readable string (MM:SS or HH:MM:SS).
 * 
 * @param ms - Duration in milliseconds
 * @returns Formatted duration string (e.g., "00:30", "01:30:00")
 * 
 * **Validates: Requirements 4.3**
 */
export function formatDuration(ms: number): string {
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

/**
 * Formats an ISO timestamp to Vietnamese locale format (dd/MM/yyyy HH:mm).
 * 
 * @param isoString - ISO 8601 timestamp string
 * @returns Formatted timestamp in Vietnamese locale (e.g., "15/01/2025 10:30")
 * 
 * **Validates: Requirements 2.3**
 */
export function formatTimestampVN(isoString: string): string {
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

/**
 * Converts milliseconds to seconds with one decimal place precision.
 * 
 * @param ms - Time in milliseconds
 * @returns Time in seconds with one decimal place (e.g., 15.5)
 * 
 * **Validates: Requirements 4.3**
 */
export function msToSeconds(ms: number): number {
  if (ms < 0 || !Number.isFinite(ms)) {
    return 0;
  }
  return Math.round(ms / 100) / 10;
}
