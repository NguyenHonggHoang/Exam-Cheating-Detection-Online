# AI Worker - Usage Guide for New Features

## 1. Comprehensive Analyzer with OCR Filtering

### Basic Usage
```python
from comprehensive_analyzer import ComprehensiveAnalyzer

analyzer = ComprehensiveAnalyzer()
result = analyzer.analyze_video('suspicious_video.webm')

print(f"Violation Confirmed: {result.is_violation_confirmed}")
print(f"Confidence: {result.confidence}%")
print(f"Reasons: {result.reasons}")
```

### OCR Filtering in Action
The analyzer automatically filters out exam text:

```python
# If OCR detects: "Question 5: Which of the following is correct?"
# Result: Text filtered out (exam content) - No violation

# If OCR detects: "Chapter 3: Advanced Algorithms"  
# Result: Suspicious text detected - Possible violation (textbook)
```

### Customizing Exam Keywords
```python
# Add custom exam keywords
analyzer.EXAM_KEYWORDS.extend(['題目', '问题', 'pregunta'])  # Chinese, Spanish

# Or replace entirely
analyzer.EXAM_KEYWORDS = ['custom', 'keywords', 'here']
```

---

## 2. Error Handling and Fail-Safe Operation

### Normal Operation
```python
analyzer = ComprehensiveAnalyzer()

# Even if YOLO fails to load, analysis continues
result = analyzer.analyze_video('video.webm')

# Result still returned with working detectors
# Check logs for any detector failures
```

### Checking Detector Status
```python
analyzer = ComprehensiveAnalyzer()

print(f"OCR Available: {analyzer.ocr_reader is not None}")
print(f"YOLO Available: {analyzer.yolo_model is not None}")
print(f"MediaPipe Available: {analyzer.mp_hands is not None}")

# System works with any combination of detectors
```

### Graceful Degradation Examples

**Scenario 1: OCR Fails Mid-Analysis**
```python
# Frame 1-10: OCR works ✅
# Frame 11: OCR crashes ❌
# Frame 12-20: Other detectors continue ✅

# Result: Analysis completes with screen glow + hand motion + YOLO data
```

**Scenario 2: All Heavy Models Fail**
```python
# OCR: ❌ Failed to load
# YOLO: ❌ Failed to load  
# MediaPipe: ❌ Failed to load
# Screen Glow: ✅ Always available

# Result: Analysis completes with screen glow detection only
```

---

## 3. Face Liveness Detection

### Basic Usage (No Liveness Check)
```python
from face_verifier import FaceVerifier

verifier = FaceVerifier()

# Standard verification without liveness
result = verifier.verify(
    reference_image='student_id_photo.jpg',
    probe_image='exam_snapshot.jpg'
)

print(f"Verified: {result.verified}")
print(f"Confidence: {result.confidence:.2%}")
```

### Advanced Usage (With Liveness Check)
```python
import cv2
from face_verifier import FaceVerifier

verifier = FaceVerifier()

# Capture frame sequence from video
cap = cv2.VideoCapture('student_video.mp4')
frames = []

for _ in range(30):  # Capture 30 frames (~1 second at 30fps)
    ret, frame = cap.read()
    if ret:
        frames.append(frame)
cap.release()

# Verify with liveness check
result = verifier.verify(
    reference_image='student_id_photo.jpg',
    probe_image=frames[-1],  # Use last frame for face comparison
    check_liveness=True,
    probe_frame_sequence=frames  # Pass all frames for liveness
)

if not result.verified:
    print(f"Verification failed: {result.message}")
    # Example: "Liveness check FAILED: No blinks detected - suspicious (0 blinks)"
```

### Standalone Liveness Check
```python
# Check liveness without face verification
liveness_result = verifier.check_liveness(frame_sequence)

print(f"Is Live: {liveness_result.is_live}")
print(f"Confidence: {liveness_result.confidence:.2%}")
print(f"Blinks: {liveness_result.blink_count}")
print(f"Head Movement: {liveness_result.head_movement_detected}")
print(f"Texture Score: {liveness_result.texture_score:.1f}")

for reason in liveness_result.reasons:
    print(f"  - {reason}")
```

### Example Output

**Live Person (Pass):**
```
Is Live: True
Confidence: 85%
Blinks: 2
Head Movement: True
Texture Score: 145.3
  - Natural blink detected (2 blinks)
  - Natural head movement detected (7.3°)
  - Good texture variance - likely live face (145.3)
```

**Printed Photo (Fail):**
```
Is Live: False
Confidence: 20%
Blinks: 0
Head Movement: False
Texture Score: 42.1
  - No blinks detected - suspicious (0 blinks)
  - No head movement - suspicious (0.8°)
  - Low texture variance - possible photo (42.1)
  - ⚠️ LIVENESS CHECK FAILED - Possible photo/video spoof attack
```

### Integration with Exam System

