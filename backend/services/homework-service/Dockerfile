FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY backend ./backend

WORKDIR /app/backend/services/homework-service
EXPOSE 3003
CMD ["node", "server.js"]
