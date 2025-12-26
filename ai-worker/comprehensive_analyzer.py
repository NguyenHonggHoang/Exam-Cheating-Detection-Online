"""
Comprehensive Pre-Suspicion Video Analyzer

Analyzes micro-buffer videos (1.5s) for multiple violation signals:
1. Screen Glow Detection (phone screen illumination)
2. Document/Text Detection (OCR for notes/cheat sheets)
3. Hand Motion Detection (reaching for phone/notes)
4. Object Detection (phone, book, paper, second screen)

AI Decision Flow:
├─ Phone detected? → CONFIRM violation
├─ Document text detected? → CONFIRM violation  
├─ Hand reaching motion? → CONFIRM violation
├─ Screen glow in lap? → CONFIRM violation
└─ None detected? → REJECT (no incident created)
"""

import cv2
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import logging

# OCR
try:
    import easyocr
    OCR_AVAILABLE = True
except ImportError:
    OCR_AVAILABLE = False
    logging.warning("EasyOCR not available - document detection disabled")

# YOLO
try:
    from ultralytics import YOLO
    YOLO_AVAILABLE = True
except ImportError:
    YOLO_AVAILABLE = False
    logging.warning("YOLO not available - object detection disabled")

# Pose Estimation
try:
    import mediapipe as mp
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision
    MEDIAPIPE_AVAILABLE = True
except ImportError:
    MEDIAPIPE_AVAILABLE = False
    logging.warning("MediaPipe not available - hand motion detection disabled")

from screen_glow_detector import ScreenGlowDetector

logger = logging.getLogger('ComprehensiveAnalyzer')


@dataclass
class AnalysisResult:
    """Comprehensive analysis result"""
    # Individual detection results
    screen_glow_detected: bool
    screen_glow_score: float
    
    document_detected: bool
    document_confidence: float
    detected_text: str
    
    hand_motion_detected: bool
    hand_motion_type: str  # 'reaching_down', 'holding_object', 'typing'
    
    object_detected: bool
    detected_objects: List[str]  # ['phone', 'book', 'paper']
    
    # Final decision
    is_violation_confirmed: bool
    confidence: float
    reasons: List[str]
    
    def to_dict(self) -> Dict:
        return {
            'screen_glow': {
                'detected': self.screen_glow_detected,
                'score': self.screen_glow_score
            },
            'document': {
                'detected': self.document_detected,
                'confidence': self.document_confidence,
                'text': self.detected_text
            },
            'hand_motion': {
                'detected': self.hand_motion_detected,
                'type': self.hand_motion_type
            },
            'objects': {
                'detected': self.object_detected,
                'items': self.detected_objects
            },
            'verdict': {
                'is_violation': self.is_violation_confirmed,
                'confidence': self.confidence,
                'reasons': self.reasons
            }
        }


