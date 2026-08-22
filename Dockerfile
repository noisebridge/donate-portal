FROM oven/bun:1.4.0-alpine
WORKDIR /app

# Install dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# Copy files into the container
COPY src ./src
COPY types ./types
COPY scripts ./scripts
COPY tsconfig.json jsconfig.json tsconfig.base.json ./

# Pre-compress static assets for @fastify/static (brotli + gzip)
RUN apk add --no-cache brotli gzip \
 && find src/assets -type f -regex '.*\.\(mjs\|css\|svg\)' \
      -exec brotli --best {} \; \
      -exec gzip --best --keep {} \;

ENV NODE_ENV=production
ARG GIT_COMMIT
ENV GIT_COMMIT=$GIT_COMMIT
EXPOSE 3000

ENTRYPOINT ["bun", "src/server.ts"]
