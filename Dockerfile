# ================================================
# Dockerfile - Backend Búsqueda y Descubrimiento
# Grupo 3 - Pulga Shop
# Puerto: 5610
# ================================================

# Etapa de construcción
FROM node:20 AS build

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
RUN npm install

# Copiar código fuente
COPY . .

# Compilar TypeScript
RUN npm run build

# Etapa de producción
FROM node:20-slim

WORKDIR /app

# Copiar archivos compilados y dependencias
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package*.json ./
COPY --from=build /app/public ./public

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=5610

# Exponer puerto del backend
EXPOSE 5610

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5610/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Comando de inicio
CMD ["node", "dist/server.js"]