**At Exam Start - ID Verification:**
```python
# Student uploads ID photo → stored in database
id_embedding = verifier.extract_and_store_embedding('uploaded_id.jpg')
# Store: id_embedding['embedding'] in database

# During exam start - capture live video
frames = capture_frames_from_webcam(duration_seconds=2)

# Verify with liveness
result = verifier.verify(
    reference_image='uploaded_id.jpg',
    probe_image=frames[-1],
    check_liveness=True,
    probe_frame_sequence=frames
)

if result.verified:
    # Allow exam to proceed
    start_exam()
else:
    # Block exam, show error
    show_error(result.message)
```

### Configuration Options

**Adjusting Liveness Thresholds:**
```python
verifier = FaceVerifier()

# Make liveness check stricter
verifier.MIN_BLINKS = 2  # Require 2 blinks instead of 1
verifier.MIN_HEAD_ROTATION = 10.0  # Require 10° rotation instead of 5°
verifier.TEXTURE_VARIANCE_THRESHOLD = 150  # Higher texture requirement

# Make liveness check more lenient (not recommended)
verifier.MIN_BLINKS = 0  # No blink required (defeats purpose)
verifier.MIN_HEAD_ROTATION = 2.0  # Very small movement accepted
```

**Adjusting Face Verification Thresholds:**
```python
verifier = FaceVerifier()

# Stricter matching (fewer false accepts)
verifier.ARCFACE_THRESHOLD = 0.3  # Default: 0.4

# More lenient matching (fewer false rejects)
verifier.ARCFACE_THRESHOLD = 0.5  # Default: 0.4
```

---

## 4. Pre-Suspicion Worker Integration

The pre-suspicion worker automatically uses all new features:

```python
# In pre_suspicion_worker.py
analyzer = ComprehensiveAnalyzer()

# All fixes are automatically applied:
# ✅ OCR exam text filtering
# ✅ Error handling fail-safe
# ✅ Multi-modal detection

result = analyzer.analyze_video(video_path)

# Publish result to RabbitMQ
publish_result(result.to_dict())
```

---

## 5. Testing Commands

### Test OCR Filtering
```bash
# Test with Python
cd ai-worker
python -c "
from comprehensive_analyzer import ComprehensiveAnalyzer
analyzer = ComprehensiveAnalyzer()
# Check keywords
print('Exam Keywords:', analyzer.EXAM_KEYWORDS)
"
```

### Test Error Handling
```bash
# Run analyzer without models installed
pip uninstall easyocr -y
python comprehensive_analyzer.py
# Should still work with screen glow detection
```

### Test Liveness Detection
```bash
# Test with static image (should fail)
python -c "
from face_verifier import FaceVerifier
import cv2

verifier = FaceVerifier()
frames = [cv2.imread('static_photo.jpg')] * 10
result = verifier.check_liveness(frames)
print(f'Is Live: {result.is_live}')  # Expected: False
"
```

---

## 6. Troubleshooting

### Issue: OCR Still Detecting Exam Text
**Solution:** Add more exam keywords
```python
analyzer.EXAM_KEYWORDS.extend([
    'exercise', 'practice', 'assignment',
    'section', 'chapter', 'page'
])
```

### Issue: Liveness Check Too Strict
**Solution:** Reduce thresholds
```python
verifier.MIN_BLINKS = 0  # Allow no blinks
verifier.MIN_HEAD_ROTATION = 3.0  # Reduce required movement
```

### Issue: Detector Keeps Failing
**Solution:** Check logs and model files
```bash
# Check model availability
ls ~/.insightface/models/buffalo_l/  # ArcFace model
ls ~/.cache/torch/hub/ultralytics_yolov8_main/  # YOLO model

# Re-download models if missing
python -c "
from face_verifier import FaceVerifier
verifier = FaceVerifier()  # Auto-downloads models
"
```

---

## 7. Performance Tips

### Optimize for Speed
```python
# Use smaller YOLO model
analyzer.yolo_model = YOLO('yolov8n.pt')  # Fastest

# Reduce frame sampling
# Instead of every 5 frames, use every 10
if frame_count % 10 != 0:
    continue
```

### Optimize for Accuracy
```python
# Use larger YOLO model
analyzer.yolo_model = YOLO('yolov8x.pt')  # Most accurate

# Analyze every frame (slower)
# Remove frame skipping entirely
```

### Optimize Memory Usage
```python
# Process video in chunks
def analyze_large_video(video_path):
    cap = cv2.VideoCapture(video_path)
    chunk_size = 100  # Process 100 frames at a time
    
    all_results = []
    chunk_frames = []
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        chunk_frames.append(frame)
        
        if len(chunk_frames) >= chunk_size:
            # Process chunk
            result = process_chunk(chunk_frames)
            all_results.append(result)
            chunk_frames = []  # Clear memory
    
    cap.release()
    return aggregate_results(all_results)
```

---

## Support

For issues or questions:
1. Check logs in `ai-worker/logs/`
2. Review [FIXES_IMPLEMENTATION.md](./FIXES_IMPLEMENTATION.md)
3. Refer to code documentation in source files
