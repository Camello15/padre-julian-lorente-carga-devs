# Construir desde la raíz del repositorio: docker build -f backend/Dockerfile .
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace backend --omit=dev && npm cache clean --force
COPY backend/ backend/
WORKDIR /app/backend
ENV NODE_ENV=production
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3000/api/salud || exit 1
CMD ["node", "src/index.js"]
