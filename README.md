# Backend - Microservicio de Búsqueda y Descubrimiento

**Grupo 3 - Pulga Shop**  
**Encargados:** Max Latuz, Joaquin Aguilera

## Ejecución

### Desarrollo Local

```bash
# Instalar dependencias
npm install

# Iniciar servidor (puerto 5610)
npm run dev

# Build para producción
npm run build
npm start
```

### Con Docker

```bash
docker build -t busqueda-backend .
docker run -p 5610:5610 busqueda-backend
```

## Estructura del Directorio

```
backend/
├── src/
│   ├── server.ts              # Punto de entrada
│   ├── controllers/           # Controladores de rutas
│   ├── routes/                # Definición de rutas
│   ├── services/              # Lógica de negocio
│   ├── models/                # Modelos MongoDB
│   ├── middleware/            # Middleware personalizado
│   ├── swagger/               # Documentación OpenAPI
│   └── data/                  # Datos de prueba y plantillas
├── logs/                      # Archivos de log
├── public/images/             # Imágenes optimizadas
├── Dockerfile
└── package.json
```

---

## 🔗 Integraciones con Otros Grupos

### Grupos del Proyecto
| Grupo | Nombre | Puerto |
|-------|--------|--------|
| **Grupo 1** | Reportes y Analítica | - |
| **Grupo 2** | Publicaciones y Multimedia | 4040 |
| **Grupo 3** | Búsqueda y Descubrimiento (nosotros) | 5610 |
| **Grupo 4** | Autenticación y Perfiles | 3000 |

---

### 📥 Integraciones que RECIBEN datos (Consumimos APIs externas)

#### Grupo 2 - Publicaciones y Multimedia
Consumimos su API para obtener los productos/publicaciones a mostrar en búsquedas.

| Endpoint Consumido | Método | Descripción |
|-------------------|--------|-------------|
| `/api/publicaciones` | GET | Obtener todas las publicaciones |
| `/api/publicaciones/{id}` | GET | Obtener publicación específica |

**Configuración en `.env`:**
```dotenv
PUBLICATIONS_API_URL=http://localhost:4040/api
USE_DUMMY_PRODUCTS=false  # true para desarrollo sin Grupo 2
```

#### Grupo 4 - Autenticación y Perfiles
Consumimos su API para validar tokens JWT de usuarios autenticados.

| Endpoint Consumido | Método | Descripción |
|-------------------|--------|-------------|
| `/api/auth/me` | GET | Validar token y obtener datos del usuario |

**Configuración en `.env`:**
```dotenv
AUTH_SERVICE_URL=http://localhost:3000/api
USE_DUMMY_AUTH=false  # true para desarrollo sin Grupo 4
```

---

### 📤 Integraciones que ENVÍAN datos (Exponemos endpoints / Redireccionamos)

#### Grupo 1 - Reportes y Analítica
Exponemos endpoints para que consuman datos de búsquedas y clicks.

| Endpoint Expuesto | Método | Descripción |
|-------------------|--------|-------------|
| `/api/analytics/searches` | GET | **Todos los datos de búsquedas** |
| `/api/analytics/clicks` | GET | **Todos los datos de clicks** |

**Formato de respuesta `/api/analytics/searches`:**
```json
[
  {
    "valor_busqueda": "laptop gaming",
    "fecha": "2025-01-15T10:30:00.000Z"
  },
  {
    "valor_busqueda": "audifonos bluetooth",
    "fecha": "2025-01-15T09:15:00.000Z"
  }
]
```

**Formato de respuesta `/api/analytics/clicks`:**
```json
[
  {
    "id_producto": "pub_67890",
    "nombre": "Laptop HP Pavilion",
    "fecha": "2025-01-15T10:32:15.000Z"
  },
  {
    "id_producto": "pub_12345",
    "nombre": "Mouse Logitech G502",
    "fecha": "2025-01-15T10:28:00.000Z"
  }
]
```

#### Grupo 2 - Publicaciones y Multimedia
Redireccionamos al usuario cuando hace click en un producto.

| Acción | URL de Redirección |
|--------|-------------------|
| Click en producto | `http://localhost:4040/publicaciones/{idPublicacion}` |

**Configuración en frontend `.env`:**
```dotenv
VITE_PUBLICACIONES_URL=http://localhost:4040
```

---

### ⚙️ Configuración para Integración

**Modo Desarrollo (sin otros grupos):**
```dotenv
USE_DUMMY_AUTH=true
USE_DUMMY_PRODUCTS=true
USE_DUMMY_ANALYTICS=true
```

**Modo Integración (con otros grupos):**
```dotenv
USE_DUMMY_AUTH=false
USE_DUMMY_PRODUCTS=false
USE_DUMMY_ANALYTICS=false
```

---

## Configuración de Puertos

| Servicio | Puerto |
|----------|--------|
| Backend Búsqueda | 5610 |
| Frontend Búsqueda | 5620 |
| MongoDB | 5173 |
| Auth Service (Grupo 4) | 3000 |
| Publicaciones (Grupo 2) | 4040 |

## Documentación API

Ver archivo: `src/swagger/documentacion_endpoints_busquedas.yaml`

