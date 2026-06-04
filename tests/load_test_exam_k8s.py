"""
K8s Job Entry Point — Full Exam Flow Load Test

This file is the entry point mounted into the Kubernetes load-test Job pod
via a ConfigMap. It delegates to load_test_all_apis.py with K8s-internal DNS.

All service URLs use K8s internal DNS (no port-forwarding needed):
  - user-service:8100
  - session-service:8081
  - incident-service:8082
"""

import subprocess
import sys
import os

# Configurable via environment variables injected into the K8s pod
USERS              = int(os.getenv("LT_USERS",              "1000"))
EXAM_ID            = os.getenv("LT_EXAM_ID",               "e1000000-0000-0000-0000-000000000001")
QUESTIONS_DURATION = int(os.getenv("LT_QUESTIONS_DURATION", "20"))
INCIDENTS_PER_USER = int(os.getenv("LT_INCIDENTS_PER_USER", "20"))
SKIP_REGISTER      = os.getenv("LT_SKIP_REGISTER", "false").lower() == "true"

HOST_USER     = os.getenv("LT_HOST_USER",     "http://user-service:8100")
HOST_SESSION  = os.getenv("LT_HOST_SESSION",  "http://session-service:8081")
HOST_INCIDENT = os.getenv("LT_HOST_INCIDENT", "http://incident-service:8082")

# Build command
script_dir = os.path.dirname(os.path.abspath(__file__))
main_script = os.path.join(script_dir, "non-policy", "load_test_all_apis.py")

cmd = [
    sys.executable, main_script,
    "--users",              str(USERS),
    "--exam-id",            EXAM_ID,
    "--questions-duration", str(QUESTIONS_DURATION),
    "--incidents-per-user", str(INCIDENTS_PER_USER),
    "--host-user",          HOST_USER,
    "--host-session",       HOST_SESSION,
    "--host-incident",      HOST_INCIDENT,
]

if SKIP_REGISTER:
    cmd.append("--skip-register")

print("=" * 72)
print("  K8S INTERNAL LOAD TEST JOB  — Full Exam Flow")
print("=" * 72)
print(f"  Users              : {USERS}")
print(f"  Exam ID            : {EXAM_ID}")
print(f"  Questions duration : {QUESTIONS_DURATION}s at 10 req/s")
print(f"  Incidents per user : {INCIDENTS_PER_USER}")
print(f"  Hosts: user={HOST_USER} | session={HOST_SESSION} | incident={HOST_INCIDENT}")
print("=" * 72)

result = subprocess.run(cmd)
sys.exit(result.returncode)
