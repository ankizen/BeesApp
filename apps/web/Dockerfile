FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/package.json
# --include=dev: some hosts (Coolify among them) leak NODE_ENV=production
# into the build environment, which makes plain `npm install` silently omit
# devDependencies (tsc/vite) - force them regardless.
RUN npm install --workspace=apps/web --include-workspace-root --include=dev

COPY apps/web apps/web
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
RUN npm run build -w apps/web

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
