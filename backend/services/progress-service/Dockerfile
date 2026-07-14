FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY backend ./backend

WORKDIR /app/backend/services/progress-service
EXPOSE 3002
CMD ["node", "server.js"]