class ComprehensiveAnalyzer:
    """
    Multi-modal analyzer for pre-suspicion videos
    
    Combines 4 detection methods:
    1. Screen glow (lighting analysis)
    2. OCR (text detection)
    3. Hand pose (motion analysis)
    4. YOLO (object detection)
    """
    
    # Detection thresholds
    SCREEN_GLOW_THRESHOLD = 60  # 0-100 score
    TEXT_LENGTH_THRESHOLD = 20  # Min characters to consider document
    HAND_MOTION_THRESHOLD = 0.15  # Hand displacement threshold
    OBJECT_CONFIDENCE_THRESHOLD = 0.5
    
    # Confirmation thresholds (need one strong signal)
    CONFIRM_THRESHOLD = 70  # 70% confidence = CONFIRM
    
    # Exam text filtering - keywords that indicate legitimate exam content
    EXAM_KEYWORDS = [
        'question', 'answer', 'select', 'choose', 'exam', 'test', 'quiz',
        'multiple choice', 'true false', 'correct', 'incorrect', 'option',
        'a)', 'b)', 'c)', 'd)', 'which', 'following', 'best describes'
    ]
    
    def __init__(self):
        """Initialize all detection modules"""
        # Screen glow detector (always available)
        self.glow_detector = ScreenGlowDetector()
        
        # OCR reader
        self.ocr_reader = None
        if OCR_AVAILABLE:
            try:
                self.ocr_reader = easyocr.Reader(['en'], gpu=False)
                logger.info("EasyOCR initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize OCR: {e}")
        
        # YOLO model
        self.yolo_model = None
        if YOLO_AVAILABLE:
            try:
                self.yolo_model = YOLO('yolov8n.pt')
                logger.info("YOLOv8 initialized")
            except Exception as e:
                logger.warning(f"Failed to initialize YOLO: {e}")
        
        # MediaPipe Hands
        self.mp_hands = None
        self.mp_pose = None
        if MEDIAPIPE_AVAILABLE:
            try:
                # Use legacy API for compatibility
                mp_hands_module = mp.solutions.hands if hasattr(mp, 'solutions') else None
                mp_pose_module = mp.solutions.pose if hasattr(mp, 'solutions') else None
                
                if mp_hands_module and mp_pose_module:
                    self.mp_hands = mp_hands_module.Hands(
                        static_image_mode=False,
                        max_num_hands=2,
                        min_detection_confidence=0.5
                    )
                    self.mp_pose = mp_pose_module.Pose(
                        static_image_mode=False,
                        min_detection_confidence=0.5
                    )
                    logger.info("MediaPipe Hands & Pose initialized")
                else:
                    logger.warning("MediaPipe solutions API not available")
            except Exception as e:
                logger.warning(f"Failed to initialize MediaPipe: {e}")
    
    def _safe_detect(self, detector_func, *args, **kwargs):
        """
        Wrapper to safely call detection methods with exception handling
        
        Prevents individual detector failures from crashing entire analysis
        Returns None if detector fails
        """
        try:
            return detector_func(*args, **kwargs)
        except Exception as e:
            detector_name = detector_func.__name__
            logger.warning(f"{detector_name} failed: {e}")
            return None
    
    def analyze_video(self, video_path: str) -> AnalysisResult:
        """
        Analyze video with all detection methods
        
        Returns AnalysisResult with individual detections and final verdict
        """
        cap = cv2.VideoCapture(video_path)
        if not cap.isOpened():
            logger.error(f"Cannot open video: {video_path}")
            return self._create_empty_result()
        
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = 0
        
        # Accumulate detections across frames
        glow_scores = []
        text_detections = []
        hand_motions = []
        object_detections = []
        
        logger.info(f"Analyzing video: {video_path}")
        
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            frame_count += 1
            
            # Sample every 5 frames for performance
            if frame_count % 5 != 0:
                continue
            
            # 1. Screen Glow Detection (every frame) - fail-safe wrapped
            glow_result = self._safe_detect(self._detect_screen_glow, frame)
            if glow_result:
                glow_scores.append(glow_result)
            
            # 2. Document/Text Detection (every 10 frames - expensive) - fail-safe wrapped
            if frame_count % 10 == 0:
                text_result = self._safe_detect(self._detect_document, frame)
                if text_result:
                    text_detections.append(text_result)
            
            # 3. Hand Motion Detection (every frame) - fail-safe wrapped
            hand_result = self._safe_detect(self._detect_hand_motion, frame)
            if hand_result:
                hand_motions.append(hand_result)
            
            # 4. Object Detection (every 10 frames - expensive) - fail-safe wrapped
            if frame_count % 10 == 0:
                object_result = self._safe_detect(self._detect_objects, frame)
                if object_result:
                    object_detections.extend(object_result)
        
        cap.release()
        
        logger.info(f"Processed {frame_count} frames")
        logger.info(f"Glow samples: {len(glow_scores)}, Text: {len(text_detections)}, Hand: {len(hand_motions)}, Objects: {len(object_detections)}")
        
        # Aggregate results and make decision
        return self._make_decision(glow_scores, text_detections, hand_motions, object_detections)
    
    def _detect_screen_glow(self, frame: np.ndarray) -> Optional[float]:
        """
        Detect phone screen glow in lap area
        Returns glow score (0-100) if detected
        """
        # Simple implementation: check bottom 1/3 of frame for bright regions
        h, w = frame.shape[:2]
        lap_region = frame[int(h * 0.6):, :]  # Bottom 40%
        
        # Convert to LAB color space
        lab = cv2.cvtColor(lap_region, cv2.COLOR_BGR2LAB)
        l_channel = lab[:, :, 0]
        
        # Check for bright regions (phone screen)
        bright_pixels = np.sum(l_channel > 200)
        total_pixels = l_channel.size
        bright_ratio = bright_pixels / total_pixels
        
        if bright_ratio > 0.05:  # 5% of lap area is very bright
            return bright_ratio * 100
        
        return None
    
    def _detect_document(self, frame: np.ndarray) -> Optional[str]:
        """
        Detect readable text in frame using OCR
        Returns detected text if significant text found
        
        Filters out legitimate exam text to avoid false positives
        """
        if not self.ocr_reader:
            return None
        
        try:
            # Run OCR
            results = self.ocr_reader.readtext(frame, detail=0)
            
            # Combine all detected text
            full_text = ' '.join(results)
            
            # Filter out noise (single characters, numbers)
            if len(full_text) >= self.TEXT_LENGTH_THRESHOLD:
                # Check if this is exam text (legitimate content on screen)
                full_text_lower = full_text.lower()
                is_exam_text = any(keyword in full_text_lower for keyword in self.EXAM_KEYWORDS)
                
                if is_exam_text:
                    logger.debug(f"Filtered out exam text: {full_text[:50]}...")
                    return None  # Legitimate exam content, not a violation
                
                logger.info(f"Detected suspicious text: {full_text[:100]}...")
                return full_text
        
        except Exception as e:
            logger.debug(f"OCR error: {e}")
        
        return None
    
    def _detect_hand_motion(self, frame: np.ndarray) -> Optional[str]:
        """
        Detect hand reaching motion using pose estimation
        Returns motion type: 'reaching_down', 'holding_object', 'typing'
        """
        if not self.mp_hands or not self.mp_pose:
            return None
        
        try:
            # Convert to RGB for MediaPipe
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Detect hands
            hand_results = self.mp_hands.process(frame_rgb)
            pose_results = self.mp_pose.process(frame_rgb)
            
            if not hand_results.multi_hand_landmarks:
                return None
            
            # Get hand position
            for hand_landmarks in hand_results.multi_hand_landmarks:
                # Check if hand is in lower region (reaching down)
                wrist = hand_landmarks.landmark[0]
                
                if wrist.y > 0.7:  # Bottom 30% of frame
                    return 'reaching_down'
                
                # Check if hand is holding something (fingers closed)
                thumb_tip = hand_landmarks.landmark[4]
                index_tip = hand_landmarks.landmark[8]
                distance = np.sqrt((thumb_tip.x - index_tip.x)**2 + (thumb_tip.y - index_tip.y)**2)
                
                if distance < 0.1:  # Fingers close together
                    return 'holding_object'
        
        except Exception as e:
            logger.debug(f"Hand detection error: {e}")
        
        return None
    
    def _detect_objects(self, frame: np.ndarray) -> List[str]:
        """
        Detect objects using YOLO
        Returns list of detected objects: ['phone', 'book', 'laptop']
        """
        if not self.yolo_model:
            return []
        
        try:
            # Run YOLO
            results = self.yolo_model(frame, verbose=False, conf=self.OBJECT_CONFIDENCE_THRESHOLD)
            
            detected = []
            
            for result in results:
                boxes = result.boxes
                if boxes is None:
                    continue
                
                for box in boxes:
                    class_id = int(box.cls[0])
                    class_name = self.yolo_model.names[class_id].lower()
                    
                    # Check for relevant objects
                    if 'phone' in class_name or 'cell' in class_name:
                        detected.append('phone')
                    elif 'book' in class_name:
                        detected.append('book')
                    elif 'laptop' in class_name or 'computer' in class_name:
                        detected.append('laptop')
                    elif 'paper' in class_name or 'notebook' in class_name:
                        detected.append('paper')
            
            return detected
        
        except Exception as e:
            logger.debug(f"YOLO detection error: {e}")
            return []
    
    def _make_decision(
        self,
        glow_scores: List[float],
        text_detections: List[str],
        hand_motions: List[str],
        object_detections: List[str]
    ) -> AnalysisResult:
        """
        Make final decision based on all detection signals
        
        Decision Logic:
        - ANY strong signal → CONFIRM violation
        - Multiple weak signals → CONFIRM violation
        - No signals or all weak → REJECT (false positive)
        """
        reasons = []
        confidence = 0
        
        # 1. Screen Glow Analysis
        screen_glow_detected = False
        screen_glow_score = 0
        if glow_scores:
            avg_glow = np.mean(glow_scores)
            max_glow = np.max(glow_scores)
            screen_glow_score = max_glow
            
            if max_glow > self.SCREEN_GLOW_THRESHOLD:
                screen_glow_detected = True
                confidence += 35
                reasons.append(f'Screen glow detected in lap area (score: {max_glow:.1f})')
        
        # 2. Document/Text Analysis
        document_detected = False
        document_confidence = 0
        detected_text = ''
        if text_detections:
            detected_text = ' | '.join(text_detections[:3])  # First 3 detections
            document_confidence = 90  # High confidence if OCR found text
            document_detected = True
            confidence += 40
            reasons.append(f'Document text detected: "{detected_text[:50]}..."')
        
        # 3. Hand Motion Analysis
        hand_motion_detected = False
        hand_motion_type = ''
        reaching_count = sum(1 for m in hand_motions if m == 'reaching_down')
        holding_count = sum(1 for m in hand_motions if m == 'holding_object')
        
        if reaching_count > 0:
            hand_motion_detected = True
            hand_motion_type = 'reaching_down'
            confidence += 25
            reasons.append(f'Hand reaching down detected ({reaching_count} frames)')
        elif holding_count > 2:
            hand_motion_detected = True
            hand_motion_type = 'holding_object'
            confidence += 20
            reasons.append(f'Hand holding object detected ({holding_count} frames)')
        
        # 4. Object Detection Analysis
        object_detected = False
        unique_objects = list(set(object_detections))
        
        if 'phone' in unique_objects:
            object_detected = True
            confidence += 50
            reasons.append('Phone object detected')
        elif 'book' in unique_objects or 'paper' in unique_objects:
            object_detected = True
            confidence += 30
            reasons.append(f'Document object detected: {", ".join(unique_objects)}')
        
        # Cap confidence at 100
        confidence = min(100, confidence)
        
        # Final decision
        is_violation_confirmed = confidence >= self.CONFIRM_THRESHOLD
        
        if not is_violation_confirmed and reasons:
            reasons.append('Confidence too low - treating as false positive')
        
        logger.info(f"Decision: CONFIRM={is_violation_confirmed}, Confidence={confidence}, Reasons={len(reasons)}")
        
        return AnalysisResult(
            screen_glow_detected=screen_glow_detected,
            screen_glow_score=screen_glow_score,
            document_detected=document_detected,
            document_confidence=document_confidence,
            detected_text=detected_text,
            hand_motion_detected=hand_motion_detected,
            hand_motion_type=hand_motion_type,
            object_detected=object_detected,
            detected_objects=unique_objects,
            is_violation_confirmed=is_violation_confirmed,
            confidence=confidence,
            reasons=reasons
        )
    
    def _create_empty_result(self) -> AnalysisResult:
        """Create empty result for error cases"""
        return AnalysisResult(
            screen_glow_detected=False,
            screen_glow_score=0,
            document_detected=False,
            document_confidence=0,
            detected_text='',
            hand_motion_detected=False,
            hand_motion_type='',
            object_detected=False,
            detected_objects=[],
            is_violation_confirmed=False,
            confidence=0,
            reasons=['Error processing video']
        )


if __name__ == '__main__':
    # Test analyzer
    analyzer = ComprehensiveAnalyzer()
    
    # Test with sample video
    test_video = 'test_video.webm'
    if __name__ == '__main__':
        result = analyzer.analyze_video(test_video)
        print(result.to_dict())
