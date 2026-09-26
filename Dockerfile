# Dockerfile for CHRONOS API Backend on Render
FROM node:20-alpine

WORKDIR /app
ENV PORT=4000

# Install OpenSSL and compat libraries for Prisma on Alpine Linux
RUN apk add --no-cache openssl libc6-compat

# Copy workspace configuration and source code
COPY package*.json ./
COPY tsconfig.base.json ./
COPY prisma ./prisma/
COPY packages ./packages/
COPY apps/api ./apps/api/

# Install all dependencies including build tools
RUN npm ci --include=dev
RUN npx prisma generate
RUN npm run build --workspace=@chronos/shared
RUN npm run build --workspace=@chronos/solver
RUN npm run build --workspace=@chronos/nl-parser
RUN npm run build --workspace=@chronos/api

EXPOSE 4000

# Start CHRONOS API server (schema migration and seeding are separate deployment steps)
CMD ["npx", "tsx", "apps/api/src/index.ts"]
