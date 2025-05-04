# Use a fixed, more secure version of node (e.g., 20.1-alpine)
FROM node:slim

# Update and clean up package manager cache
RUN apt-get update && apt-get upgrade -y && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy only package files first (for caching)
COPY package*.json ./

# Install build dependencies to compile native modules (if needed)
RUN apk add --no-cache --virtual .build-deps build-base python3

# Install app dependencies
RUN npm install

# Remove build dependencies to reduce image size and attack surface
RUN apk del .build-deps

# Copy rest of the application code
COPY . .

# Create a non-root user (improves security)
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

# Expose port 3000
EXPOSE 3000

# Start the app
CMD ["node", "server.js"]
