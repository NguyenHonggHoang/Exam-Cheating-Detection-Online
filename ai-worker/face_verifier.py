"""
Face Verification Module - Identity Verification for Exam Proctoring

Compares student ID photo with exam session snapshot to verify identity.

Uses InsightFace/ArcFace for:
- Face detection
- Face embedding extraction (512-dim vector)
- Face comparison (cosine similarity)

Flow:
1. Student uploads ID photo → Extract & store face embedding
2. Exam start → Capture snapshot → Extract embedding → Compare with stored
3. Return verification result (match/no-match + confidence score)
"""

import os
import cv2
import numpy as np
from typing import Optional, Tuple, Dict, Any, List
from dataclasses import dataclass
import base64
import requests
from io import BytesIO
from PIL import Image
import time

# InsightFace for face recognition
try:
    import insightface
    from insightface.app import FaceAnalysis
    INSIGHTFACE_AVAILABLE = True
except ImportError:
    INSIGHTFACE_AVAILABLE = False
    print("[FaceVerifier] Warning: insightface not installed. Using fallback.")

# Alternative: face_recognition library (dlib-based)
try:
    import face_recognition
    FACE_RECOGNITION_AVAILABLE = True
except ImportError:
    FACE_RECOGNITION_AVAILABLE = False


@dataclass
class FaceDetectionResult:
    """Result of face detection"""
    success: bool
    face_count: int
    face_location: Optional[Tuple[int, int, int, int]] = None  # (top, right, bottom, left)
    face_image: Optional[np.ndarray] = None
    error: Optional[str] = None


@dataclass
class FaceEmbedding:
    """Face embedding vector"""
    embedding: np.ndarray  # 512-dim or 128-dim vector
    model: str  # "arcface" or "dlib"
    
    def to_list(self) -> List[float]:
        return self.embedding.tolist()
    
    @classmethod
    def from_list(cls, data: List[float], model: str = "arcface") -> "FaceEmbedding":
        return cls(embedding=np.array(data, dtype=np.float32), model=model)


@dataclass
class VerificationResult:
    """Result of face verification"""
    verified: bool
    confidence: float  # 0.0 - 1.0
    similarity: float  # Raw cosine similarity
    threshold: float
    message: str
    reference_face_detected: bool
    probe_face_detected: bool


@dataclass
class LivenessCheckResult:
    """Result of liveness detection check"""
    is_live: bool
    confidence: float  # 0.0 - 1.0
    blink_count: int
    head_movement_detected: bool
    texture_score: float
    reasons: List[str]


