# Multi-stage Dockerfile for CHRONOS API Backend
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root manifest and workspace configurations
COPY package*.json ./
COPY tsconfig.base.json ./
COPY prisma ./prisma/
COPY packages ./packages/
COPY apps/api ./apps/api/

# Install dependencies and build monorepo packages
RUN npm ci
RUN npx prisma generate
RUN npm run build --workspace=@chronos/shared
RUN npm run build --workspace=@chronos/solver
RUN npm run build --workspace=@chronos/nl-parser
RUN npm run build --workspace=@chronos/api

# Production runtime stage
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Copy runtime files
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json

EXPOSE 4000

# Push schema, seed dataset if empty, and start API server
CMD ["sh", "-c", "npx prisma db push && npx tsx prisma/seed.ts && node apps/api/dist/index.js"]
