FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY packages/server/package*.json ./

# Install dependencies (use install instead of ci since we don't have package-lock)
RUN npm install --omit=dev

# Copy built server code
COPY packages/server/dist ./dist
COPY packages/server/.env.example ./.env.example

# Set configurable port (default 3000 for OAuth compatibility)
ARG PORT=3000
ENV PORT=$PORT

# Expose port
EXPOSE $PORT

# Health check (uses PORT environment variable)
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:$PORT/api/health || exit 1

# Start server
CMD ["node", "dist/index.js"]
