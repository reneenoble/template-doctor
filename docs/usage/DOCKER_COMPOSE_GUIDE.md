# Docker Compose Usage Guide

This guide explains how to use Docker Compose with Template Doctor for different deployment scenarios.

## Quick Start (Recommended: Combined Container)

The combined container runs both Express backend and Vite frontend in a single container on port 3000.

```bash
# Start combined container with MongoDB
docker-compose --profile combined up

# Start only combined container (no database)
docker-compose up combined

# Start in detached mode
docker-compose --profile combined up -d

# View logs
docker-compose logs -f combined

# Stop services
docker-compose --profile combined down
```

**Access the app**: http://localhost:3000

## Development Mode (Multi-Container)

Run separate containers for backend (port 3001) and frontend (port 4000).

```bash
# Start all dev services
docker-compose --profile dev up

# Start in detached mode
docker-compose --profile dev up -d

# View logs
docker-compose logs -f server app

# Stop services
docker-compose --profile dev down
```

**Access**:
- Frontend: http://localhost:4000
- Backend API: http://localhost:3001

## With Local MongoDB

Add MongoDB container for database persistence:

```bash
# Combined container + MongoDB
docker-compose --profile combined up combined mongodb

# Dev containers + MongoDB
docker-compose --profile dev up server app mongodb
```

**MongoDB Connection**:
- Host: localhost:27017
- Database: template-doctor
- Connection string: `mongodb://localhost:27017/template-doctor`

Add to `.env`:
```bash
MONGODB_URI=mongodb://mongodb:27017/template-doctor
```

## Environment Variables

All services read from `.env` file. Required variables:

```bash
# GitHub OAuth (required)
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret

# GitHub Token (required for analysis)
GITHUB_TOKEN=ghp_your_token

# Database (optional - enables persistence)
MONGODB_URI=mongodb://mongodb:27017/template-doctor

# Or use Cosmos DB
COSMOS_ENDPOINT=https://your-account.documents.azure.com:443/
COSMOS_KEY=your_key
COSMOS_DATABASE_NAME=template-doctor
```

## Service Profiles

Docker Compose uses profiles to organize services:

| Profile | Services | Use Case |
|---------|----------|----------|
| `combined` | combined, mongodb (optional) | **Production-like single container** |
| `dev` | server, app, mongodb (optional) | Development with separate containers |
| (none) | Explicit service names only | Manual service selection |

## Common Commands

```bash
# Build images (after code changes)
docker-compose build combined

# Force rebuild (ignore cache)
docker-compose build --no-cache combined

# View running containers
docker-compose ps

# View logs
docker-compose logs -f [service_name]

# Execute command in container
docker-compose exec combined sh

# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v

# Restart specific service
docker-compose restart combined
```

## Health Checks

All containers include health checks:

```bash
# Check container health
docker-compose ps

# View health check logs
docker inspect template-doctor-combined | grep -A 10 Health
```

Health check endpoints:
- Combined: http://localhost:3000/api/health
- Server: http://localhost:3001/api/health

## Networking

All services connect via `template-doctor` bridge network:

- **Combined mode**: Single container, no network config needed
- **Dev mode**: Server and app communicate via internal network
- **MongoDB**: Accessible at `mongodb:27017` from containers

## Volume Persistence

MongoDB data persists in named volume `mongodb_data`:

```bash
# List volumes
docker volume ls | grep template-doctor

# Inspect volume
docker volume inspect template-doctor_mongodb_data

# Backup database
docker-compose exec mongodb mongodump --out=/data/backup

# Remove volume (deletes data!)
docker-compose down -v
```

## Troubleshooting

### Port Conflicts
```bash
# Check if ports are in use
lsof -ti :3000 | xargs kill -9  # Combined
lsof -ti :3001 | xargs kill -9  # Server
lsof -ti :4000 | xargs kill -9  # App
lsof -ti :27017 | xargs kill -9 # MongoDB
```

### Container Won't Start
```bash
# View detailed logs
docker-compose logs combined

# Check environment variables
docker-compose config

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache combined
docker-compose --profile combined up
```

### Database Connection Issues
```bash
# Test MongoDB connection
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Check container network
docker network inspect template-doctor_template-doctor

# Verify connection string in container
docker-compose exec combined printenv | grep MONGODB
```

### OAuth Redirect Errors
- **Combined (port 3000)**: Callback URL must be `http://localhost:3000/callback.html`
- **Dev (port 4000)**: Callback URL must be `http://localhost:4000/callback.html`

Update GitHub OAuth App settings to match your deployment.

## Production Deployment

For production, use the combined container:

```bash
# Build optimized image
docker-compose build combined

# Start with restart policy
docker-compose --profile combined up -d

# Monitor logs
docker-compose logs -f combined
```

**Production checklist**:
- [ ] Set `NODE_ENV=production` in .env
- [ ] Configure Cosmos DB connection (not local MongoDB)
- [ ] Set strong `GITHUB_CLIENT_SECRET`
- [ ] Use production GitHub OAuth app
- [ ] Enable `REQUIRE_AUTH_FOR_RESULTS=true`
- [ ] Configure monitoring/logging
- [ ] Set up SSL/TLS termination (reverse proxy)

## Migration from Azure Functions

If migrating from Azure Functions:

1. **Ports changed**:
   - Azure Functions: 7071
   - Express: 3000 (combined) or 3001 (dev)

2. **Update .env**:
   - Remove `FUNCTIONS_*` variables
   - Ensure `PORT=3000` (combined) or `PORT=3001` (server)

3. **OAuth callback**:
   - Change from `:7071/api/...` to `:3000/...`

4. **Database**:
   - Add `MONGODB_URI` or `COSMOS_ENDPOINT`

## Next Steps

- **Local development**: See [DOCKER.md](DOCKER.md)
- **Azure deployment**: See [docs/deployment/AZD_DEPLOYMENT.md](docs/deployment/AZD_DEPLOYMENT.md)
- **Admin settings**: See [docs/deployment/ADMIN_SETTINGS.md](docs/deployment/ADMIN_SETTINGS.md)
- **Database setup**: See [docs/development/DATA_LAYER.md](docs/development/DATA_LAYER.md)
