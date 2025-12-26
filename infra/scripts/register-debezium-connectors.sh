#!/bin/bash

# Debezium Connector Registration Script
# Waits for Kafka Connect to be ready and registers all connectors

set -e

KAFKA_CONNECT_URL="http://kafka-connect:8083"
CONNECTOR_DIR="/config"
MAX_RETRIES=30
RETRY_DELAY=5

echo "========================================="
echo "Debezium Connector Registration Script"
echo "========================================="

# Wait for Kafka Connect to be ready
echo "Waiting for Kafka Connect to be ready..."
for i in $(seq 1 $MAX_RETRIES); do
  if curl -sf "$KAFKA_CONNECT_URL/" > /dev/null; then
    echo "✅ Kafka Connect is ready!"
    break
  fi
  
  if [ $i -eq $MAX_RETRIES ]; then
    echo "❌ Kafka Connect failed to start after $MAX_RETRIES retries"
    exit 1
  fi
  
  echo "Attempt $i/$MAX_RETRIES - Kafka Connect not ready yet, retrying in ${RETRY_DELAY}s..."
  sleep $RETRY_DELAY
done

# Register each connector
echo ""
echo "Registering Debezium connectors..."
for connector_file in "$CONNECTOR_DIR"/*.json; do
  if [ ! -f "$connector_file" ]; then
    echo "⚠️  No connector files found in $CONNECTOR_DIR"
    continue
  fi
  
  connector_name=$(basename "$connector_file" .json | sed 's/-connector$//')
  
  echo ""
  echo "📋 Registering: $connector_name"
  echo "   File: $connector_file"
  
  # Check if connector already exists
  if curl -sf "$KAFKA_CONNECT_URL/connectors/$connector_name" > /dev/null; then
    echo "   ℹ️  Connector already exists, updating configuration..."
    
    # Update existing connector
    response=$(curl -s -X PUT \
      "$KAFKA_CONNECT_URL/connectors/$connector_name/config" \
      -H "Content-Type: application/json" \
      -d @"$connector_file" | jq -r '.name // "ERROR"')
    
    if [ "$response" != "ERROR" ]; then
      echo "   ✅ Updated: $connector_name"
    else
      echo "   ❌ Failed to update: $connector_name"
    fi
  else
    echo "   ℹ️  Creating new connector..."
    
    # Create new connector
    response=$(curl -s -X POST \
      "$KAFKA_CONNECT_URL/connectors" \
      -H "Content-Type: application/json" \
      -d @"$connector_file" | jq -r '.name // "ERROR"')
    
    if [ "$response" != "ERROR" ]; then
      echo "   ✅ Created: $connector_name"
    else
      echo "   ❌ Failed to create: $connector_name"
    fi
  fi
done

# Verify all connectors
echo ""
echo "========================================="
echo "Connector Status:"
echo "========================================="
curl -s "$KAFKA_CONNECT_URL/connectors" | jq -r '.[]' | while read connector; do
  status=$(curl -s "$KAFKA_CONNECT_URL/connectors/$connector/status" | jq -r '.connector.state')
  echo "  $connector: $status"
done

echo ""
echo "✅ Debezium connector registration complete!"
