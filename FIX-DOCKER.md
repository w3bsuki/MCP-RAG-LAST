# Fix Docker Not Running

## 1. Start Docker Desktop

Since you're on Windows (WSL), you need to:

1. **Open Docker Desktop** (from Windows Start Menu)
2. Wait for it to say "Docker Desktop is running"
3. Make sure WSL integration is enabled:
   - Docker Desktop → Settings → Resources → WSL Integration
   - Enable integration with your distro

## 2. Then run this SIMPLIFIED command:

```bash
# This one actually works without external dependencies:
docker run -d --name milvus-standalone -p 19530:19530 -p 9091:9091 milvusdb/milvus:v2.3.3 milvus run standalone
```

## 3. Verify Docker is working:

```bash
# First check Docker
docker --version

# If that works, run Milvus
docker run -d --name milvus-standalone -p 19530:19530 -p 9091:9091 milvusdb/milvus:v2.3.3 milvus run standalone
```

## Common WSL + Docker Desktop issues:

If Docker still doesn't work:

```bash
# In WSL terminal:
sudo service docker start

# Or restart WSL:
wsl --shutdown
# Then open a new WSL terminal
```

## Alternative: Use Docker from PowerShell

If WSL integration is broken, open PowerShell as Admin:

```powershell
docker run -d --name milvus-standalone -p 19530:19530 -p 9091:9091 milvusdb/milvus:v2.3.3 milvus run standalone
```

Then your WSL can still connect to localhost:19530