"""
Video Analyzer - DEPRECATED

This module previously contained PersonCounter with YOLO for person detection.
That logic has been removed because:
1. ComprehensiveAnalyzer already includes YOLO object detection
2. Person counting is now done within the unified video worker

For video analysis, use:
- comprehensive_analyzer.py - Multi-modal detection (YOLO + OCR + ScreenGlow + HandMotion)
- video_utils.py - download_video() utility

This file is kept for backward compatibility with imports but should not be used directly.
"""

# Re-export download_video from video_utils for backward compatibility
from video_utils import download_video, cleanup_temp_file

__all__ = ['download_video', 'cleanup_temp_file']
