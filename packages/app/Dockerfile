# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY packages/app/package*.json ./

# Install all dependencies (including dev for build)
RUN npm install

# Copy source code
COPY packages/app/ ./

# Build the app
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install a simple static file server
RUN npm install -g serve

# Copy built files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/config.json ./dist/config.json
COPY --from=builder /app/results ./dist/results

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:4000/ || exit 1

# Serve the static files
CMD ["serve", "-s", "dist", "-l", "4000"]
