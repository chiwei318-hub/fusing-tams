FROM node:20-alpine
WORKDIR /app

RUN npm install -g pnpm

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY lib/ ./lib/
COPY artifacts/ ./artifacts/
COPY scripts/ ./scripts/
COPY tsconfig.json tsconfig.base.json ./

RUN pnpm install --no-frozen-lockfile
RUN pnpm run build:api
RUN cd artifacts/logistics && pnpm install --no-frozen-lockfile && pnpm run build

EXPOSE 8080
ENV NODE_ENV=production
ENV PORT=8080
ENV DRIZZLE_MIGRATIONS_PATH=/app/lib/db/drizzle

CMD ["node", "artifacts/api-server/dist/index.mjs"]
