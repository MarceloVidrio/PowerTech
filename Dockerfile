# ---------- 1. Construir el frontend (Vue) ----------
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---------- 2. Imagen final del backend (Express) ----------
FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --omit=dev

COPY backend/ ./
# Certificado de AWS RDS para conexiones cifradas (DB_SSL=true)
RUN wget -q -O ./src/config/global-bundle.pem https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

# Frontend compilado
COPY --from=frontend-builder /app/frontend/dist ./public

# Los secretos NO van en la imagen: se pasan al ejecutar con --env-file.
RUN rm -f .env && chown -R node:node /app
USER node

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "src/app.js"]
