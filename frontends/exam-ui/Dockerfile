# Stage 1: Build
FROM node:18-slim AS builder
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./

# Install ALL dependencies (including dev)
# Using --legacy-peer-deps to handle TensorFlow peer dependency conflicts
RUN npm install --legacy-peer-deps

# Copy source
COPY . .

# Build (call vite directly with node)
RUN node node_modules/vite/bin/vite.js build

# Stage 2: Serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
