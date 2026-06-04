#!/bin/bash
# ==========================================
# Cilium & Hubble (eBPF) Installation Script
# ==========================================
set -e

echo "=== 1. Adding Cilium Helm Repository ==="
helm repo add cilium https://helm.cilium.io/
helm repo update

echo "=== 2. Installing Cilium CNI with Hubble enabled ==="
# Docker Desktop keeps kube-proxy and does not expose shared mount propagation
# like a typical Linux node, so use a conservative Cilium install profile.
K8S_API_SERVER_IP=${1:-"kubernetes.docker.internal"}
K8S_API_SERVER_PORT=${2:-"6443"}

helm upgrade --install cilium cilium/cilium --version 1.15.5 \
  --namespace kube-system \
  --set kubeProxyReplacement=false \
  --set k8sServiceHost="$K8S_API_SERVER_IP" \
  --set k8sServicePort="$K8S_API_SERVER_PORT" \
  --set operator.replicas=1 \
  --set bpf.autoMount.enabled=false \
  --set bpf.root=/sys/fs/bpf \
  --set cgroup.autoMount.enabled=false \
  --set cgroup.hostRoot=/sys/fs/cgroup \
  --set hubble.enabled=true \
  --set hubble.relay.enabled=true \
  --set hubble.ui.enabled=true

echo "=== 3. Waiting for Cilium Pods to be ready ==="
echo "If Docker Desktop rejects mountPropagation on clean-cilium-state, patch the daemonset once:"
echo "  kubectl patch ds cilium -n kube-system --type=json -p='[{\"op\":\"remove\",\"path\":\"/spec/template/spec/initContainers/1/volumeMounts/0/mountPropagation\"}]'"
kubectl rollout status ds/cilium -n kube-system --timeout=150s

echo "=== 4. Checking Cilium status ==="
# Check if Cilium CLI is installed to run status check
if command -v cilium &> /dev/null; then
    cilium status
else
    echo "Cilium CLI is not installed. You can install it using:"
    echo "curl -L --fail --remote-name-all https://github.com/cilium/cilium-cli/releases/latest/download/cilium-linux-amd64.tar.gz"
    echo "tar xzvf cilium-linux-amd64.tar.gz && sudo mv cilium /usr/local/bin/"
fi

echo "=== 5. How to access Hubble UI ==="
echo "To access the eBPF Hubble network visualization, run:"
echo "  cilium hubble port-forward"
echo "Then open your browser at: http://localhost:12000"
echo "=== Done! ==="
