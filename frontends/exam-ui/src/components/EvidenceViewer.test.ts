import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { 
    isVideoFormat, 
    detectVideoFormat, 
    getVideoMimeType,
    SUPPORTED_VIDEO_FORMATS,
    VIDEO_MIME_TYPES,
    type SupportedVideoFormat 
} from './EvidenceViewer';

/**
 * Property-Based Tests for EvidenceViewer Video Format Detection
 * 
 * These tests validate Property 3 from the design document:
 * Video Format Support - For any video URL with extension .mp4, .webm, or .ogg,
 * the EvidenceViewer SHALL correctly identify it as a video and render 
 * appropriate video element with controls.
 * 
 * **Validates: Requirements 6.5**
 */

describe('isVideoFormat', () => {
    /**
     * **Property 3: Video Format Support**
     * *For any* video URL with extension .mp4, .webm, or .ogg, the EvidenceViewer 
     * SHALL correctly identify it as a video.
     * **Validates: Requirements 6.5**
     */
    it('Property 3: should correctly identify supported video formats', () => {
        fc.assert(
            fc.property(
                // Generate random file names with supported video extensions
                fc.record({
                    baseName: fc.stringMatching(/^[a-zA-Z0-9_-]{1,50}$/),
                    extension: fc.constantFrom(...SUPPORTED_VIDEO_FORMATS),
                    prefix: fc.constantFrom('', '/path/to/', 'exam-evidence/', 'https://example.com/')
                }),
                ({ baseName, extension, prefix }) => {
                    const url = `${prefix}${baseName}${extension}`;
                    const result = isVideoFormat(url);
                    
                    // Should always return true for supported video formats
                    expect(result).toBe(true);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 3: should return false for non-video formats', () => {
        fc.assert(
            fc.property(
                // Generate random file names with non-video extensions
                fc.record({
                    baseName: fc.stringMatching(/^[a-zA-Z0-9_-]{1,50}$/),
                    extension: fc.constantFrom('.jpg', '.png', '.gif', '.pdf', '.txt', '.doc'),
                    prefix: fc.constantFrom('', '/path/to/', 'https://example.com/')
                }),
                ({ baseName, extension, prefix }) => {
                    const url = `${prefix}${baseName}${extension}`;
                    const result = isVideoFormat(url);
                    
                    // Should return false for non-video formats
                    expect(result).toBe(false);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 3: should handle null and undefined inputs', () => {
        expect(isVideoFormat(null)).toBe(false);
        expect(isVideoFormat(undefined)).toBe(false);
        expect(isVideoFormat('')).toBe(false);
    });

    it('Property 3: should detect video keywords in path', () => {
        // URLs with video-related keywords should be detected as video
        expect(isVideoFormat('/path/to/video_123')).toBe(true);
        expect(isVideoFormat('/path/to/clip_456')).toBe(true);
        expect(isVideoFormat('/path/to/recording_789')).toBe(true);
    });

    it('Property 3: should be case-insensitive', () => {
        expect(isVideoFormat('test.MP4')).toBe(true);
        expect(isVideoFormat('test.WebM')).toBe(true);
        expect(isVideoFormat('test.OGG')).toBe(true);
        expect(isVideoFormat('test.OGV')).toBe(true);
    });

    it('Property 3: should detect video from content type', () => {
        // Content type should take precedence
        expect(isVideoFormat('unknown-file', 'video/mp4')).toBe(true);
        expect(isVideoFormat('unknown-file', 'video/webm')).toBe(true);
        expect(isVideoFormat('unknown-file', 'video/ogg')).toBe(true);
        expect(isVideoFormat('unknown-file', 'image/png')).toBe(false);
    });

    it('Property 3: should handle URLs with query parameters', () => {
        expect(isVideoFormat('test.mp4?token=abc123')).toBe(true);
        expect(isVideoFormat('test.webm?expires=12345')).toBe(true);
        expect(isVideoFormat('/path/to/file.ogg?signature=xyz')).toBe(true);
    });
});

describe('detectVideoFormat', () => {
    /**
     * Property test for format detection accuracy
     */
    it('Property 3: should correctly detect the video format from URL', () => {
        fc.assert(
            fc.property(
                fc.record({
                    baseName: fc.stringMatching(/^[a-zA-Z0-9_-]{1,50}$/),
                    extension: fc.constantFrom(...SUPPORTED_VIDEO_FORMATS),
                    prefix: fc.constantFrom('', '/path/to/', 'exam-evidence/')
                }),
                ({ baseName, extension, prefix }) => {
                    const url = `${prefix}${baseName}${extension}`;
                    const result = detectVideoFormat(url);
                    
                    // Should detect the correct format
                    expect(result).toBe(extension);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 3: should return null for non-video formats', () => {
        expect(detectVideoFormat('test.jpg')).toBeNull();
        expect(detectVideoFormat('test.png')).toBeNull();
        expect(detectVideoFormat('test.pdf')).toBeNull();
        expect(detectVideoFormat(null)).toBeNull();
        expect(detectVideoFormat(undefined)).toBeNull();
    });

    it('Property 3: should detect format from content type', () => {
        expect(detectVideoFormat('unknown', 'video/mp4')).toBe('.mp4');
        expect(detectVideoFormat('unknown', 'video/webm')).toBe('.webm');
        expect(detectVideoFormat('unknown', 'video/ogg')).toBe('.ogg');
    });

    it('Property 3: should handle URLs with query parameters', () => {
        expect(detectVideoFormat('test.mp4?token=abc')).toBe('.mp4');
        expect(detectVideoFormat('test.webm?expires=123')).toBe('.webm');
    });
});

describe('getVideoMimeType', () => {
    /**
     * Property test for MIME type mapping
     */
    it('Property 3: should return correct MIME type for each format', () => {
        const expectedMimeTypes: Record<SupportedVideoFormat, string> = {
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.ogg': 'video/ogg',
            '.ogv': 'video/ogg'
        };

        fc.assert(
            fc.property(
                fc.constantFrom(...SUPPORTED_VIDEO_FORMATS),
                (format) => {
                    const result = getVideoMimeType(format);
                    expect(result).toBe(expectedMimeTypes[format]);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 3: should return default MIME type for null', () => {
        expect(getVideoMimeType(null)).toBe('video/mp4');
    });
});

describe('Video Format Integration', () => {
    /**
     * Integration test ensuring format detection and MIME type work together
     */
    it('Property 3: should correctly chain format detection and MIME type lookup', () => {
        fc.assert(
            fc.property(
                fc.record({
                    baseName: fc.stringMatching(/^[a-zA-Z0-9_-]{1,50}$/),
                    extension: fc.constantFrom(...SUPPORTED_VIDEO_FORMATS)
                }),
                ({ baseName, extension }) => {
                    const url = `${baseName}${extension}`;
                    
                    // First, verify it's detected as video
                    expect(isVideoFormat(url)).toBe(true);
                    
                    // Then, verify format is correctly detected
                    const format = detectVideoFormat(url);
                    expect(format).toBe(extension);
                    
                    // Finally, verify MIME type is valid
                    const mimeType = getVideoMimeType(format);
                    expect(mimeType).toMatch(/^video\/(mp4|webm|ogg)$/);
                }
            ),
            { numRuns: 100 }
        );
    });

    it('Property 3: should handle content type based detection chain', () => {
        fc.assert(
            fc.property(
                fc.constantFrom(...Object.keys(VIDEO_MIME_TYPES)),
                (mimeType) => {
                    // Verify content type detection works
                    expect(isVideoFormat('unknown-file', mimeType)).toBe(true);
                    
                    // Verify format is detected from content type
                    const format = detectVideoFormat('unknown-file', mimeType);
                    expect(format).toBe(VIDEO_MIME_TYPES[mimeType]);
                    
                    // Verify MIME type round-trips correctly
                    const resultMimeType = getVideoMimeType(format);
                    expect(resultMimeType).toMatch(/^video\/(mp4|webm|ogg)$/);
                }
            ),
            { numRuns: 100 }
        );
    });
});
