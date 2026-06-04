import re
import subprocess

Users = 20
ExamId = "e1000000-0000-0000-0000-000000000001"
QuestionsDuration = 20
IncidentsPerUser = 20
BffUrl = "http://istio-ingressgateway.istio-system"
AuthUrl = "http://authorization-server:9000"
SkipRegister = "false"
SkipPolicyChecks = "false"

env_map = {
    "LT_USERS": str(Users),
    "LT_EXAM_ID": ExamId,
    "LT_QUESTIONS_DURATION": str(QuestionsDuration),
    "LT_INCIDENTS_PER_USER": str(IncidentsPerUser),
    "LT_BFF_URL": BffUrl,
    "LT_AUTH_URL": AuthUrl,
    "LT_SKIP_REGISTER": SkipRegister,
    "LT_SKIP_POLICY_CHECKS": SkipPolicyChecks
}

with open("k8s/apps/load-test-job-policy.yaml", "r", encoding="utf-8") as f:
    yaml_content = f.read()

for key, val in env_map.items():
    # Matches: - name: KEY\n            value: "VALUE"
    pattern = r"(-\s+name:\s+" + key + r"\s*[\r\n]+\s+value:\s+)\"[^\"]*\""
    yaml_content = re.sub(pattern, r"\g<1>\"" + val + r"\"", yaml_content)

temp_file = "k8s/apps/temp-policy-job.yaml"
with open(temp_file, "w", encoding="utf-8") as f:
    f.write(yaml_content)

print("File written by Python. Running kubectl apply...")
res = subprocess.run(["kubectl", "apply", "-n", "exam-platform", "-f", temp_file], capture_output=True, text=True)
print("STDOUT:", res.stdout)
print("STDERR:", res.stderr)
