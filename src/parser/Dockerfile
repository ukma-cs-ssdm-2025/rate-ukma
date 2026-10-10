FROM node:22.23.2-alpine AS base
RUN npm install -g pnpm@11.20.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod

FROM node:22.23.2-alpine AS final
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
USER node
EXPOSE 8080
ENTRYPOINT ["node", "src/main.ts"]
CMD ["api"]
