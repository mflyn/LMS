FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY backend ./backend
# Empty named volumes inherit these permissions on every container creation.
RUN mkdir -p /var/lib/family-growth/private-media /var/lib/family-growth/completion-journal \
    && chmod 0700 /var/lib/family-growth/private-media \
    && chmod 0700 /var/lib/family-growth/completion-journal

WORKDIR /app/backend/services/resource-service
EXPOSE 3005
VOLUME ["/var/lib/family-growth/private-media"]
CMD ["node", "server.js"]
