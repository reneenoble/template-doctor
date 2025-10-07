# Port Allocation - Template Doctor

**Port Separation Strategy**: Keep Azure Functions and Express server on different ports to avoid conflicts.

## Port Assignments

| Service             | Port   | Purpose                                 | Status              |
| ------------------- | ------ | --------------------------------------- | ------------------- |
| **Azure Functions** | `7071` | Azure Functions Core Tools emulator     | ⚠️ Being phased out |
| **Express Server**  | `3001` | New Express backend (Docker/production) | ✅ Active           |
| **Vite Frontend**   | `4000` | Frontend development server             | ✅ Active           |
| **Vite Preview**    | `5173` | Vite preview mode (alternative)         | ⏸️ Optional         |

## Why Different Ports?

### Azure Functions (7071)

- **Purpose**: Azure Functions Core Tools local emulator
- **Command**: `func start` in `packages/api`
- **Use Case**: Testing Azure Functions locally (being deprecated)
- **Conflict**: Cannot run Express server on same port

### Express Server (3001)

- **Purpose**: Production Express backend
- **Command**: `npm start` in `packages/server` or Docker
- **Use Case**: New production backend, replacing Azure Functions
- **Benefits**:
    - Standard Node.js port
    - No conflict with Azure Functions
    - Can run both servers simultaneously during migration

### Frontend (4000)

- **Purpose**: Vite dev server and production static serving
- **Command**: `npm run dev` in `packages/app`
- **Docker**: Uses `serve` package to serve static files

## Configuration Files

### Express Server

```bash
# packages/server/.env
PORT=3001

# packages/server/Dockerfile
EXPOSE 3001

# docker-compose.yml
ports:
  - "3001:3001"
```

### Frontend

```bash
# packages/app/config.json
{
  "backend": {
    "baseUrl": "http://localhost:3001"  # Points to Express
  }
}

# docker-compose.yml
ports:
  - "4000:4000"
environment:
  - VITE_API_BASE_URL=http://localhost:3001
```

## Migration Timeline

### Phase 1: Parallel Running (CURRENT)

- Azure Functions: `localhost:7071` (legacy)
- Express Server: `localhost:3001` (new)
- Frontend: `localhost:4000` (can point to either)

**Benefits**:

- Test new Express server without breaking existing setup
- Compare responses between old and new backends
- Gradual migration without downtime

### Phase 2: Express Only (TARGET)

- Azure Functions: ❌ Shut down
- Express Server: `localhost:3001` ✅ Production
- Frontend: `localhost:4000` → `localhost:3001`

## Testing Both Backends

### Test Azure Functions (Legacy)

```bash
# Terminal 1: Start Azure Functions
cd packages/api
func start

# Terminal 2: Test endpoints
curl http://localhost:7071/api/v4/client-settings
```

### Test Express Server (New)

```bash
# Terminal 1: Start Express
cd packages/server
npm run dev

# Terminal 2: Test endpoints
curl http://localhost:3001/api/v4/client-settings

# Or with Docker
./docker-start.sh
curl http://localhost:3001/api/health
```

### Test Both Simultaneously

```bash
# Terminal 1: Azure Functions
cd packages/api && func start

# Terminal 2: Express Server
cd packages/server && npm run dev

# Terminal 3: Compare responses
curl http://localhost:7071/api/v4/client-settings > azure.json
curl http://localhost:3001/api/v4/client-settings > express.json
diff azure.json express.json
```

## Docker Configuration

### Port Mapping

```yaml
# docker-compose.yml
services:
    server:
        ports:
            - "3001:3001" # Host:Container
        environment:
            - PORT=3001

    app:
        ports:
            - "4000:4000"
        environment:
            - VITE_API_BASE_URL=http://localhost:3001
```

### Access from Host

- Frontend: http://localhost:4000
- Backend: http://localhost:3001
- Health: http://localhost:3001/api/health

### Container-to-Container

Within Docker network, services use service names:

- `http://server:3001` (from app container)
- `http://app:4000` (from server container)

## Common Issues

### Port Conflict

```bash
# Error: Address already in use (EADDRINUSE)
# Solution: Kill process on port
lsof -ti :3001 | xargs kill -9
lsof -ti :7071 | xargs kill -9
```

### Wrong Port in Frontend Config

```javascript
// ❌ Wrong: pointing to Azure Functions port
backend: {
    baseUrl: "http://localhost:7071";
}

// ✅ Correct: pointing to Express port
backend: {
    baseUrl: "http://localhost:3001";
}
```

### Health Check Fails

```bash
# Check which port server is actually running on
docker logs template-doctor-server | grep "running on port"

# Test health endpoint
curl http://localhost:3001/api/health
```

## Environment Variables

### Express Server

```bash
# .env or docker-compose.yml
PORT=3001                    # Express server port
TD_BACKEND_BASE_URL=         # Empty for same-origin (Docker)
```

### Frontend

```bash
# During build
VITE_API_BASE_URL=http://localhost:3001

# In config.json (runtime)
{
  "backend": {
    "baseUrl": "http://localhost:3001"
  }
}
```

## Production Deployment

### Azure Container Apps

```bash
# Backend gets external URL
https://template-doctor-server.azurecontainerapps.io

# Frontend points to it
VITE_API_BASE_URL=https://template-doctor-server.azurecontainerapps.io
```

### Container Internal Ports

Containers always listen on their assigned ports internally:

- Server: 3001
- App: 4000

External ports can be remapped:

```yaml
ports:
    - "80:3001" # External 80 → Internal 3001
    - "8080:4000" # External 8080 → Internal 4000
```

## Quick Reference

| Task                   | Command                                         | Port |
| ---------------------- | ----------------------------------------------- | ---- |
| Start Azure Functions  | `cd packages/api && func start`                 | 7071 |
| Start Express (dev)    | `cd packages/server && npm run dev`             | 3001 |
| Start Express (Docker) | `./docker-start.sh`                             | 3001 |
| Start Frontend (dev)   | `cd packages/app && npm run dev`                | 4000 |
| Test Health            | `curl localhost:3001/api/health`                | 3001 |
| Test OAuth             | `POST localhost:3001/api/v4/github-oauth-token` | 3001 |
| Test Analysis          | `POST localhost:3001/api/v4/analyze-template`   | 3001 |

---

**Updated**: 2025-10-03  
**Status**: Express server now correctly uses port 3001 (not 7071)
