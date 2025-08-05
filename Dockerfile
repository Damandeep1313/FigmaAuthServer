# Use a Node.js slim image based on Debian
FROM node:20-slim

# Set working directory
WORKDIR /app

# Copy only package files first (for caching)
COPY package*.json ./

# Install dependencies to compile native modules (using APT for Debian-based images)
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Install app dependencies
RUN npm install

# Copy rest of the code
COPY . .

# Expose port 3000
EXPOSE 3000

# Start the app
CMD ["node", "server1.js"]
