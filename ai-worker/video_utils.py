"""
Video Utilities

Common utilities for video processing in AI workers.
Extracted from video_analyzer.py to avoid duplicate code.
"""

import os
import time
import requests
import tempfile
from urllib.parse import urlparse


def download_video(url: str, temp_dir: str = None, minio_endpoint: str = None, max_retries: int = 5) -> str:
    """
    Download video from URL to temp file with retry mechanism.
    
    Handles URL conversion for Docker network:
    - localhost URLs are converted to internal minio_endpoint
    
    Retries with exponential backoff for 404 errors (file not yet available).
    
    Args:
        url: Video URL (can be localhost or internal Docker URL)
        temp_dir: Directory to save temp file (default: system temp)
        minio_endpoint: Internal MinIO endpoint for Docker network (e.g., http://minio:9000)
        max_retries: Maximum number of retry attempts for 404 errors
        
    Returns:
        Path to downloaded temp file
    """
    actual_url = url
    
    # Convert localhost URLs to internal MinIO endpoint for Docker network
    if minio_endpoint and ('localhost' in url or '127.0.0.1' in url):
        parsed = urlparse(url)
        internal_host = minio_endpoint.rstrip('/')
        actual_url = f"{internal_host}{parsed.path}"
        print(f"[VideoUtils] Converted URL: {url} -> {actual_url}")
    
    print(f"[VideoUtils] Downloading video from: {actual_url}")
    
    # Retry logic for 404 errors (file not yet uploaded)
    last_error = None
    for attempt in range(max_retries):
        try:
            response = requests.get(actual_url, stream=True, timeout=60)
            response.raise_for_status()
            
            # Success - proceed with download
            break
            
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 404 and attempt < max_retries - 1:
                # File not yet available, wait and retry
                wait_time = 2 ** attempt  # 1, 2, 4, 8, 16 seconds
                print(f"[VideoUtils] File not found (404), retrying in {wait_time}s... (attempt {attempt + 1}/{max_retries})")
                time.sleep(wait_time)
                last_error = e
            else:
                raise
    else:
        # All retries exhausted
        if last_error:
            raise last_error
    
    # Determine extension
    content_type = response.headers.get('content-type', '')
    ext = '.webm' if 'webm' in content_type else '.mp4'
    
    # Use temp_dir or system temp
    if temp_dir is None:
        temp_dir = tempfile.gettempdir()
    
    temp_path = os.path.join(temp_dir, f"video_{int(time.time())}{ext}")
    
    with open(temp_path, 'wb') as f:
        for chunk in response.iter_content(chunk_size=8192):
            f.write(chunk)
    
    file_size = os.path.getsize(temp_path)
    print(f"[VideoUtils] Downloaded {file_size} bytes to {temp_path}")
    
    return temp_path


def cleanup_temp_file(file_path: str) -> bool:
    """
    Safely remove a temporary file.
    
    Args:
        file_path: Path to file to remove
        
    Returns:
        True if removed, False otherwise
    """
    try:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)
            return True
    except Exception as e:
        print(f"[VideoUtils] Failed to cleanup {file_path}: {e}")
    return False
