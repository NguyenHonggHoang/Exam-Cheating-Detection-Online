"""
AI Worker - RabbitMQ Publisher
Sends violation events to Incident Service via RabbitMQ

Installation:
pip install pika opencv-python torch
"""

import pika
import json
import time
from datetime import datetime
from typing import Dict, Any

class AIViolationPublisher:
    """
    RabbitMQ Publisher for AI-detected violations
    """
    
    def __init__(self, rabbitmq_host='localhost', rabbitmq_port=5672, 
                 username='exam', password='exam123'):
        """
        Initialize RabbitMQ connection
        """
        credentials = pika.PlainCredentials(username, password)
        parameters = pika.ConnectionParameters(
            host=rabbitmq_host,
            port=rabbitmq_port,
            credentials=credentials,
            heartbeat=600,
            blocked_connection_timeout=300
        )
        
        self.connection = pika.BlockingConnection(parameters)
        self.channel = self.connection.channel()
        
        # Declare queue (idempotent - creates if doesn't exist)
        self.channel.queue_declare(queue='ai.violations', durable=True)
        
        print(f"[AI Worker] Connected to RabbitMQ at {rabbitmq_host}:{rabbitmq_port}")
    
    def publish_violation(self, event: Dict[str, Any]) -> None:
        """
        Publish violation event to RabbitMQ
        
        Args:
            event: Dictionary containing:
                - session_id (str): UUID of exam session
                - timestamp (int): Unix timestamp in milliseconds
                - violation_type (str): e.g., "PHONE_DETECTED", "MULTIPLE_FACES"
                - confidence (float): 0.0 to 1.0
                - evidence_url (str, optional): MinIO URL to evidence
        
        Example:
            publisher.publish_violation({
                "session_id": "123e4567-e89b-12d3-a456-426614174000",
                "timestamp": 1701543600000,
                "violation_type": "PHONE_DETECTED",
                "confidence": 0.95,
                "evidence_url": "http://minio:9000/exam-evidence/session-123/phone_1701543600.jpg"
            })
        """
        try:
            message = json.dumps(event)
            
            self.channel.basic_publish(
                exchange='',
                routing_key='ai.violations',
                body=message,
                properties=pika.BasicProperties(
                    delivery_mode=2,  # Persistent message
                    content_type='application/json'
                )
            )
            
            print(f"[AI Worker] Published violation: {event['violation_type']} "
                  f"(confidence: {event['confidence']:.2f})")
            
        except Exception as e:
            print(f"[AI Worker] Error publishing violation: {e}")
    
    def close(self):
        """Close RabbitMQ connection"""
        self.connection.close()
        print("[AI Worker] Disconnected from RabbitMQ")


# ============================================================================
# Example AI Worker Logic
# ============================================================================

def detect_phone(frame) -> float:
    """
    Placeholder for phone detection model
    Returns confidence score (0.0 to 1.0)
    """
    # TODO: Implement actual YOLO/EfficientDet phone detection
    # For now, return random confidence
    import random
    return random.random()


def process_video_stream(session_id: str, publisher: AIViolationPublisher):
    """
    Main AI processing loop
    Simulates real-time video analysis
    """
    print(f"[AI Worker] Starting analysis for session: {session_id}")
    
    frame_count = 0
    
    while True:
        # Simulate frame reception from Media Server
        # In production: frames = media_server.get_frames(session_id)
        
        frame_count += 1
        
        # Run AI detection
        phone_confidence = detect_phone(frame=None)
        
        # Publish violation if confidence > threshold
        if phone_confidence > 0.8:
            publisher.publish_violation({
                "session_id": session_id,
                "timestamp": int(time.time() * 1000),
                "violation_type": "PHONE_DETECTED",
                "confidence": phone_confidence,
                "evidence_url": f"http://localhost:9000/exam-evidence/{session_id}/phone_{frame_count}.jpg"
            })
        
        # Throttle: Process 5 frames per second
        time.sleep(0.2)
        
        # Stop after 100 frames (for demo)
        if frame_count >= 100:
            break
    
    print(f"[AI Worker] Finished processing session: {session_id}")


# ============================================================================
# Main Execution
# ============================================================================

if __name__ == "__main__":
    # Initialize publisher
    publisher = AIViolationPublisher(
        rabbitmq_host='localhost',  # Use 'rabbitmq' if running in Docker
        username='exam',
        password='exam123'
    )
    
    try:
        # Process exam session
        test_session_id = "123e4567-e89b-12d3-a456-426614174000"
        process_video_stream(test_session_id, publisher)
        
    finally:
        # Cleanup
        publisher.close()
