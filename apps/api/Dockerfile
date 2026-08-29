# Dockerfile for CHRONOS API Backend on Render
FROM node:20-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# Install OpenSSL and compat libraries for Prisma on Alpine Linux
RUN apk add --no-cache openssl libc6-compat

# Copy workspace configuration and source code
COPY package*.json ./
COPY tsconfig.base.json ./
COPY prisma ./prisma/
COPY packages ./packages/
COPY apps/api ./apps/api/

# Install dependencies and generate Prisma client
RUN npm ci
RUN npx prisma generate

EXPOSE 4000

# Push schema to Neon, seed institutional data, and start API server
CMD ["sh", "-c", "npx prisma db push && npx tsx prisma/seed.ts && npx tsx apps/api/src/index.ts"]
