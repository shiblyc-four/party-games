FROM node:20-alpine

WORKDIR /app

# Copy root workspace files
COPY package.json package-lock.json* ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/server/package.json ./packages/server/
COPY packages/client/package.json ./packages/client/

# Install dependencies
RUN npm ci

# Copy source code
COPY packages/shared/ ./packages/shared/
COPY packages/server/ ./packages/server/
COPY tsconfig.base.json ./

# Build
RUN npm run build -w packages/shared
RUN npm run build -w packages/server

# Expose port
EXPOSE 3001

# Start server
CMD ["node", "packages/server/dist/index.js"]
