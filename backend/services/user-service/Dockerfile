FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY backend ./backend

WORKDIR /app/backend/services/user-service
EXPOSE 3001
CMD ["node", "server.js"]
