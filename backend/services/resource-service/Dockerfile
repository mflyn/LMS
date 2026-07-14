FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY backend ./backend
RUN mkdir -p /var/lib/family-growth/private-media

WORKDIR /app/backend/services/resource-service
EXPOSE 3005
VOLUME ["/var/lib/family-growth/private-media"]
CMD ["node", "server.js"]
