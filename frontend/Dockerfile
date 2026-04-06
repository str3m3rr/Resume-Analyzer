# Stage 1: Build the Vite app
FROM node:20-slim AS build

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json* ./
RUN npm install

# Copy all files and build
COPY . .

# Pass VITE_API_URL during build time for the final bundle
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Stage 2: Serve with Nginx
FROM nginx:alpine

# Copy the custom Nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built files from Stage 1 to Nginx's default directory
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80 for Nginx
EXPOSE 80

# Run Nginx
CMD ["nginx", "-g", "daemon off;"]