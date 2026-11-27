# A clarusjs site in a container: built with the dev dependencies, run with only the production ones.
#   docker build -t my-site . && docker run -p 3000:3000 my-site
# clarusjs is a dependency (not a devDependency): the built server imports it at runtime.
# package-lock.json must be committed (run npm install once): npm ci installs exactly what it lists.
FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT}/`).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node_modules/.bin/clarusjs", "serve"]
