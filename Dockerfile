FROM node:20-alpine
WORKDIR /app
RUN npm install -g pnpm
COPY . .
RUN pnpm install
RUN pnpm run build:api
EXPOSE 3000
CMD ["node", "artifacts/api-server/dist/index.mjs"]
