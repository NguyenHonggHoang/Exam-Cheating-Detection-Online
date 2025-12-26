#!/bin/bash

# Register Debezium Postgres Connectors for CDC
# This script sends the connector configurations to Kafka Connect REST API
# Uses connector config files from infra/debezium/

set -e

KAFKA_CONNECT_URL="http://localhost:8083"
CONNECTOR_DIR="./infra/debezium"
MAX_RETRIES=60
RETRY_DELAY=2

echo "========================================="
echo "Debezium Connector Registration Script"
echo "========================================="

# Function to register a connector
register_connector() {
    local connector_file=$1
    local connector_name=$(jq -r '.name' "$connector_file")
    
    echo ""
    echo "📋 Registering: $connector_name"
    echo "   File: $connector_file"
    
    # Check if connector already exists
    if curl -sf "$KAFKA_CONNECT_URL/connectors/$connector_name" > /dev/null 2>&1; then
        echo "   ⚠️  Connector already exists, updating..."
        curl -sf -X DELETE "$KAFKA_CONNECT_URL/connectors/$connector_name" > /dev/null
        sleep 2
    fi
    
    # Register connector
    response=$(curl -sf -X POST "$KAFKA_CONNECT_URL/connectors" \
        -H "Content-Type: application/json" \
        -d @"$connector_file" 2>&1) || {
        echo "   ❌ Failed to register connector"
        echo "   Response: $response"
        return 1
    }
    
    echo "   ✅ Registered successfully"
}

# Wait for Kafka Connect to be ready
echo ""
echo "⏳ Waiting for Kafka Connect to be ready..."
for i in $(seq 1 $MAX_RETRIES); do
    if curl -sf "$KAFKA_CONNECT_URL/" > /dev/null 2>&1; then
        echo "✅ Kafka Connect is ready!"
        break
    fi
    
    if [ $i -eq $MAX_RETRIES ]; then
        echo "❌ Kafka Connect failed to start after $MAX_RETRIES attempts"
        exit 1
    fi
    
    echo "   Attempt $i/$MAX_RETRIES - retrying in ${RETRY_DELAY}s..."
    sleep $RETRY_DELAY
done

# Wait additional time for Kafka Connect to stabilize
echo "⏳ Waiting for Kafka Connect to stabilize..."
sleep 5

# Register each connector
echo ""
echo "🔄 Registering Debezium connectors..."

# Register in order: identity first (as other services depend on user data)
for connector_file in "$CONNECTOR_DIR"/identity-connector.json \
                      "$CONNECTOR_DIR"/session-connector.json \
                      "$CONNECTOR_DIR"/incident-connector.json; do
    if [ -f "$connector_file" ]; then
        register_connector "$connector_file"
    else
        echo "⚠️  Connector file not found: $connector_file"
    fi
done

# List all registered connectors
echo ""
echo "========================================="
echo "📊 Current connectors status:"
curl -sf "$KAFKA_CONNECT_URL/connectors" | jq '.'

echo ""
echo "========================================="
echo "✅ Connector registration complete!"
echo ""
echo "📌 Topic naming convention:"
echo "   - exam-identity.public.users"
echo "   - exam-session.public.sessions"
echo "   - exam-incident.public.incidents"
echo ""
echo "🔍 To check connector status:"
echo "   curl http://localhost:8083/connectors/<name>/status"

