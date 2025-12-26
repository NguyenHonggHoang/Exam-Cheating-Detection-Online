"""
Screen Glow Detector

Detects phone usage via lighting effects on face rather than object detection.
Uses LAB color space for skin-color independent analysis.

Features:
- Screen glow detection (chin vs forehead brightness)
- Eye reflection spike (specular highlights on glasses)
- Combined phone suspicion scoring
"""

import cv2
import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass


@dataclass
class FaceLandmarks:
    """Simplified face landmarks for region extraction"""
    chin_points: List[Tuple[int, int]]
    forehead_points: List[Tuple[int, int]]
    left_eye_box: Tuple[int, int, int, int]  # x, y, w, h
    right_eye_box: Tuple[int, int, int, int]


@dataclass
class GlowAnalysisResult:
    """Result from screen glow analysis"""
    chin_brightness: float
    forehead_brightness: float
    glow_ratio: float
    is_suspicious: bool
    
    def to_dict(self) -> Dict:
        return {
            "chin_brightness": self.chin_brightness,
            "forehead_brightness": self.forehead_brightness,
            "glow_ratio": self.glow_ratio,
            "is_suspicious": self.is_suspicious
        }


@dataclass
class EyeReflectionResult:
    """Result from eye reflection analysis"""
    left_reflection_ratio: float
    right_reflection_ratio: float
    total_reflection_ratio: float
    is_suspicious: bool
    
    def to_dict(self) -> Dict:
        return {
            "left_reflection_ratio": self.left_reflection_ratio,
            "right_reflection_ratio": self.right_reflection_ratio,
            "total_reflection_ratio": self.total_reflection_ratio,
            "is_suspicious": self.is_suspicious
        }


@dataclass
class PhoneSuspicionResult:
    """Combined phone suspicion result"""
    score: int  # 0-100
    is_phone_likely: bool
    glow: GlowAnalysisResult
    reflection: EyeReflectionResult
    reasons: List[str]
    
    def to_dict(self) -> Dict:
        return {
            "score": self.score,
            "is_phone_likely": self.is_phone_likely,
            "glow": self.glow.to_dict(),
            "reflection": self.reflection.to_dict(),
            "reasons": self.reasons
        }