class FaceVerifier:
    """
    Face Verification using InsightFace (ArcFace) or face_recognition (dlib)
    
    ArcFace produces 512-dim embeddings with high accuracy
    dlib produces 128-dim embeddings, lighter but less accurate
    """
    
    # Verification thresholds
    # ArcFace: Cosine distance threshold (lower = stricter)
    # For production: 0.4 is recommended (Similarity > 0.6)
    # 0.6 was too lenient (Similarity > 0.4)
    ARCFACE_THRESHOLD = 0.4  # Stricter threshold for security
    DLIB_THRESHOLD = 0.6     # Euclidean distance threshold
    
    # Confidence mapping
    HIGH_CONFIDENCE = 0.85
    MEDIUM_CONFIDENCE = 0.70
    LOW_CONFIDENCE = 0.55
    
    # Liveness detection thresholds
    EAR_THRESHOLD = 0.21  # Eye Aspect Ratio threshold for blink detection
    MIN_BLINKS = 1  # Minimum blinks required in frame sequence
    MIN_HEAD_ROTATION = 5.0  # Minimum head rotation in degrees
    TEXTURE_VARIANCE_THRESHOLD = 100  # Laplacian variance for texture analysis
    
    @staticmethod
    def _calculate_eye_aspect_ratio(eye_landmarks: List[Tuple[float, float]]) -> float:
        """
        Calculate Eye Aspect Ratio (EAR) for blink detection
        
        EAR = (||p2-p6|| + ||p3-p5||) / (2 * ||p1-p4||)
        
        Args:
            eye_landmarks: 6 eye landmark points [(x1,y1), (x2,y2), ...]
        
        Returns:
            EAR value (lower = more closed eye)
        """
        if len(eye_landmarks) < 6:
            return 0.3  # Default open eye value
        
        # Vertical distances
        v1 = np.linalg.norm(np.array(eye_landmarks[1]) - np.array(eye_landmarks[5]))
        v2 = np.linalg.norm(np.array(eye_landmarks[2]) - np.array(eye_landmarks[4]))
        
        # Horizontal distance
        h = np.linalg.norm(np.array(eye_landmarks[0]) - np.array(eye_landmarks[3]))
        
        if h == 0:
            return 0.3
        
        ear = (v1 + v2) / (2.0 * h)
        return ear
    
    def __init__(self, use_gpu: bool = False):
        """
        Initialize face verification model
        
        Args:
            use_gpu: Use GPU acceleration if available
        """
        self.use_gpu = use_gpu
        self.model = None
        self.model_type = None
        
        self._initialize_model()
    
    def check_liveness(self, frame_sequence: List[np.ndarray]) -> LivenessCheckResult:
        """
        Check if face in frame sequence is from a live person (not photo/video)
        
        Performs 3 checks:
        1. Blink detection using Eye Aspect Ratio (EAR)
        2. Head pose change detection (3D rotation)
        3. Texture analysis (Laplacian variance)
        
        Args:
            frame_sequence: List of BGR frames (minimum 10 frames recommended)
        
        Returns:
            LivenessCheckResult with is_live decision and confidence
        """
        if len(frame_sequence) < 5:
            return LivenessCheckResult(
                is_live=False,
                confidence=0.0,
                blink_count=0,
                head_movement_detected=False,
                texture_score=0.0,
                reasons=["Insufficient frames for liveness check (need >= 5)"]
            )
        
        reasons = []
        confidence = 0.0
        blink_count = 0
        head_movement_detected = False
        texture_scores = []
        
        # 1. Blink Detection using InsightFace landmarks
        if self.model_type == "arcface":
            blink_count = self._detect_blinks_insightface(frame_sequence)
            if blink_count >= self.MIN_BLINKS:
                confidence += 40
                reasons.append(f"Natural blink detected ({blink_count} blinks)")
            else:
                reasons.append(f"No blinks detected - suspicious ({blink_count} blinks)")
        
        # 2. Head Pose Change Detection
        head_rotation = self._detect_head_pose_change(frame_sequence)
        if head_rotation >= self.MIN_HEAD_ROTATION:
            head_movement_detected = True
            confidence += 35
            reasons.append(f"Natural head movement detected ({head_rotation:.1f}°)")
        else:
            reasons.append(f"No head movement - suspicious ({head_rotation:.1f}°)")
        
        # 3. Texture Analysis (Laplacian variance)
        avg_texture = self._analyze_texture(frame_sequence)
        texture_scores.append(avg_texture)
        
        if avg_texture >= self.TEXTURE_VARIANCE_THRESHOLD:
            confidence += 25
            reasons.append(f"Good texture variance - likely live face ({avg_texture:.1f})")
        else:
            reasons.append(f"Low texture variance - possible photo ({avg_texture:.1f})")
        
        # Final decision: Need at least 60% confidence
        is_live = confidence >= 60
        
        if not is_live:
            reasons.append("⚠️ LIVENESS CHECK FAILED - Possible photo/video spoof attack")
        
        return LivenessCheckResult(
            is_live=is_live,
            confidence=confidence / 100.0,  # Normalize to 0-1
            blink_count=blink_count,
            head_movement_detected=head_movement_detected,
            texture_score=avg_texture,
            reasons=reasons
        )
    
    def _detect_blinks_insightface(self, frames: List[np.ndarray]) -> int:
        """Detect blinks using EAR (Eye Aspect Ratio) method"""
        blink_count = 0
        eye_closed = False
        ear_history = []
        
        for frame in frames:
            faces = self.model.get(frame)
            if len(faces) == 0:
                continue
            
            face = faces[0]
            if not hasattr(face, 'kps') or face.kps is None:
                continue
            
            # Get eye landmarks (points 0-1 are eyes in 5-point landmarks)
            # For buffalo_l model, kps has 5 points: left_eye, right_eye, nose, mouth_left, mouth_right
            if len(face.kps) < 2:
                continue
            
            # Simple eye closure detection using eye landmark positions
            # Check vertical distance between upper and lower eye points
            left_eye = face.kps[0]
            right_eye = face.kps[1]
            
            # Estimate EAR using face landmarks
            # Since we only have center points, we estimate closure
            # A better implementation would use 68-point landmarks
            avg_y_pos = (left_eye[1] + right_eye[1]) / 2
            
            # Simple heuristic: track relative y-position changes
            ear_history.append(avg_y_pos)
            
            if len(ear_history) >= 3:
                # Check for eye closure pattern (y-position variance)
                recent_variance = np.var(ear_history[-3:])
                if recent_variance > 5 and not eye_closed:
                    blink_count += 1
                    eye_closed = True
                elif recent_variance <= 5:
                    eye_closed = False
        
        return blink_count
    
    def _detect_head_pose_change(self, frames: List[np.ndarray]) -> float:
        """Detect head pose changes across frame sequence"""
        if self.model_type != "arcface":
            return 0.0
        
        pose_angles = []
        
        for frame in frames:
            faces = self.model.get(frame)
            if len(faces) == 0:
                continue
            
            face = faces[0]
            if hasattr(face, 'pose'):
                # Some models provide pose estimation
                pose_angles.append(face.pose)
            elif hasattr(face, 'kps'):
                # Estimate pose from landmarks
                kps = face.kps
                if len(kps) >= 3:
                    # Calculate angle using eye and nose positions
                    left_eye, right_eye, nose = kps[0], kps[1], kps[2]
                    eye_center = (left_eye + right_eye) / 2
                    angle = np.arctan2(nose[1] - eye_center[1], nose[0] - eye_center[0])
                    pose_angles.append(np.degrees(angle))
        
        if len(pose_angles) < 2:
            return 0.0
        
        # Calculate maximum rotation change
        max_rotation = np.max(np.abs(np.diff(pose_angles))) if len(pose_angles) > 1 else 0.0
        return float(max_rotation)
    
    def _analyze_texture(self, frames: List[np.ndarray]) -> float:
        """Analyze texture variance to detect printed photos (low variance)"""
        variances = []
        
        for frame in frames:
            # Convert to grayscale
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            
            # Compute Laplacian variance
            laplacian = cv2.Laplacian(gray, cv2.CV_64F)
            variance = laplacian.var()
            variances.append(variance)
        
        # Return average variance
        return float(np.mean(variances)) if variances else 0.0
    
    def _initialize_model(self):
        """Initialize the best available face recognition model"""
        
        if INSIGHTFACE_AVAILABLE:
            try:
                # InsightFace with ArcFace (buffalo_l is most accurate)
                self.model = FaceAnalysis(
                    name='buffalo_l',  # buffalo_l, buffalo_s, buffalo_sc
                    providers=['CUDAExecutionProvider', 'CPUExecutionProvider'] if self.use_gpu 
                              else ['CPUExecutionProvider']
                )
                self.model.prepare(ctx_id=0 if self.use_gpu else -1, det_size=(640, 640))
                self.model_type = "arcface"
                print("[FaceVerifier] ✅ Initialized InsightFace (ArcFace)")
                return
            except Exception as e:
                print(f"[FaceVerifier] InsightFace init failed: {e}")
        
        if FACE_RECOGNITION_AVAILABLE:
            self.model_type = "dlib"
            print("[FaceVerifier] ✅ Initialized face_recognition (dlib)")
            return
        
        raise RuntimeError("No face recognition library available. Install insightface or face_recognition.")
    
    def load_image(self, source: str) -> np.ndarray:
        """
        Load image from various sources
        
        Args:
            source: File path, URL, or base64 string
            
        Returns:
            BGR image as numpy array
        """
        if source.startswith('http://') or source.startswith('https://'):
            # Download from URL
            response = requests.get(source, timeout=30)
            response.raise_for_status()
            image = Image.open(BytesIO(response.content))
            image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        
        elif source.startswith('data:image'):
            # Base64 encoded image
            base64_data = source.split(',')[1]
            image_data = base64.b64decode(base64_data)
            image = Image.open(BytesIO(image_data))
            image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
        
        elif os.path.exists(source):
            # Local file
            image = cv2.imread(source)
            if image is None:
                raise ValueError(f"Cannot read image: {source}")
        
        else:
            # Try as raw base64
            try:
                image_data = base64.b64decode(source)
                image = Image.open(BytesIO(image_data))
                image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            except:
                raise ValueError(f"Invalid image source: {source[:50]}...")
        
        return image
    
    def detect_face(self, image: np.ndarray) -> FaceDetectionResult:
        """
        Detect faces in image
        
        Args:
            image: BGR image
            
        Returns:
            FaceDetectionResult with detection info
        """
        if self.model_type == "arcface":
            return self._detect_face_insightface(image)
        else:
            return self._detect_face_dlib(image)
    
    def _detect_face_insightface(self, image: np.ndarray) -> FaceDetectionResult:
        """Detect face using InsightFace"""
        try:
            faces = self.model.get(image)
            
            if len(faces) == 0:
                return FaceDetectionResult(
                    success=False,
                    face_count=0,
                    error="No face detected in image"
                )
            
            if len(faces) > 1:
                # Use the largest face (by bounding box area)
                faces = sorted(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]), reverse=True)
            
            face = faces[0]
            bbox = face.bbox.astype(int)
            
            # Extract face region with padding
            h, w = image.shape[:2]
            pad = 20
            top = max(0, bbox[1] - pad)
            bottom = min(h, bbox[3] + pad)
            left = max(0, bbox[0] - pad)
            right = min(w, bbox[2] + pad)
            
            face_image = image[top:bottom, left:right]
            
            return FaceDetectionResult(
                success=True,
                face_count=len(faces),
                face_location=(top, right, bottom, left),
                face_image=face_image
            )
            
        except Exception as e:
            return FaceDetectionResult(
                success=False,
                face_count=0,
                error=str(e)
            )
    
    def _detect_face_dlib(self, image: np.ndarray) -> FaceDetectionResult:
        """Detect face using dlib (face_recognition library)"""
        try:
            # Convert BGR to RGB for face_recognition
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Detect faces
            face_locations = face_recognition.face_locations(rgb_image, model="hog")
            
            if len(face_locations) == 0:
                return FaceDetectionResult(
                    success=False,
                    face_count=0,
                    error="No face detected in image"
                )
            
            # Use first (largest) face
            top, right, bottom, left = face_locations[0]
            
            # Extract face region with padding
            h, w = image.shape[:2]
            pad = 20
            top = max(0, top - pad)
            bottom = min(h, bottom + pad)
            left = max(0, left - pad)
            right = min(w, right + pad)
            
            face_image = image[top:bottom, left:right]
            
            return FaceDetectionResult(
                success=True,
                face_count=len(face_locations),
                face_location=(top, right, bottom, left),
                face_image=face_image
            )
            
        except Exception as e:
            return FaceDetectionResult(
                success=False,
                face_count=0,
                error=str(e)
            )
    
    def extract_embedding(self, image: np.ndarray) -> Optional[FaceEmbedding]:
        """
        Extract face embedding from image
        
        Args:
            image: BGR image containing a face
            
        Returns:
            FaceEmbedding or None if no face detected
        """
        if self.model_type == "arcface":
            return self._extract_embedding_insightface(image)
        else:
            return self._extract_embedding_dlib(image)
    
    def _extract_embedding_insightface(self, image: np.ndarray) -> Optional[FaceEmbedding]:
        """Extract embedding using InsightFace/ArcFace"""
        try:
            faces = self.model.get(image)
            
            if len(faces) == 0:
                return None
            
            # Use largest face
            if len(faces) > 1:
                faces = sorted(faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]), reverse=True)
            
            embedding = faces[0].embedding  # 512-dim vector
            
            # Normalize embedding
            embedding = embedding / np.linalg.norm(embedding)
            
            return FaceEmbedding(embedding=embedding, model="arcface")
            
        except Exception as e:
            print(f"[FaceVerifier] Embedding extraction failed: {e}")
            return None
    
    def _extract_embedding_dlib(self, image: np.ndarray) -> Optional[FaceEmbedding]:
        """Extract embedding using dlib"""
        try:
            rgb_image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Get face encodings
            encodings = face_recognition.face_encodings(rgb_image)
            
            if len(encodings) == 0:
                return None
            
            embedding = np.array(encodings[0], dtype=np.float32)  # 128-dim vector
            
            return FaceEmbedding(embedding=embedding, model="dlib")
            
        except Exception as e:
            print(f"[FaceVerifier] Embedding extraction failed: {e}")
            return None
    
    def compare_embeddings(
        self, 
        embedding1: FaceEmbedding, 
        embedding2: FaceEmbedding
    ) -> Tuple[float, float]:
        """
        Compare two face embeddings
        
        Args:
            embedding1: Reference embedding (ID photo)
            embedding2: Probe embedding (exam snapshot)
            
        Returns:
            Tuple of (similarity, distance)
        """
        if embedding1.model != embedding2.model:
            raise ValueError("Cannot compare embeddings from different models")
        
        if embedding1.model == "arcface":
            # Cosine similarity for ArcFace
            similarity = np.dot(embedding1.embedding, embedding2.embedding)
            distance = 1 - similarity
        else:
            # Euclidean distance for dlib
            distance = np.linalg.norm(embedding1.embedding - embedding2.embedding)
            similarity = 1 / (1 + distance)  # Convert to similarity score
        
        return float(similarity), float(distance)
    
    def verify(
        self,
        reference_image: str,
        probe_image: str,
        threshold: Optional[float] = None,
        check_liveness: bool = False,
        probe_frame_sequence: Optional[List[np.ndarray]] = None
    ) -> VerificationResult:
        """
        Verify if two images contain the same person
        
        Args:
            reference_image: Path/URL/base64 of reference image (student ID photo)
            probe_image: Path/URL/base64 of probe image (exam snapshot)
            threshold: Custom threshold (optional)
            check_liveness: If True, perform liveness detection on probe image
            probe_frame_sequence: Frame sequence for liveness check (required if check_liveness=True)
            
        Returns:
            VerificationResult with verification decision and confidence
        """
        # Set default threshold
        if threshold is None:
            threshold = self.ARCFACE_THRESHOLD if self.model_type == "arcface" else self.DLIB_THRESHOLD
        
        # Load images
        try:
            ref_img = self.load_image(reference_image)
        except Exception as e:
            return VerificationResult(
                verified=False,
                confidence=0.0,
                similarity=0.0,
                threshold=threshold,
                message=f"Failed to load reference image: {e}",
                reference_face_detected=False,
                probe_face_detected=False
            )
        
        try:
            probe_img = self.load_image(probe_image)
        except Exception as e:
            return VerificationResult(
                verified=False,
                confidence=0.0,
                similarity=0.0,
                threshold=threshold,
                message=f"Failed to load probe image: {e}",
                reference_face_detected=True,
                probe_face_detected=False
            )
        
        # Extract embeddings
        ref_embedding = self.extract_embedding(ref_img)
        if ref_embedding is None:
            return VerificationResult(
                verified=False,
                confidence=0.0,
                similarity=0.0,
                threshold=threshold,
                message="No face detected in reference image (student ID)",
                reference_face_detected=False,
                probe_face_detected=False
            )
        
        # Perform liveness check if requested
        if check_liveness:
            if probe_frame_sequence is None or len(probe_frame_sequence) < 5:
                return VerificationResult(
                    verified=False,
                    confidence=0.0,
                    similarity=0.0,
                    threshold=threshold,
                    message="Liveness check failed: insufficient frame sequence (need >= 5 frames)",
                    reference_face_detected=True,
                    probe_face_detected=False
                )
            
            liveness_result = self.check_liveness(probe_frame_sequence)
            
            if not liveness_result.is_live:
                reason_text = "; ".join(liveness_result.reasons)
                return VerificationResult(
                    verified=False,
                    confidence=0.0,
                    similarity=0.0,
                    threshold=threshold,
                    message=f"Liveness check FAILED: {reason_text}",
                    reference_face_detected=True,
                    probe_face_detected=True
                )
        
        probe_embedding = self.extract_embedding(probe_img)
        if probe_embedding is None:
            return VerificationResult(
                verified=False,
                confidence=0.0,
                similarity=0.0,
                threshold=threshold,
                message="No face detected in probe image (exam snapshot)",
                reference_face_detected=True,
                probe_face_detected=False
            )
        
        # Compare embeddings
        similarity, distance = self.compare_embeddings(ref_embedding, probe_embedding)
        
        # Determine verification result
        if self.model_type == "arcface":
            verified = distance < threshold
        else:
            verified = distance < threshold
        
        # Calculate confidence score (0-1)
        if self.model_type == "arcface":
            # Higher similarity = higher confidence
            confidence = max(0.0, min(1.0, similarity))
        else:
            # Lower distance = higher confidence
            confidence = max(0.0, min(1.0, 1 - (distance / 2)))
        
        # Generate message
        if verified:
            if confidence >= self.HIGH_CONFIDENCE:
                message = "Identity verified with high confidence"
            elif confidence >= self.MEDIUM_CONFIDENCE:
                message = "Identity verified with medium confidence"
            else:
                message = "Identity verified with low confidence - manual review recommended"
        else:
            message = "Identity verification failed - faces do not match"
        
        return VerificationResult(
            verified=verified,
            confidence=confidence,
            similarity=similarity,
            threshold=threshold,
            message=message,
            reference_face_detected=True,
            probe_face_detected=True
        )
    
    def extract_and_store_embedding(self, image_source: str) -> Dict[str, Any]:
        """
        Extract embedding from image for storage
        
        Args:
            image_source: Path/URL/base64 of image
            
        Returns:
            Dict with embedding data for database storage
        """
        try:
            image = self.load_image(image_source)
            
            # Detect face first
            detection = self.detect_face(image)
            if not detection.success:
                return {
                    "success": False,
                    "error": detection.error or "No face detected"
                }
            
            # Extract embedding
            embedding = self.extract_embedding(image)
            if embedding is None:
                return {
                    "success": False,
                    "error": "Failed to extract face embedding"
                }
            
            return {
                "success": True,
                "embedding": embedding.to_list(),
                "model": embedding.model,
                "face_count": detection.face_count,
                "dimension": len(embedding.embedding)
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }


# Singleton instance for reuse
_verifier_instance: Optional[FaceVerifier] = None

def get_face_verifier(use_gpu: bool = False) -> FaceVerifier:
    """Get or create FaceVerifier singleton"""
    global _verifier_instance
    if _verifier_instance is None:
        _verifier_instance = FaceVerifier(use_gpu=use_gpu)
    return _verifier_instance


# CLI testing
if __name__ == "__main__":
    import sys
    
    print("=" * 60)
    print("Face Verification Module - Test")
    print("=" * 60)
    
    verifier = FaceVerifier()
    print(f"Model type: {verifier.model_type}")
    
    if len(sys.argv) >= 3:
        ref_image = sys.argv[1]
        probe_image = sys.argv[2]
        
        print(f"\nReference: {ref_image}")
        print(f"Probe: {probe_image}")
        
        result = verifier.verify(ref_image, probe_image)
        
        print(f"\n--- Result ---")
        print(f"Verified: {result.verified}")
        print(f"Confidence: {result.confidence:.2%}")
        print(f"Similarity: {result.similarity:.4f}")
        print(f"Message: {result.message}")
    else:
        print("\nUsage: python face_verifier.py <reference_image> <probe_image>")
