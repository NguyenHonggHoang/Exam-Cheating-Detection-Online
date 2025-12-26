#!/bin/bash
echo "Starting AI Workers..."

# Start Unified Video Worker (replaces worker.py)
# Processes all videos with ComprehensiveAnalyzer
echo "[start.sh] Starting unified_video_worker.py..."
python unified_video_worker.py &
PID_VIDEO=$!

# Start Face Verification Worker
echo "[start.sh] Starting face_verification_worker.py..."
python face_verification_worker.py &
PID_FACE=$!

# Note: pre_suspicion_worker.py is deprecated, unified_video_worker handles all videos now

# Wait for any process to exit
# If any worker fails, the container should exit so Docker can restart it
wait -n

# Capture exit code
EXIT_CODE=$?

echo "[start.sh] A worker process exited with code $EXIT_CODE. Shutting down..."

# Kill remaining processes
kill $PID_VIDEO 2>/dev/null
kill $PID_FACE 2>/dev/null

exit $EXIT_CODE
