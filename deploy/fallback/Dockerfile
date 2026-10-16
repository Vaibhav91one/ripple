FROM node:22-alpine AS build
WORKDIR /app
RUN npm i -g pnpm@10.18.2
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build \
 && cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public

FROM node:22-alpine
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/.next/standalone ./
EXPOSE 3000
CMD ["node", "server.js"]
