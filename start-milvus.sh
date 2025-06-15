#!/bin/bash

echo "🚀 Starting Milvus with Docker..."

# Start Milvus standalone (all-in-one container)
docker run -d \
  --name milvus-standalone \
  -p 19530:19530 \
  -p 9091:9091 \
  -v $(pwd)/milvus-data:/var/lib/milvus \
  milvusdb/milvus:v2.3.3 \
  milvus run standalone

echo "⏳ Waiting for Milvus to start..."
sleep 10

# Check if it's running
if curl -s http://localhost:9091/healthz | grep -q "OK"; then
    echo "✅ Milvus is running!"
    echo "📍 Milvus API: http://localhost:19530"
    echo "📊 Health check: http://localhost:9091/healthz"
else
    echo "❌ Milvus failed to start. Check Docker logs:"
    echo "docker logs milvus-standalone"
fi