class ScreenGlowDetector:
    """Detects phone usage by analyzing lighting effects on face"""
    
    # Thresholds
    GLOW_THRESHOLD = 1.2  # Chin 20% brighter than forehead = suspicious
    REFLECTION_THRESHOLD = 0.05  # 5% of eye area has specular highlight
    BRIGHTNESS_SPIKE_THRESHOLD = 30  # Sudden change in L channel
    SUSPICION_THRESHOLD = 60  # Combined score threshold
    
    def __init__(self):
        self.history: List[float] = []  # Glow ratio history for spike detection
        self.max_history_size = 30  # ~3 seconds at 10fps
    
    def create_mask(self, shape: Tuple[int, int], points: List[Tuple[int, int]]) -> np.ndarray:
        """Create binary mask from polygon points"""
        mask = np.zeros(shape[:2], dtype=np.uint8)
        if len(points) >= 3:
            pts = np.array(points, dtype=np.int32)
            cv2.fillPoly(mask, [pts], 255)
        return mask
    
    def analyze_lighting_anomaly(self, frame: np.ndarray, landmarks: FaceLandmarks) -> GlowAnalysisResult:
        """
        Analyze screen glow by comparing chin vs forehead brightness.
        Uses LAB color space for skin-color independent analysis.
        
        Phone from below = chin brighter than forehead
        Normal overhead light = forehead brighter or equal
        """
        # 1. Convert to LAB (L channel is lightness, independent of skin color)
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l_channel, _, _ = cv2.split(lab)
        
        # 2. Create masks for regions
        chin_mask = self.create_mask(frame.shape, landmarks.chin_points)
        forehead_mask = self.create_mask(frame.shape, landmarks.forehead_points)
        
        # 3. Get median intensity (robust to outliers/hotspots)
        chin_pixels = l_channel[chin_mask > 0]
        forehead_pixels = l_channel[forehead_mask > 0]
        
        if len(chin_pixels) == 0 or len(forehead_pixels) == 0:
            return GlowAnalysisResult(
                chin_brightness=0,
                forehead_brightness=0,
                glow_ratio=1.0,
                is_suspicious=False
            )
        
        chin_val = float(np.median(chin_pixels))
        forehead_val = float(np.median(forehead_pixels))
        
        # 4. Calculate glow ratio
        # Avoid division by zero
        glow_ratio = chin_val / (forehead_val + 1.0)
        
        # 5. Update history for spike detection
        self.history.append(glow_ratio)
        if len(self.history) > self.max_history_size:
            self.history.pop(0)
        
        # 6. Check suspicion
        # Normal: overhead light → forehead brighter → ratio < 1.0
        # Suspicious: phone below → chin brighter → ratio > 1.2
        is_suspicious = glow_ratio > self.GLOW_THRESHOLD
        
        return GlowAnalysisResult(
            chin_brightness=chin_val,
            forehead_brightness=forehead_val,
            glow_ratio=glow_ratio,
            is_suspicious=is_suspicious
        )
    
    def detect_eye_reflection(self, frame: np.ndarray, landmarks: FaceLandmarks) -> EyeReflectionResult:
        """
        Detect specular highlights in eye region (phone screen reflection).
        Uses RATIO of bright pixels to total eye area (robust to distance).
        
        Phone screen creates rectangular bright spots on glasses or cornea.
        """
        def analyze_eye(box: Tuple[int, int, int, int]) -> Tuple[float, int]:
            x, y, w, h = box
            # Ensure bounds
            x, y = max(0, x), max(0, y)
            x2, y2 = min(frame.shape[1], x + w), min(frame.shape[0], y + h)
            
            if x2 <= x or y2 <= y:
                return 0.0, 0
            
            eye_region = frame[y:y2, x:x2]
            if eye_region.size == 0:
                return 0.0, 0
            
            # Convert to grayscale
            gray = cv2.cvtColor(eye_region, cv2.COLOR_BGR2GRAY)
            
            # Find bright spots (specular highlights)
            _, thresh = cv2.threshold(gray, 240, 255, cv2.THRESH_BINARY)
            
            # Count bright pixels and calculate ratio
            bright_pixels = np.sum(thresh > 0)
            total_pixels = gray.size
            ratio = bright_pixels / total_pixels if total_pixels > 0 else 0
            
            return ratio, total_pixels
        
        left_ratio, left_area = analyze_eye(landmarks.left_eye_box)
        right_ratio, right_area = analyze_eye(landmarks.right_eye_box)
        
        # Average both eyes (weighted by area)
        total_area = left_area + right_area
        if total_area > 0:
            total_ratio = (left_ratio * left_area + right_ratio * right_area) / total_area
        else:
            total_ratio = 0
        
        # Check suspicion
        is_suspicious = total_ratio > self.REFLECTION_THRESHOLD
        
        return EyeReflectionResult(
            left_reflection_ratio=left_ratio,
            right_reflection_ratio=right_ratio,
            total_reflection_ratio=total_ratio,
            is_suspicious=is_suspicious
        )
    
    def is_sudden_change(self, current_ratio: float) -> bool:
        """Check if glow ratio changed suddenly (illumination spike)"""
        if len(self.history) < 5:
            return False
        
        recent_avg = np.mean(self.history[-5:])
        older_avg = np.mean(self.history[:-5]) if len(self.history) > 5 else recent_avg
        
        # Significant increase = potential phone turn on
        return (recent_avg - older_avg) > 0.3
    
    def analyze_phone_suspicion(
        self, 
        frame: np.ndarray, 
        landmarks: FaceLandmarks
    ) -> PhoneSuspicionResult:
        """
        Combined analysis for phone detection.
        Returns suspicion score 0-100.
        """
        glow = self.analyze_lighting_anomaly(frame, landmarks)
        reflection = self.detect_eye_reflection(frame, landmarks)
        
        # Calculate suspicion score
        score = 0
        reasons: List[str] = []
        
        if glow.is_suspicious:
            score += 40
            reasons.append(f"Screen glow detected (ratio: {glow.glow_ratio:.2f})")
        
        if reflection.is_suspicious:
            score += 35
            reasons.append(f"Eye reflection spike (ratio: {reflection.total_reflection_ratio:.3f})")
        
        # Check for sudden illumination change
        if self.is_sudden_change(glow.glow_ratio):
            score += 25
            reasons.append("Sudden illumination change")
        
        is_phone_likely = score >= self.SUSPICION_THRESHOLD
        
        return PhoneSuspicionResult(
            score=min(score, 100),
            is_phone_likely=is_phone_likely,
            glow=glow,
            reflection=reflection,
            reasons=reasons
        )


