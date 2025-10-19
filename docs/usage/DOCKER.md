# Docker Deployment Guide

Run Template Doctor in Docker containers for local testing or production deployment.

## Quick Start

### 1. Prerequisites

- Docker Desktop installed and running
- `.env` file configured (see `.env.example`)

### 2. Start Everything

```bash
./docker-start.sh
```

This will:

- Build the Express server
- Build the Vite frontend
- Start both containers
- Set up networking between them

### 3. Access the Application

- **Frontend**: http://localhost:4000
- **Backend**: http://localhost:7071
- **Health Check**: http://localhost:7071/health

### 4. Stop Everything

```bash
./docker-stop.sh
```

Or with cleanup:

```bash
./docker-stop.sh --clean
```

---

## Docker Commands

### Start Containers

```bash
# Start normally
./docker-start.sh

# Start with rebuild
./docker-start.sh --build

# Start and follow logs
./docker-start.sh --logs
```

### View Logs

```bash
# All services
docker-compose logs -f

# Just backend
docker-compose logs -f server

# Just frontend
docker-compose logs -f app
```

### Container Management

```bash
# Check status
docker-compose ps

# Restart services
docker-compose restart

# Restart specific service
docker-compose restart server

# Stop without removing
docker-compose stop

# Start stopped containers
docker-compose start
```

### Rebuild After Code Changes

```bash
# Rebuild and restart
./docker-start.sh --build

# Or manually
npm run build -w packages/server
npm run build -w packages/app
docker-compose up -d --build
```

---

## Architecture

### Container Setup

```
┌─────────────────────────────────────┐
│  Docker Host (localhost)            │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐   │
│  │  Frontend Container         │   │
│  │  - Vite build output        │   │
│  │  - Served via 'serve'       │   │
│  │  - Port: 4000               │   │
│  └─────────────────────────────┘   │
│              ↓                      │
│  ┌─────────────────────────────┐   │
│  │  Backend Container          │   │
│  │  - Express server           │   │
│  │  - Node.js 20               │   │
│  │  - Port: 7071               │   │
│  └─────────────────────────────┘   │
│                                     │
└─────────────────────────────────────┘
```

### Environment Variables

Environment variables are read from `.env` and passed to containers:

**Backend (server)**:

- `GITHUB_CLIENT_ID` - OAuth app client ID
- `GITHUB_CLIENT_SECRET` - OAuth app secret
- `GITHUB_TOKEN` - PAT for GitHub API
- `GH_WORKFLOW_TOKEN` - Workflow token
- `GITHUB_TOKEN_ANALYZER` - Analyzer token
- `DEFAULT_RULE_SET` - Default validation ruleset
- `ARCHIVE_ENABLED` - Enable archiving
- etc. (see `docker-compose.yml`)

**Frontend (app)**:

