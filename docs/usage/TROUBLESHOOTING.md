# Troubleshooting Guide

Common issues and solutions for Template Doctor setup and operation.

## MongoDB Connection Errors

### Symptom
```
MongoServerSelectionError: connect ECONNREFUSED ::1:27017
MongoServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017
```

### Root Cause
The application is trying to connect to `localhost:27017` instead of the Docker container named `mongodb`.

### Solution

**1. Check your `.env` file:**

The `MONGODB_URI` variable **MUST be commented out** (or not present) for Docker Compose local development:

```bash
# ✅ CORRECT - Leave commented out
# MONGODB_URI - DO NOT SET for local dev! Docker Compose handles this automatically.

# ❌ WRONG - Do not uncomment these
# MONGODB_URI=mongodb://localhost:27017/template-doctor
# MONGODB_URI=mongodb://127.0.0.1:27017/template-doctor
```

**2. How Docker Compose works:**

When `MONGODB_URI` is **not set** in your `.env` file, Docker Compose uses this fallback in `docker-compose.yml`:

```yaml
environment:
  - MONGODB_URI=${MONGODB_URI:-mongodb://mongodb:27017/template-doctor}
```

The `mongodb://mongodb:27017` part uses the **service name** (`mongodb`), not `localhost`, which is how Docker containers communicate with each other.

**3. Verify MongoDB container is running:**

```bash
docker ps | grep mongodb
```

You should see output like:
```
template-doctor-mongodb   Up 2 minutes   0.0.0.0:27017->27017/tcp
```

**4. Restart Docker Compose:**

```bash
# Stop all containers
docker-compose down

# Start with combined profile (app + MongoDB)
docker-compose --profile combined up
```

**5. If still having issues:**

- **Delete your `.env` file** and re-run the setup script:
  ```bash
  rm .env
  ./scripts/full-setup.sh
  ```
  
- **Choose option 1** (Local development) when prompted for MongoDB setup

- **Verify the generated `.env` file** has `MONGODB_URI` commented out:
  ```bash
  grep MONGODB_URI .env
  ```
  
  Expected output:
  ```bash
  # MONGODB_URI - DO NOT SET for local dev! Docker Compose handles this automatically.
  ```

## OAuth Redirect Errors

### Symptom
After clicking "Sign in with GitHub", you get redirected to a 404 page or see an error.

### Solution

**1. Check OAuth callback URL matches your local setup:**

Your GitHub OAuth app callback URL must be:
```
http://localhost:3000/callback.html
```

**NOT** `http://localhost:4000` or any other port.

**2. Verify `.env` has correct OAuth credentials:**

```bash
GITHUB_CLIENT_ID=Ov23abcd1234example
GITHUB_CLIENT_SECRET=abc123...
```

**3. Make sure port 3000 is not in use:**

```bash
lsof -ti :3000 | xargs kill -9
```

## Docker Build Errors

### Symptom
```
Error response from daemon: failed to build: ...
```

### Solution

**1. Clear Docker build cache:**

```bash
docker-compose down
docker system prune -a
docker-compose --profile combined up --build
```

**2. Check Docker daemon is running:**

```bash
docker info
```

**3. Ensure you have enough disk space:**

Docker images can be large. Free up space if needed:

```bash
docker system df
docker system prune -a --volumes
```

## Port Already in Use

### Symptom
```
Error starting userland proxy: listen tcp4 0.0.0.0:3000: bind: address already in use
```

### Solution

**Find and kill the process using port 3000:**

```bash
# macOS/Linux
lsof -ti :3000 | xargs kill -9

# Or use Docker's port conflict resolution
docker-compose down
lsof -ti :3000 | xargs kill -9
docker-compose --profile combined up
```

## GitHub Token Errors

### Symptom
```
401 Unauthorized
403 Forbidden
```

### Solution

**1. Verify token scopes:**

Your GitHub Personal Access Token needs these scopes:
- `repo` (full control)
- `workflow` (update workflows)
- `read:user` (read user profile)

**2. Test your token:**

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" https://api.github.com/user
```

**3. Generate a new token if needed:**

1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with required scopes
3. Update `.env` file with new token

## Database Not Persisting Data

### Symptom
Analysis results disappear after restarting Docker.

### Solution

**1. Check Docker volumes:**

```bash
docker volume ls | grep template-doctor
```

You should see `template-doctor_mongodb_data`.

**2. Ensure volume is mounted:**

In `docker-compose.yml`, verify:

```yaml
mongodb:
  volumes:
    - mongodb_data:/data/db
```

**3. Don't use `docker-compose down -v`:**

The `-v` flag **deletes volumes**. Use this instead:

```bash
# Stop containers but keep data
docker-compose down

# Stop and remove everything INCLUDING DATA (careful!)
docker-compose down -v
```

## CORS Errors

### Symptom
```
Access to fetch at 'http://localhost:3001/api/...' from origin 'http://localhost:3000' has been blocked by CORS policy
```

### Solution

This should **not** happen with the combined Docker image (both frontend and backend on port 3000).

**If you see this:**

1. You're running in multi-container mode (dev profile)
2. Make sure you're using the combined profile instead:

```bash
docker-compose down
docker-compose --profile combined up
```

## Getting Help

If you're still having issues:

1. **Check the logs:**
   ```bash
   docker-compose logs -f
   ```

2. **Check existing issues:**
   https://github.com/Azure-Samples/template-doctor/issues

3. **Create a new issue:**
   Include:
   - Error message (full stack trace)
   - Your OS and Docker version
   - Contents of `.env` (redact secrets!)
   - Output of `docker ps`
   - Output of `docker-compose logs`

4. **Ask in discussions:**
   https://github.com/Azure-Samples/template-doctor/discussions
