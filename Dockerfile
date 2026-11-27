FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM deps AS build
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY db ./db
EXPOSE 3000
CMD ["node", "dist/src/server.js"]

# Imagem dos gates: código completo + devDependencies (typecheck, artefatos e testes).
FROM deps AS gates
COPY . .
CMD ["sh", "-c", "npm run typecheck && npm run check:artifacts && npm test"]