- `VITE_API_BASE_URL` - Backend URL (set to http://localhost:7071)

---

## Troubleshooting

### Containers Won't Start

**Check Docker is running:**

```bash
docker ps
```

**Check for port conflicts:**

```bash
lsof -ti :4000 | xargs kill -9  # Kill process on 4000
lsof -ti :7071 | xargs kill -9  # Kill process on 7071
```

**View container logs:**

```bash
docker-compose logs server
docker-compose logs app
```

### Backend Health Check Fails

```bash
# Check if backend is responding
curl http://localhost:7071/health

# Check backend logs
docker-compose logs server

# Restart backend
docker-compose restart server
```

### Frontend Can't Connect to Backend

**Check network:**

```bash
docker-compose ps
docker network inspect template-doctor_template-doctor
```

**Verify backend URL in frontend:**
The frontend should connect to `http://localhost:7071` (not the container name).

### Build Failures

**Clean rebuild:**

```bash
./docker-stop.sh --clean
npm run clean -w packages/server
npm run clean -w packages/app
./docker-start.sh --build
```

**Check disk space:**

```bash
docker system df
docker system prune  # Clean up if needed
```

### Missing .env File

```bash
cp .env.example .env
# Edit .env with your values
```

---

## Production Deployment

### Build Production Images

```bash
# Build images
docker-compose build

# Tag for registry
docker tag template-doctor-server:latest your-registry/template-doctor-server:v1.0.0
docker tag template-doctor-app:latest your-registry/template-doctor-app:v1.0.0

# Push to registry
docker push your-registry/template-doctor-server:v1.0.0
docker push your-registry/template-doctor-app:v1.0.0
```

### Deploy to Azure Container Apps

```bash
# Create container app environment
az containerapp env create \
  --name template-doctor-env \
  --resource-group your-rg \
  --location eastus

# Deploy backend
az containerapp create \
  --name template-doctor-server \
  --resource-group your-rg \
  --environment template-doctor-env \
  --image your-registry/template-doctor-server:v1.0.0 \
  --target-port 7071 \
  --ingress external \
  --env-vars \
    GITHUB_TOKEN=secretref:github-token \
    GITHUB_CLIENT_ID=secretref:github-client-id

# Deploy frontend
az containerapp create \
  --name template-doctor-app \
  --resource-group your-rg \
  --environment template-doctor-env \
  --image your-registry/template-doctor-app:v1.0.0 \
  --target-port 4000 \
  --ingress external
```

---

## Development Workflow

### Local Development (Recommended)

For active development, **don't use Docker**. Use the native dev servers:

```bash
# Terminal 1: Backend
cd packages/server
npm run dev

# Terminal 2: Frontend
cd packages/app
npm run dev
```

Docker is for:

- Testing the production build locally
- Validating deployment configuration
- Running integration tests
- Final pre-production verification

### When to Use Docker

✅ **Use Docker when:**

- Testing production builds
- Validating environment variables
- Testing container deployment
- Running full integration tests
- Demonstrating to stakeholders

❌ **Don't use Docker when:**

- Actively coding (slow rebuild cycle)
- Debugging (harder to attach debugger)
- Running unit tests (slower)
- Making frequent changes

---

## Container Optimization

### Image Sizes

Current approximate sizes:

- **Backend**: ~150MB (Node 20 Alpine + dependencies)
- **Frontend**: ~80MB (Static files + serve)

### Build Performance

**Speed up builds:**

1. Use `.dockerignore` to exclude unnecessary files
2. Leverage Docker layer caching
3. Use multi-stage builds (already implemented)
4. Build locally before `docker-compose up`

**Cached layers:**

- Base image (node:20-alpine)
- Dependencies (package.json + npm ci)
- Build output (only rebuilt when source changes)

---

## Monitoring

### Health Checks

Both containers have health checks:

```bash
# Check health status
docker-compose ps

# View health check logs
docker inspect template-doctor-server | jq '.[0].State.Health'
docker inspect template-doctor-app | jq '.[0].State.Health'
```

### Resource Usage

```bash
# Real-time stats
docker stats

# Container info
docker-compose top
```

---

## Files

```
/
├── docker-compose.yml       # Multi-container orchestration
├── docker-start.sh          # Start script
├── docker-stop.sh           # Stop script
├── .dockerignore            # Files to exclude from build
├── .env                     # Environment variables (not committed)
└── packages/
    ├── server/
    │   └── Dockerfile       # Backend container
    └── app/
        └── Dockerfile       # Frontend container
```

---

## Next Steps

1. ✅ Start containers: `./docker-start.sh`
2. ✅ Test locally: http://localhost:4000
3. ⏳ Deploy to Azure Container Apps
4. ⏳ Set up CI/CD pipeline
5. ⏳ Configure production secrets

For more information:

- Express server: `packages/server/README.md`
- Frontend app: `packages/app/README.md`
- Migration status: `packages/server/MIGRATION_STATUS.md`
