# Use official Bun image
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy files into the container
COPY src ./src
COPY types ./types
COPY scripts ./scripts
COPY tsconfig.json jsconfig.json tsconfig.base.json ./

# Set production environment
ENV NODE_ENV=production

# Expose port (Render provides PORT environment variable)
EXPOSE 3000

# Run the app
ENTRYPOINT ["bun", "src/server.ts"]
