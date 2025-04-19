# Stage 1: Build the application
FROM node:20-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy dependency manifests
COPY package.json pnpm-lock.yaml ./

# Install only production dependencies first for potential caching
RUN pnpm install --prod --frozen-lockfile

# Copy the rest of the application source code
COPY . .

# Install all dependencies (including devDependencies for build)
RUN pnpm install --frozen-lockfile

# Build the TypeScript project
RUN pnpm run build

# Prune devDependencies
RUN pnpm prune --prod

# Stage 2: Create the final production image
FROM node:20-alpine

WORKDIR /app

# Copy environment files (best practice is to mount or use secrets, but copy for simplicity)
# You might want to handle .env differently in production
# COPY .env.example .env

# Copy built application and production node_modules from the builder stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
# Copy the state file if it exists and you want it in the image (optional)
# COPY --from=builder /app/lastState.json ./

# Expose port if your application listens on one (not needed for this script)
# EXPOSE 3000

# Command to run the application
CMD ["node", "dist/index.js"] 