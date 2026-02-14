# Multi-Stage Dockerfile for Foot Du Lundi
# Optimized for size and security with separate build and runtime stages

# ============================================================================
# Stage 0: Frontend Builder - Build React app
# ============================================================================
FROM node:24-slim AS frontend-builder

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build
# Output is now at /app/public/

# ============================================================================
# Stage 1: Builder - Compile native modules (better-sqlite3)
# ============================================================================
FROM node:24-slim AS builder

WORKDIR /build

# Install build dependencies and compile in one layer (Optimization #5)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json ./

# Install dependencies and clean up npm artifacts (Optimization #1 & #3)
RUN npm ci --omit=dev && \
    npm cache clean --force && \
    # Remove unnecessary files from node_modules to reduce size (Optimization #3)
    # Note: We avoid deleting test dirs from playwright as they contain required modules
    find node_modules -name "*.md" -o -name "*.map" | xargs rm -f 2>/dev/null || true && \
    find node_modules -type d -name ".github" | xargs rm -rf 2>/dev/null || true

# ============================================================================
# Stage 2: Playwright Builder - Install Chromium browser
# ============================================================================
FROM node:24-slim AS playwright-builder

WORKDIR /app

# Copy compiled node_modules from builder
COPY --from=builder /build/node_modules ./node_modules
COPY package.json ./

# Install Playwright Chromium with all required system dependencies
RUN npx playwright install --with-deps chromium && \
    rm -rf /var/lib/apt/lists/* && \
    rm -rf /root/.cache/ms-playwright-tmp 2>/dev/null || true && \
    rm -rf /root/.npm 2>/dev/null || true

# ============================================================================
# Stage 3: Runtime - Final production image
# ============================================================================
FROM node:24-slim

# Accept PUID and PGID as build arguments (defaults to 1000)
ARG PUID=1000
ARG PGID=1000

WORKDIR /app

# Copy production-ready node_modules and Playwright browser from previous stages
COPY --from=playwright-builder /app/node_modules ./node_modules
COPY --from=playwright-builder /root/.cache/ms-playwright /home/node/.cache/ms-playwright
COPY package.json package-lock.json ./

# Install Playwright system dependencies and clean up
RUN npx playwright install-deps chromium && \
    rm -rf /var/lib/apt/lists/* \
    && find /usr/share/locale -mindepth 1 -maxdepth 1 ! -name 'en*' ! -name 'fr*' -exec rm -rf {} + 2>/dev/null || true \
    && find /usr/share/doc -mindepth 1 -exec rm -rf {} + 2>/dev/null || true \
    && find /usr/share/man -mindepth 1 -exec rm -rf {} + 2>/dev/null || true \
    && rm -rf /root/.npm 2>/dev/null || true

# Copy application code
COPY src/ src/
# Copy built frontend (from React build) + preserved static files
COPY --from=frontend-builder /app/public/ public/
# Copy stripe-confirm.html and icons (not part of React build)
COPY public/stripe-confirm.html public/icon.svg public/

# Create data directory, configure user with specified PUID/PGID, and set ownership in one layer (Optimization #5)
RUN mkdir -p data && \
    # Modify node user to use specified PUID/PGID
    groupmod -o -g ${PGID} node && \
    usermod -o -u ${PUID} node && \
    chown -R node:node /app /home/node/.cache

# Health check - verify the API is responding
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/api/credentials/status', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Run as non-root user for security
USER node

EXPOSE 3000

CMD ["node", "src/server.js"]
