# ==============================================================================
# Stage 1: Build React SPA Frontend with Vite
# ==============================================================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Copy dependency manifests and install clean Linux node_modules
COPY frontend/package*.json ./
RUN npm install

# Copy only source and configuration files (ignoring any host node_modules)
COPY frontend/index.html ./
COPY frontend/tsconfig*.json ./
COPY frontend/vite.config.ts ./
COPY frontend/src/ ./src/

# Compile React TypeScript code into /app/dist
RUN npm run build

# ==============================================================================
# Stage 2: Production Nginx Web Server & API Gateway
# ==============================================================================
FROM nginx:alpine
# Copy compiled static frontend bundles (HTML, JS, CSS, assets)
COPY --from=frontend-builder /app/dist /usr/share/nginx/html

# Copy unified API gateway reverse proxy configuration
COPY nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
