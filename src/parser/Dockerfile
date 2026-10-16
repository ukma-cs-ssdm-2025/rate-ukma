FROM node:24.21.0-alpine AS build
RUN npm install -g --ignore-scripts pnpm@11.20.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY src ./src
RUN pnpm build

FROM alpine:3.24.2 AS final
LABEL org.opencontainers.image.source="https://github.com/ukma-cs-ssdm-2025/rate-ukma" \
	org.opencontainers.image.description="UKMA Data service: api, worker and migrate" \
	org.opencontainers.image.licenses="GPL-3.0-or-later"
RUN apk add --no-cache libstdc++ \
	&& addgroup -g 1000 node \
	&& adduser -u 1000 -G node -s /sbin/nologin -D node
COPY --from=build /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/dist/main.js ./main.js
USER node
EXPOSE 8080
ENTRYPOINT ["node", "main.js"]
CMD ["api"]
