# ONE COMMAND TO RUN EVERYTHING

Copy and paste this EXACT command in your terminal:

```bash
docker run -d --name milvus-standalone -p 19530:19530 -p 9091:9091 -v milvus-data:/var/lib/milvus milvusdb/milvus:v2.3.3 milvus run standalone && sleep 10 && curl http://localhost:9091/healthz
```

If you see `{"status":"ok"}`, Milvus is running.

## Then in your project:

```bash
# Remove the .db file config
sed -i '/MILVUS_ADDRESS=.*\.db/d' .env

# Make sure it points to the server
echo "MILVUS_ADDRESS=localhost:19530" >> .env

# Now start your MCP/RAG
npx mcp-rag start --mode full-auto
```

## To verify Milvus is working:

```bash
docker ps | grep milvus
# Should show: milvus-standalone ... Up ... 0.0.0.0:19530->19530/tcp
```

That's it. No bullshit. Just works.