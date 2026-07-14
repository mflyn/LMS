FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY backend ./backend

WORKDIR /app/backend/services/notification-service
EXPOSE 3007
CMD ["node", "server.js"]
