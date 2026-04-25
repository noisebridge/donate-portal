FROM oven/bun:1.3.13-alpine
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy files into the container
COPY src ./src
COPY types ./types
COPY scripts ./scripts
COPY tsconfig.json jsconfig.json tsconfig.base.json ./

ENV NODE_ENV=production
EXPOSE 3000

ENTRYPOINT ["bun", "src/server.ts"]
