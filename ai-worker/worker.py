"""
Person Count Worker - RabbitMQ Consumer

SIMPLIFIED: Only counts people in video clips.
Does NOT detect objects (phone/headphone/book) - those require custom trained YOLO models.

For phone detection, use pre_suspicion_worker.py with screen_glow_detector instead.

Queue: video.analysis (consume) - Filter by requestedAnalysis='PERSON_COUNT'
Queue: ai.violations (publish)
"""

import os
import sys
import json
import time
import pika
import tempfile
import traceback
from datetime import datetime
from typing import Dict, Any

from video_analyzer import PersonCounter, download_video

# Configuration
RABBITMQ_HOST = os.getenv('RABBITMQ_HOST', 'localhost')
RABBITMQ_PORT = int(os.getenv('RABBITMQ_PORT', '5672'))
RABBITMQ_USER = os.getenv('RABBITMQ_USER', 'guest')
RABBITMQ_PASS = os.getenv('RABBITMQ_PASS', 'guest')

# MinIO Configuration
MINIO_ENDPOINT = os.getenv('MINIO_ENDPOINT', 'http://localhost:9000')

# Queues
CONSUME_QUEUE = 'video.analysis'
PUBLISH_QUEUE = 'ai.violations'

# YOLO model
MODEL_PATH = os.getenv('YOLO_MODEL_PATH', 'yolov8n.pt')
CONFIDENCE_THRESHOLD = float(os.getenv('CONFIDENCE_THRESHOLD', '0.6'))  # Higher threshold for person detection


