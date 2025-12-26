"""
Face Verification Worker - RabbitMQ Consumer
Handles identity verification requests

Queue: face.verification (consume)
Queue: face.verification.result (publish)
"""

import os
import json
import time
import pika
import traceback
from datetime import datetime
from typing import Dict, Any

from face_verifier import get_face_verifier, FaceVerifier

# Configuration
RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'localhost')
RABBITMQ_PORT = int(os.getenv('RABBITMQ_PORT', '5672'))
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'guest')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS', 'guest')

# MinIO Configuration
MINIO_ENDPOINT = os.getenv('MINIO_ENDPOINT', 'http://localhost:9000')
MINIO_ACCESS_KEY = os.getenv('MINIO_ACCESS_KEY', 'minioadmin')
MINIO_SECRET_KEY = os.getenv('MINIO_SECRET_KEY', 'minioadmin123')
MINIO_BUCKET = os.getenv('MINIO_BUCKET', 'exam-evidence')

# Queues
CONSUME_QUEUE = 'face.verification'
RESULT_QUEUE = 'face.verification.result'

# Thresholds
VERIFICATION_THRESHOLD = float(os.getenv('FACE_VERIFICATION_THRESHOLD', '0.4'))
USE_GPU = os.getenv('USE_GPU', 'false').lower() == 'true'


class FaceVerificationWorker:
    """
    Worker that processes face verification requests
    
    Flow:
    1. Receive verification request (reference URL, probe URL, session ID)
    2. Download images from MinIO
    3. Run face verification
    4. Publish result to result queue
    """
    
    def __init__(self):
        self.verifier: FaceVerifier = None
        self.connection = None
        self.channel = None
        
        print(f"[FaceWorker] Initializing...")
        print(f"[FaceWorker] RabbitMQ: {RABBITMQ_HOST}:{RABBITMQ_PORT}")
        print(f"[FaceWorker] MinIO: {MINIO_ENDPOINT}")
    
    def connect(self):
        """Connect to RabbitMQ"""
        print(f"[FaceWorker] Connecting to RabbitMQ...")
        
        credentials = pika.PlainCredentials(RABBITMQ_USER, RABBITMQ_PASS)
        parameters = pika.ConnectionParameters(
            host=RABBITMQ_HOST,
            port=RABBITMQ_PORT,
            credentials=credentials,
            heartbeat=600,
            blocked_connection_timeout=300
        )
        
        self.connection = pika.BlockingConnection(parameters)
        self.channel = self.connection.channel()
        
        # Declare queues
        self.channel.queue_declare(queue=CONSUME_QUEUE, durable=True)
        self.channel.queue_declare(queue=RESULT_QUEUE, durable=True)
        
        # QoS: Process one at a time (face verification is CPU-intensive)
        self.channel.basic_qos(prefetch_count=1)
        
        print(f"[FaceWorker] ✅ Connected to RabbitMQ")
    
    def load_model(self):
        """Load face verification model"""
        print(f"[FaceWorker] Loading face verification model (GPU: {USE_GPU})...")
        self.verifier = get_face_verifier(use_gpu=USE_GPU)
        print(f"[FaceWorker] ✅ Model loaded: {self.verifier.model_type}")
    
    def process_message(self, ch, method, properties, body):
        """Process incoming verification request"""
        start_time = time.time()
        
        try:
            message = json.loads(body.decode('utf-8'))
            
            # Handle double-encoded JSON from Spring's Jackson converter
            # If message is still a string, parse again
            if isinstance(message, str):
                print(f"[FaceWorker] Double-encoded message detected, parsing again...")
                message = json.loads(message)
            
            session_id = message.get('sessionId')
            user_id = message.get('userId')
            reference_url = message.get('referenceUrl')  # Student ID photo
            probe_url = message.get('probeUrl')  # Exam snapshot
            request_id = message.get('requestId')
            
            print(f"\n[FaceWorker] Processing verification request:")
            print(f"  Session: {session_id}")
            print(f"  User: {user_id}")
            print(f"  Reference: {reference_url[:80] if reference_url else 'None'}...")
            print(f"  Probe: {probe_url[:80] if probe_url else 'None'}...")
            
            # Validate inputs
            if not reference_url or not probe_url:
                result = self._create_error_result(
                    session_id, user_id, request_id,
                    "Missing reference or probe image URL"
                )
            else:
                # Run verification
                verification = self.verifier.verify(
                    reference_image=reference_url,
                    probe_image=probe_url,
                    threshold=VERIFICATION_THRESHOLD
                )
                
                result = {
                    "sessionId": session_id,
                    "userId": user_id,
                    "requestId": request_id,
                    "verified": verification.verified,
                    "confidence": verification.confidence,
                    "similarity": verification.similarity,
                    "threshold": verification.threshold,
                    "message": verification.message,
                    "referenceFaceDetected": verification.reference_face_detected,
                    "probeFaceDetected": verification.probe_face_detected,
                    "timestamp": datetime.utcnow().isoformat(),
                    "processingTimeMs": int((time.time() - start_time) * 1000)
                }
            
            # Publish result
            self._publish_result(result)
            
            # Acknowledge message
            ch.basic_ack(delivery_tag=method.delivery_tag)
            
            elapsed = time.time() - start_time
            print(f"[FaceWorker] ✅ Processed in {elapsed:.2f}s - Verified: {result.get('verified')}")
            
        except json.JSONDecodeError as e:
            print(f"[FaceWorker] ❌ Invalid JSON: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
            
        except Exception as e:
            print(f"[FaceWorker] ❌ Error: {e}")
            traceback.print_exc()
            
            # Try to publish error result
            try:
                message = json.loads(body.decode('utf-8'))
                error_result = self._create_error_result(
                    message.get('sessionId'),
                    message.get('userId'),
                    message.get('requestId'),
                    str(e)
                )
                self._publish_result(error_result)
            except:
                pass
            
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    
    def _create_error_result(
        self, 
        session_id: str, 
        user_id: str, 
        request_id: str,
        error: str
    ) -> Dict[str, Any]:
        """Create error result"""
        return {
            "sessionId": session_id,
            "userId": user_id,
            "requestId": request_id,
            "verified": False,
            "confidence": 0.0,
            "similarity": 0.0,
            "threshold": VERIFICATION_THRESHOLD,
            "message": f"Verification failed: {error}",
            "error": error,
            "referenceFaceDetected": False,
            "probeFaceDetected": False,
            "timestamp": datetime.utcnow().isoformat()
        }
    
    def _publish_result(self, result: Dict[str, Any]):
        """Publish verification result"""
        self.channel.basic_publish(
            exchange='',
            routing_key=RESULT_QUEUE,
            body=json.dumps(result),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Persistent
                content_type='application/json'
            )
        )
        print(f"[FaceWorker] Published result to {RESULT_QUEUE}")
    
    def start_consuming(self):
        """Start consuming messages"""
        print(f"[FaceWorker] 🚀 Starting to consume from {CONSUME_QUEUE}")
        print(f"[FaceWorker] Waiting for verification requests...")
        
        self.channel.basic_consume(
            queue=CONSUME_QUEUE,
            on_message_callback=self.process_message
        )
        
        try:
            self.channel.start_consuming()
        except KeyboardInterrupt:
            print("\n[FaceWorker] Shutting down...")
            self.channel.stop_consuming()
        finally:
            if self.connection:
                self.connection.close()
    
    def run(self):
        """Main entry point"""
        self.connect()
        self.load_model()
        self.start_consuming()


