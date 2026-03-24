# ── Stage 1: build ────────────────────────────────────────────────────────────
FROM node:24-alpine AS builder

WORKDIR /app

# Install dependencies first (layer cache-friendly)
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy source and compile TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN yarn build

# ── Stage 2: runtime ──────────────────────────────────────────────────────────
FROM node:24-alpine AS runtime

WORKDIR /app

# Copy only production dependencies
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production

# Copy compiled output from builder stage
COPY --from=builder /app/dist ./dist

# Persist datasets to a Docker volume
VOLUME ["/app/data"]

EXPOSE 1220

ENV NODE_ENV=production \
    PORT=1220

CMD ["node", "dist/App.js"]
