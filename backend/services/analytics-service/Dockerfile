FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY backend ./backend

WORKDIR /app/backend/services/analytics-service
EXPOSE 3006
CMD ["node", "server.js"]
