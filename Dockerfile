FROM node:20-alpine
WORKDIR /app

RUN npm install -g pnpm@9

# pnpm workspace: need every package's package.json before `pnpm install`
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY lib ./lib
COPY artifacts ./artifacts
COPY scripts ./scripts

RUN pnpm install --no-frozen-lockfile

# Remaining source (tsconfig, etc.) for `build:api` / tsc
COPY . .

RUN pnpm run build:api

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "artifacts/api-server/dist/index.mjs"]
