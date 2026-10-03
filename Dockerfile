# Builds the app into a small image that runs on the server.
# Stage 1 installs packages, stage 2 builds, stage 3 keeps only what is needed to run.

FROM node:20-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:20-bookworm-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx prisma generate && npx next build

FROM node:20-bookworm-slim AS run
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/* \
 && npm install -g prisma@5.22.0 && npm cache clean --force \
 # download the database engines now, while building, not at first start
 && prisma --version
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# the "standalone" build: server.js + only the node_modules the app uses
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=build /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY docker/start.sh docker/bootstrap-admin.mjs ./docker/
RUN chmod +x docker/start.sh && useradd --system --uid 1001 app && chown -R app /app
USER app
EXPOSE 3000
CMD ["./docker/start.sh"]