def extract_face_landmarks_from_mediapipe(
    landmarks: List[Dict], 
    frame_width: int, 
    frame_height: int
) -> FaceLandmarks:
    """
    Extract chin, forehead, and eye regions from MediaPipe Face Mesh landmarks.
    
    MediaPipe landmark indices:
    - Chin: 152, 377, 400, 378, 379, 365, 397, 288, 361, 323
    - Forehead: 10, 338, 297, 332, 284, 251, 389, 356, 454, 323
    - Left eye: around 33, 133 (corners)
    - Right eye: around 362, 263 (corners)
    """
    def get_point(idx: int) -> Tuple[int, int]:
        if idx < len(landmarks):
            return (
                int(landmarks[idx].get('x', 0) * frame_width),
                int(landmarks[idx].get('y', 0) * frame_height)
            )
        return (0, 0)
    
    # Chin region (lower face)
    chin_indices = [152, 377, 400, 378, 379, 365, 397, 288, 361, 323]
    chin_points = [get_point(i) for i in chin_indices if i < len(landmarks)]
    
    # Forehead region (upper face)
    forehead_indices = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323]
    forehead_points = [get_point(i) for i in forehead_indices if i < len(landmarks)]
    
    # Left eye bounding box
    left_eye_corners = [33, 133, 159, 145]
    left_xs = [get_point(i)[0] for i in left_eye_corners if i < len(landmarks)]
    left_ys = [get_point(i)[1] for i in left_eye_corners if i < len(landmarks)]
    if left_xs and left_ys:
        left_eye_box = (
            min(left_xs) - 5, min(left_ys) - 5,
            max(left_xs) - min(left_xs) + 10,
            max(left_ys) - min(left_ys) + 10
        )
    else:
        left_eye_box = (0, 0, 0, 0)
    
    # Right eye bounding box
    right_eye_corners = [362, 263, 386, 374]
    right_xs = [get_point(i)[0] for i in right_eye_corners if i < len(landmarks)]
    right_ys = [get_point(i)[1] for i in right_eye_corners if i < len(landmarks)]
    if right_xs and right_ys:
        right_eye_box = (
            min(right_xs) - 5, min(right_ys) - 5,
            max(right_xs) - min(right_xs) + 10,
            max(right_ys) - min(right_ys) + 10
        )
    else:
        right_eye_box = (0, 0, 0, 0)
    
    return FaceLandmarks(
        chin_points=chin_points,
        forehead_points=forehead_points,
        left_eye_box=left_eye_box,
        right_eye_box=right_eye_box
    )


# Singleton instance
screen_glow_detector = ScreenGlowDetector()


def analyze_frame_for_phone(
    frame: np.ndarray,
    landmarks: List[Dict],
    frame_width: int,
    frame_height: int
) -> Dict:
    """
    Main entry point for phone detection from video frame.
    
    Args:
        frame: BGR image from OpenCV
        landmarks: MediaPipe face mesh landmarks (list of {x, y, z} dicts)
        frame_width: Original frame width
        frame_height: Original frame height
    
    Returns:
        Phone suspicion result as dict
    """
    face_landmarks = extract_face_landmarks_from_mediapipe(
        landmarks, frame_width, frame_height
    )
    result = screen_glow_detector.analyze_phone_suspicion(frame, face_landmarks)
    return result.to_dict()