class PersonCountWorker:
    """
    Person Count Worker - processes video clips to detect multiple people
    
    Flow:
    1. Consume message from video.analysis queue (requestedAnalysis='PERSON_COUNT')
    2. Download video from MinIO
    3. Count people with YOLO
    4. Publish MULTIPLE_PEOPLE violation if detected
    """
    
    def __init__(self):
        self.counter = None
        self.connection = None
        self.channel = None
        self.temp_dir = tempfile.mkdtemp(prefix='person_count_worker_')
        
        print(f"[PersonCountWorker] Temp directory: {self.temp_dir}")
    
    def connect(self):
        """Connect to RabbitMQ"""
        print(f"[PersonCountWorker] Connecting to RabbitMQ at {RABBITMQ_HOST}:{RABBITMQ_PORT}")
        
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
        
        # Declare exchange (topic type for routing)
        self.channel.exchange_declare(
            exchange='exam.events',
            exchange_type='topic',
            durable=True
        )
        
        # Declare queues
        self.channel.queue_declare(queue=CONSUME_QUEUE, durable=True)
        self.channel.queue_declare(queue=PUBLISH_QUEUE, durable=True)
        
        # Bind ai.violations queue to exchange with routing key
        self.channel.queue_bind(
            queue=PUBLISH_QUEUE,
            exchange='exam.events',
            routing_key='ai.violation.detected'
        )
        
        # QoS: Process one message at a time
        self.channel.basic_qos(prefetch_count=1)
        
        print(f"[PersonCountWorker] Connected to RabbitMQ")
    
    def load_model(self):
        """Load YOLO model"""
        print(f"[PersonCountWorker] Loading YOLO model: {MODEL_PATH}")
        self.counter = PersonCounter(
            model_path=MODEL_PATH,
            confidence_threshold=CONFIDENCE_THRESHOLD
        )
        print(f"[PersonCountWorker] Model loaded successfully")
    
    def process_message(self, ch, method, properties, body):
        """Process incoming video analysis message"""
        start_time = time.time()
        
        try:
            # Parse message
            message = json.loads(body.decode('utf-8'))
            
            session_id = message.get('sessionId')
            requested_analysis = message.get('requestedAnalysis', 'PERSON_COUNT')
            public_url = message.get('publicUrl')
            initial_violation = message.get('violationType')
            timestamp = message.get('timestamp')
            
            # Filter: Only process PERSON_COUNT requests (others handled by pre_suspicion_worker)
            if requested_analysis != 'PERSON_COUNT':
                print(f"[PersonCountWorker] Skipping message - requestedAnalysis: {requested_analysis}")
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return
            
            print(f"\n[PersonCountWorker] Processing person count:")
            print(f"  Session: {session_id}")
            print(f"  URL: {public_url}")
            
            # Download video (with MinIO endpoint for Docker network URL conversion)
            video_path = download_video(public_url, self.temp_dir, minio_endpoint=MINIO_ENDPOINT)
            
            # Count people in video
            result = self.counter.analyze_video(video_path)
            
            # Clean up temp file
            try:
                os.remove(video_path)
            except:
                pass
            
            # Process violations
            violations = result.get('violations', [])
            
            print(f"[PersonCountWorker] Analysis complete: {len(violations)} violations found")
            
            # Publish MULTIPLE_PEOPLE violations
            for violation in violations:
                if violation['type'] == 'MULTIPLE_PEOPLE':
                    self._publish_violation(
                        session_id=session_id,
                        violation_type=violation['type'],
                        confidence=violation['confidence'],
                        evidence_url=public_url,
                        details=violation
                    )
            
            # Acknowledge message
            ch.basic_ack(delivery_tag=method.delivery_tag)
            
            elapsed = time.time() - start_time
            print(f"[PersonCountWorker] Message processed in {elapsed:.2f}s")
            
        except Exception as e:
            print(f"[PersonCountWorker] Error processing message: {e}")
            traceback.print_exc()
            
            # Reject and requeue on error (with limit)
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    
    def _publish_violation(self, session_id: str, violation_type: str, 
                          confidence: float, evidence_url: str, details: Dict = None):
        """Publish violation to ai.violations queue via exam.events exchange"""
        
        message = {
            'session_id': session_id,
            'timestamp': int(time.time() * 1000),
            'violation_type': violation_type,
            'confidence': confidence,
            'evidence_url': evidence_url,
            'source': 'PERSON_COUNT_WORKER',
            'details': details or {}
        }
        
        # Publish to exam.events exchange with routing key
        # The queue is bound with 'ai.violation.detected' routing key
        self.channel.basic_publish(
            exchange='exam.events',
            routing_key='ai.violation.detected',
            body=json.dumps(message),
            properties=pika.BasicProperties(
                delivery_mode=2,  # Persistent
                content_type='application/json'
            )
        )
        
        print(f"[PersonCountWorker] Published violation: {violation_type} (conf: {confidence:.2f})")
    
    def start_consuming(self):
        """Start consuming messages"""
        print(f"[PersonCountWorker] Starting to consume from '{CONSUME_QUEUE}'...")
        print(f"[PersonCountWorker] Filtering for requestedAnalysis='PERSON_COUNT'")
        
        self.channel.basic_consume(
            queue=CONSUME_QUEUE,
            on_message_callback=self.process_message,
            auto_ack=False
        )
        
        print(f"[PersonCountWorker] Waiting for messages. Press Ctrl+C to exit.")
        
        try:
            self.channel.start_consuming()
        except KeyboardInterrupt:
            print("\n[PersonCountWorker] Shutting down...")
            self.channel.stop_consuming()
    
    def close(self):
        """Clean up resources"""
        if self.connection:
            self.connection.close()
        
        # Clean temp directory
        try:
            import shutil
            shutil.rmtree(self.temp_dir)
        except:
            pass
        
        print("[PersonCountWorker] Closed")


def main():
    """Main entry point"""
    print("=" * 60)
    print("Person Count Worker - Multiple People Detection")
    print("Uses YOLOv8 for person counting only")
    print("For phone detection, use pre_suspicion_worker.py instead")
    print("=" * 60)
    
    worker = PersonCountWorker()
    
    try:
        # Connect to RabbitMQ with retry
        max_retries = 5
        for attempt in range(max_retries):
            try:
                worker.connect()
                break
            except Exception as e:
                print(f"[PersonCountWorker] Connection attempt {attempt + 1} failed: {e}")
                if attempt < max_retries - 1:
                    time.sleep(5)
                else:
                    raise
        
        # Load YOLO model
        worker.load_model()
        
        # Start consuming
        worker.start_consuming()
        
    except Exception as e:
        print(f"[PersonCountWorker] Fatal error: {e}")
        traceback.print_exc()
        sys.exit(1)
    finally:
        worker.close()


if __name__ == '__main__':
    main()
