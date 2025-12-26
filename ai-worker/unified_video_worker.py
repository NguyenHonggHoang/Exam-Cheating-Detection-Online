"""
Unified Video Worker - RabbitMQ Consumer

Processes ALL video analysis requests (no filtering).
Uses ComprehensiveAnalyzer for multi-modal detection:
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

Consumes: video.analysis queue (ALL messages, no filter)
Publishes: ai.result.video
"""

import json
import logging
import os
import sys
import tempfile
import time
from typing import Dict, Optional

import pika

from comprehensive_analyzer import ComprehensiveAnalyzer
from video_utils import download_video, cleanup_temp_file

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('UnifiedVideoWorker')


class UnifiedVideoWorker:
    """
    Unified worker for processing all video analysis requests.
    
    Replaces both pre_suspicion_worker.py and worker.py with a single
    unified worker that processes all videos with ComprehensiveAnalyzer.
    """
    
    # Queue configuration
    QUEUE_NAME = 'video.analysis'
    RESULT_EXCHANGE = 'exam.events'
    RESULT_ROUTING_KEY = 'ai.result.video'
    
    def __init__(self):
        self.rabbitmq_host = os.getenv('RABBITMQ_HOST', 'localhost')
        self.rabbitmq_port = int(os.getenv('RABBITMQ_PORT', 5672))
        self.rabbitmq_user = os.getenv('RABBITMQ_USER', 'guest')
        self.rabbitmq_pass = os.getenv('RABBITMQ_PASS', 'guest')
        
        self.minio_endpoint = os.getenv('MINIO_ENDPOINT', 'http://minio:9000')
        
        # Temp directory for video downloads
        self.temp_dir = tempfile.mkdtemp(prefix='unified_video_worker_')
        
        # Comprehensive analyzer (multi-modal detection)
        self.analyzer = ComprehensiveAnalyzer()
        
        self.connection: Optional[pika.BlockingConnection] = None
        self.channel = None
        
        logger.info(f"UnifiedVideoWorker initialized")
        logger.info(f"  RabbitMQ: {self.rabbitmq_host}:{self.rabbitmq_port}")
        logger.info(f"  MinIO: {self.minio_endpoint}")
        logger.info(f"  Temp dir: {self.temp_dir}")
    
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
        
        # Declare exchange
        self.channel.exchange_declare(
            exchange=self.RESULT_EXCHANGE,
            exchange_type='topic',
            durable=True
        )
        
        # Declare input queue
        self.channel.queue_declare(
            queue=self.QUEUE_NAME,
            durable=True
        )
        
        # Bind queue to exchange with routing key
        self.channel.queue_bind(
            queue=self.QUEUE_NAME,
            exchange=self.RESULT_EXCHANGE,
            routing_key='video.uploaded'
        )
        
        logger.info(f"✅ Connected to RabbitMQ")
    
    def process_message(self, ch, method, properties, body):
        """Process incoming video analysis message - NO FILTERING"""
        start_time = time.time()
        video_path = None
        
        try:
            message = json.loads(body)
            
            session_id = message.get('sessionId')
            video_url = message.get('publicUrl')
            violation_type = message.get('violationType', 'UNKNOWN')
            timestamp = message.get('timestamp', int(time.time() * 1000))
            
            logger.info(f"📹 Processing video analysis request")
            logger.info(f"   Session: {session_id}")
            logger.info(f"   URL: {video_url[:80] if video_url else 'None'}...")
            logger.info(f"   Initial violation: {violation_type}")
            
            if not video_url:
                logger.error("Missing video URL, skipping")
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return
            
            # Download video
            video_path = download_video(video_url, self.temp_dir, self.minio_endpoint)
            
            if not video_path:
                logger.error("Failed to download video")
                ch.basic_ack(delivery_tag=method.delivery_tag)
                return
            
            # Run COMPREHENSIVE AI ANALYSIS
            logger.info("🤖 Running multi-modal AI analysis...")
            analysis_result = self.analyzer.analyze_video(video_path)
            
            # Convert to result dict
            result_dict = analysis_result.to_dict()
            
            # Log decision
            verdict = result_dict['verdict']
            logger.info(f"✅ Analysis complete:")
            logger.info(f"   Decision: {'CONFIRM' if verdict['is_violation'] else 'REJECT'}")
            logger.info(f"   Confidence: {verdict['confidence']:.1f}%")
            logger.info(f"   Reasons: {verdict['reasons']}")
            
            # Build result message
            result_message = {
                'sessionId': session_id,
                'videoUrl': video_url,
                'isViolation': verdict['is_violation'],
                'confidence': verdict['confidence'],
                'detections': {
                    'screenGlow': result_dict.get('screen_glow', {}),
                    'document': result_dict.get('document', {}),
                    'handMotion': result_dict.get('hand_motion', {}),
                    'objects': result_dict.get('objects', {})
                },
                'reasons': verdict['reasons'],
                'initialViolationType': violation_type,
                'timestamp': timestamp,
                'processingTimeMs': int((time.time() - start_time) * 1000)
            }
            
            # Publish result
            self._publish_result(result_message)
            
            # Acknowledge message
            ch.basic_ack(delivery_tag=method.delivery_tag)
            
            elapsed = time.time() - start_time
            logger.info(f"⏱️ Message processed in {elapsed:.2f}s")
            
        except Exception as e:
            logger.error(f"❌ Failed to process message: {e}")
            import traceback
            traceback.print_exc()
            ch.basic_nack(delivery_tag=method.delivery_tag, requeue=False)
            
        finally:
            # Cleanup temp file
            if video_path:
                cleanup_temp_file(video_path)
    
    def _publish_result(self, result: Dict):
        """Publish analysis result to ai.result.video"""
        self.channel.basic_publish(
            exchange=self.RESULT_EXCHANGE,
            routing_key=self.RESULT_ROUTING_KEY,
            body=json.dumps(result),
            properties=pika.BasicProperties(
                content_type='application/json',
                delivery_mode=2  # Persistent
            )
        )
        
        logger.info(f"📤 Published result to {self.RESULT_ROUTING_KEY}")
    
    def start(self):
        """Start consuming messages"""
        logger.info("=" * 60)
        logger.info("Unified Video Worker - COMPREHENSIVE ANALYSIS")
        logger.info("Detections: Screen Glow + OCR + Hand Motion + YOLO")
        logger.info("=" * 60)
        logger.info(f"Queue: {self.QUEUE_NAME}")
        logger.info(f"Publishing to: {self.RESULT_ROUTING_KEY}")
        logger.info("Processing ALL videos (no filter)")
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
            
            # Cleanup temp directory
            try:
                import shutil
                shutil.rmtree(self.temp_dir)
            except:
                pass
    
    def close(self):
        """Close connection"""
        if self.connection:
            self.connection.close()


def main():
    """Main entry point"""
    worker = UnifiedVideoWorker()
    
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
