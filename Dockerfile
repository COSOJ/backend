# syntax=docker/dockerfile:1

# ---- Build stage: compile TypeScript to dist/ ----
FROM node:20-alpine AS build
WORKDIR /app
RUN npm install -g pnpm@10
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# --ignore-scripts skips the `prepare` hook (lefthook install), which requires
# a git checkout that does not exist in the build context.
RUN pnpm install --frozen-lockfile --ignore-scripts
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN pnpm build

# ---- Runtime stage: production deps + compiled output ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# docker-cli lets the judge spawn sibling sandbox containers through the host's
# Docker socket (docker-out-of-docker). The daemon itself lives on the host.
RUN apk add --no-cache docker-cli
RUN npm install -g pnpm@10
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile --ignore-scripts
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
