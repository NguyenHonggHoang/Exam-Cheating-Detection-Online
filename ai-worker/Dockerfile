FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for OpenCV, dlib, InsightFace
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxext6 \
    libxrender-dev \
    ffmpeg \
    cmake \
    build-essential \
    libopenblas-dev \
    liblapack-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Download YOLO model at build time (faster startup)
RUN python -c "from ultralytics import YOLO; YOLO('yolov8n.pt')"

# Pre-download EasyOCR model (English)
RUN python -c "import easyocr; reader = easyocr.Reader(['en'], gpu=False)" || true

# Pre-download InsightFace model (buffalo_l for high accuracy)
RUN python -c "from insightface.app import FaceAnalysis; app = FaceAnalysis(name='buffalo_l'); app.prepare(ctx_id=-1)" || true

# Copy startup script first (changes less frequently)
COPY start.sh .
RUN chmod +x start.sh

# Copy application code (changes more frequently)
COPY *.py ./

# Environment variables
ENV RABBITMQ_HOST=rabbitmq
ENV RABBITMQ_PORT=5672
ENV RABBITMQ_USER=guest
ENV RABBITMQ_PASS=guest
ENV YOLO_MODEL_PATH=yolov8n.pt
ENV CONFIDENCE_THRESHOLD=0.5
# Face verification threshold (cosine distance, lower = stricter)
ENV FACE_VERIFICATION_THRESHOLD=0.6
# MinIO Configuration - needs to be accessible from within Docker network
ENV MINIO_ENDPOINT=http://minio:9000
ENV MINIO_ACCESS_KEY=minioadmin
ENV MINIO_SECRET_KEY=minioadmin123
ENV MINIO_BUCKET=exam-identity

# Run all workers via start script
CMD ["./start.sh"]

