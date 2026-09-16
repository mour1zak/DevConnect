# Build multi-stage: compila o NestJS e gera o client Prisma 7 (generated/prisma, git-ignored).
# node_modules do build é reaproveitado no runtime (em vez de reinstalar --omit=dev) porque
# "npx prisma migrate deploy" no CMD final precisa da CLI do prisma, que é devDependency.

FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/generated ./generated
COPY --from=build /app/prisma ./prisma
COPY package*.json ./
EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main"]
