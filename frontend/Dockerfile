# Construir desde la raíz del repositorio: docker build -f frontend/Dockerfile .
FROM node:22-alpine AS construccion
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace frontend
COPY frontend/ frontend/
RUN npm run build --workspace frontend

FROM nginx:1.27-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=construccion /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