# Synchronous verification API for direct calls
def verify_faces_sync(
    reference_url: str,
    probe_url: str,
    threshold: float = VERIFICATION_THRESHOLD
) -> Dict[str, Any]:
    """
    Synchronous face verification (for API endpoints)
    
    Args:
        reference_url: URL/path to reference image (student ID)
        probe_url: URL/path to probe image (exam snapshot)
        threshold: Verification threshold
        
    Returns:
        Dict with verification result
    """
    verifier = get_face_verifier(use_gpu=USE_GPU)
    
    start_time = time.time()
    
    try:
        result = verifier.verify(reference_url, probe_url, threshold)
        
        return {
            "verified": result.verified,
            "confidence": result.confidence,
            "similarity": result.similarity,
            "threshold": result.threshold,
            "message": result.message,
            "referenceFaceDetected": result.reference_face_detected,
            "probeFaceDetected": result.probe_face_detected,
            "processingTimeMs": int((time.time() - start_time) * 1000)
        }
        
    except Exception as e:
        return {
            "verified": False,
            "confidence": 0.0,
            "similarity": 0.0,
            "threshold": threshold,
            "message": f"Verification error: {str(e)}",
            "error": str(e),
            "referenceFaceDetected": False,
            "probeFaceDetected": False,
            "processingTimeMs": int((time.time() - start_time) * 1000)
        }


def extract_embedding_sync(image_url: str) -> Dict[str, Any]:
    """
    Extract face embedding for storage (for API endpoints)
    
    Args:
        image_url: URL/path to image
        
    Returns:
        Dict with embedding data
    """
    verifier = get_face_verifier(use_gpu=USE_GPU)
    return verifier.extract_and_store_embedding(image_url)


if __name__ == "__main__":
    worker = FaceVerificationWorker()
    worker.run()
