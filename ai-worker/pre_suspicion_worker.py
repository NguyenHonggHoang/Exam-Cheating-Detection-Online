"""
Pre-Suspicion Video Worker - ENHANCED

Processes micro-buffer videos from pre-suspicion detection.
Uses COMPREHENSIVE multi-modal analysis:
1. Screen Glow Detection (phone screen illumination)
2. Document/Text Detection (OCR for notes/cheat sheets) 
3. Hand Motion Detection (reaching for phone/notes)
4. Object Detection (phone, book, paper, second screen)

AI Decision Flow:
├─ Phone detected? → CONFIRM violation
├─ Document text detected? → CONFIRM violation  
├─ Hand reaching motion? → CONFIRM violation
├─ Screen glow in lap? → CONFIRM violation
└─ None detected? → REJECT (no incident)

Consumes: video.analysis queue (filter: requestedAnalysis='SCREEN_GLOW')
Publishes: analysis.pre_suspicion.result
"""

import json
import logging
import os
import sys
import tempfile
import time
from typing import Dict, Optional

import numpy as np
import pika
import requests

from comprehensive_analyzer import ComprehensiveAnalyzer

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('PreSuspicionWorker')


class PreSuspicionWorker:
    """Worker for processing pre-suspicion micro-buffer videos with comprehensive AI analysis"""
    
    # Listen to the same video.analysis queue
    # Filter messages by requestedAnalysis='SCREEN_GLOW' (legacy name, now does comprehensive analysis)
    QUEUE_NAME = 'video.analysis'
    RESULT_EXCHANGE = 'exam-events'
    RESULT_ROUTING_KEY = 'analysis.pre_suspicion.result'
    
    def __init__(self):
        self.rabbitmq_host = os.getenv('RABBITMQ_HOST', 'localhost')
        self.rabbitmq_port = int(os.getenv('RABBITMQ_PORT', 5672))
        self.rabbitmq_user = os.getenv('RABBITMQ_USER', 'guest')
        self.rabbitmq_pass = os.getenv('RABBITMQ_PASS', 'guest')
        
        self.minio_endpoint = os.getenv('MINIO_ENDPOINT', 'http://localhost:9002')
        self.incident_service_url = os.getenv('INCIDENT_SERVICE_URL', 'http://localhost:8082')
        
        # Use comprehensive analyzer (multi-modal detection)
        self.analyzer = ComprehensiveAnalyzer()
        self.connection: Optional[pika.BlockingConnection] = None
        self.channel = None
    
    def connect(self):
        """Connect to RabbitMQ"""
        credentials = pika.PlainCredentials(self.rabbitmq_user, self.rabbitmq_pass)
        parameters = pika.ConnectionParameters(
            host=self.rabbitmq_host,
            port=self.rabbitmq_port,
            credentials=credentials,
            heartbeat=60,
            blocked_connection_timeout=300
        )
        
        self.connection = pika.BlockingConnection(parameters)
        self.channel = self.connection.channel()
        
        # Declare queue
        self.channel.queue_declare(
            queue=self.QUEUE_NAME,
            durable=True
        )
        
        # Declare exchange for results
        self.channel.exchange_declare(
            exchange=self.RESULT_EXCHANGE,
            exchange_type='topic',
            durable=True
        )
        
        logger.info(f"Connected to RabbitMQ at {self.rabbitmq_host}:{self.rabbitmq_port}")
    
    def download_video(self, video_url: str) -> Optional[str]:
        """Download video from MinIO to temp file
        
        Handles URL conversion for Docker network:
        - localhost URLs are converted to internal minio_endpoint
        """
        try:
            # Convert localhost URLs to internal MinIO endpoint for Docker network
            actual_url = video_url
            if 'localhost' in video_url or '127.0.0.1' in video_url:
                # Extract path from URL and reconstruct with internal endpoint
                from urllib.parse import urlparse
                parsed = urlparse(video_url)
                # Replace host with internal MinIO endpoint
                internal_host = self.minio_endpoint.rstrip('/')
                actual_url = f"{internal_host}{parsed.path}"
                logger.info(f"Converted URL: {video_url} -> {actual_url}")
            
            response = requests.get(actual_url, timeout=30)
            response.raise_for_status()
            
            # Save to temp file
            with tempfile.NamedTemporaryFile(suffix='.webm', delete=False) as f:
                f.write(response.content)
                logger.info(f"Downloaded {len(response.content)} bytes to {f.name}")
                return f.name
                
        except Exception as e:
            logger.error(f"Failed to download video from {video_url}: {e}")
            return None
    
    def report_result(self, session_id: str, result: Dict):
        """Send analysis result to incident service"""
        try:
            # Publish to RabbitMQ
            message = {
                "sessionId": session_id,
                "eventType": "PRE_SUSPICION_ANALYSIS_RESULT",
                "result": result,
                "evidenceUrl": result.get('videoUrl'),
                "timestamp": int(time.time() * 1000)
            }
            
            self.channel.basic_publish(
                exchange=self.RESULT_EXCHANGE,
                routing_key=self.RESULT_ROUTING_KEY,
                body=json.dumps(message),
                properties=pika.BasicProperties(
                    content_type='application/json',
                    delivery_mode=2  # Persistent
                )
            )
            
            logger.info(f"Published result for session {session_id}")
            
        except Exception as e:
            logger.error(f"Failed to report result: {e}")
    
    def process_message(self, ch, method, properties, body):
        """Process a single message from queue - COMPREHENSIVE ANALYSIS"""
        try:
            message = json.loads(body)
            
            # Filter: Only process SCREEN_GLOW analysis requests
            requested_analysis = message.get('requestedAnalysis', 'ALL')
            if requested_analysis != 'SCREEN_GLOW':
                # Not for us, acknowledge and skip
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return
            
            session_id = message.get('sessionId')
            video_url = message.get('publicUrl')
            violation_type = message.get('violationType', 'PHONE_USAGE')
            metadata = message.get('metadata', {})
            pattern = metadata.get('pattern', 'unknown')
            initial_confidence = metadata.get('confidence', 0.0)
            
            logger.info(f"📹 Processing pre-suspicion video")
            logger.info(f"   Session: {session_id}")
            logger.info(f"   Pattern: {pattern} (initial confidence: {initial_confidence:.1f})")
            
            # Download video
            video_path = self.download_video(video_url)
            if not video_path:
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return
            
            try:
                # Run COMPREHENSIVE AI ANALYSIS
                logger.info("🤖 Running multi-modal AI analysis...")
                analysis_result = self.analyzer.analyze_video(video_path)
                
                # Convert to dict
                result_dict = analysis_result.to_dict()
                result_dict['pattern'] = pattern
                result_dict['initial_confidence'] = initial_confidence
                result_dict['videoUrl'] = video_url
                
                # Log decision
                verdict = result_dict['verdict']
                logger.info(f"✅ Analysis complete:")
                logger.info(f"   Decision: {'CONFIRM' if verdict['is_violation'] else 'REJECT'}")
                logger.info(f"   Confidence: {verdict['confidence']:.1f}%")
                logger.info(f"   Reasons: {verdict['reasons']}")
                
                # Report result
                self.report_result(session_id, result_dict)
                
            finally:
                # Cleanup temp file
                if os.path.exists(video_path):
                    os.remove(video_path)
            
            # Acknowledge message
            ch.basic_ack(delivery_tag=method.delivery_tag)
            
        except Exception as e:
            logger.error(f"❌ Failed to process message: {e}")
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
    
    def start(self):
        """Start consuming messages"""
        logger.info("=" * 60)
        logger.info("Pre-Suspicion AI Worker - COMPREHENSIVE ANALYSIS")
        logger.info("Detections: Screen Glow + OCR + Hand Motion + YOLO")
        logger.info("=" * 60)
        logger.info(f"Queue: {self.QUEUE_NAME}")
        logger.info(f"Filter: requestedAnalysis='SCREEN_GLOW'")
        logger.info("")
        
        self.channel.basic_qos(prefetch_count=1)
        self.channel.basic_consume(
            queue=self.QUEUE_NAME,
            on_message_callback=self.process_message
        )
        
        logger.info("✅ Worker ready - waiting for videos...")
        
        try:
            self.channel.start_consuming()
        except KeyboardInterrupt:
            logger.info("\n🛑 Shutting down...")
            self.channel.stop_consuming()
        finally:
            if self.connection:
                self.connection.close()


def main():
    """Main entry point"""
    worker = PreSuspicionWorker()
    
    # Retry connection with backoff
    max_retries = 5
    for attempt in range(max_retries):
        try:
            worker.connect()
            worker.start()
            break
        except pika.exceptions.AMQPConnectionError as e:
            wait_time = 2 ** attempt
            logger.error(f"Connection failed (attempt {attempt + 1}/{max_retries}): {e}")
            if attempt < max_retries - 1:
                logger.info(f"Retrying in {wait_time}s...")
                time.sleep(wait_time)
            else:
                logger.error("Max retries reached, exiting")
                sys.exit(1)


if __name__ == '__main__':
    main()
