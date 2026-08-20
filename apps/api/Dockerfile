# Shared image for both the API server and the queue workers - the CMD
# differs per service in docker-compose, the build is identical.
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
# --include=dev: some hosts (Coolify among them) leak NODE_ENV=production
# into the build environment, which makes plain `npm install` silently omit
# devDependencies (tsc/prisma/tsx) - force them regardless.
RUN npm install --workspace=apps/api --include-workspace-root --include=dev

COPY apps/api apps/api
RUN npm run prisma:generate -w apps/api
RUN npm run build -w apps/api

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/package.json ./apps/api/package.json

WORKDIR /app/apps/api
EXPOSE 4000
CMD ["node", "dist/server.js"]
