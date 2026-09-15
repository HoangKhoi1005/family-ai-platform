FROM node:24.18.0-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/database/package.json packages/database/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/media/package.json packages/media/package.json
COPY packages/ui/package.json packages/ui/package.json
RUN npm ci

FROM dependencies AS build
ENV NEXT_TELEMETRY_DISABLED=1
ENV TURBO_TELEMETRY_DISABLED=1
ENV API_INTERNAL_URL=http://api:4010
COPY . .
RUN npm run build

FROM node:24.18.0-bookworm-slim AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node --from=build /app /app
USER node
CMD ["node", "apps/api/dist/server.js"]

FROM node:24.18.0-bookworm-slim AS web
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --chown=node:node --from=build /app /app
USER node
CMD ["node", "node_modules/next/dist/bin/next", "start", "apps/web", "--hostname", "0.0.0.0", "--port", "3200"]

FROM node:24.18.0-bookworm-slim AS worker
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node --from=build /app /app
USER node
CMD ["node", "apps/worker/dist/index.js"]

FROM node:24.18.0-bookworm-slim AS tools
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node --from=build /app /app
USER node
CMD ["node", "packages/database/scripts/status.mjs"]
