# Multi-Stage Dockerfile for Foot Du Lundi
# Optimized for size and security with separate build and runtime stages

# ============================================================================
# Stage 1: Builder - Compile native modules (better-sqlite3)
# ============================================================================
FROM node:20-slim AS builder

WORKDIR /build

# Install build dependencies (only needed for compiling native modules)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./

# Install all dependencies and compile native modules
RUN npm ci && npm cache clean --force

# ============================================================================
# Stage 2: Playwright Builder - Install Chromium browser
# ============================================================================
FROM node:20-slim AS playwright-builder

WORKDIR /app

# Install Playwright runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Copy compiled node_modules from builder
COPY --from=builder /build/node_modules ./node_modules
COPY package.json ./

# Install Playwright Chromium browser
RUN npx playwright install chromium

# ============================================================================
# Stage 3: Runtime - Final production image
# ============================================================================
FROM node:20-slim

WORKDIR /app

# Install only runtime dependencies (no build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libpango-1.0-0 \
    libcairo2 \
    libasound2 \
    libxshmfence1 \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

# Copy production-ready node_modules and Playwright browser from previous stages
COPY --from=playwright-builder /app/node_modules ./node_modules
COPY --from=playwright-builder /root/.cache/ms-playwright /root/.cache/ms-playwright

# Copy application code
COPY package.json package-lock.json ./
COPY src/ src/
COPY public/ public/

# Create data directory for SQLite database
RUN mkdir -p data

# Health check - verify the API is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/credentials/status', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Change ownership to node user (already exists in node:20-slim with UID 1000)
RUN chown -R node:node /app

# Run as non-root user for security
USER node

EXPOSE 3000

CMD ["node", "src/server.js"]
