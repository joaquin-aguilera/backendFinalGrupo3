# Base de Datos - Microservicio Búsqueda y Descubrimiento

**Grupo 3 - Pulga Shop**  
**Motor:** MongoDB 7.0  
**Puerto:** 5173 (externo) → 27017 (interno)

---

## 📋 Información General

| Atributo | Valor |
|----------|-------|
| Base de datos | `searchdb` |
| Usuario aplicación | `search_user` |
| Contraseña aplicación | `search_pass` |
| Usuario root | `root` |
| Contraseña root | `rootpass` |

---

## 🗃️ Esquema de Base de Datos

### Colecciones

#### 1. `search_history` - Historial de búsquedas de usuarios
```javascript
{
  userId: String,        // ID del usuario (requerido)
  queryText: String,     // Texto de búsqueda (requerido)
  filters: Object,       // Filtros aplicados {precio, categoria, condicion, ordenar}
  sortBy: String,        // Campo de ordenamiento
  sortDir: String,       // 'asc' | 'desc'
  page: Number,          // Página solicitada
  pageSize: Number,      // Tamaño de página
  requestedAt: Date,     // Fecha de búsqueda (requerido)
  results: [String]      // IDs de productos encontrados (requerido)
}
```

#### 2. `search_queries` - Búsquedas anónimas para analítica (Grupo 1)
```javascript
{
  valor_busqueda: String,  // Texto buscado (requerido)
  fecha: Date              // Fecha de búsqueda (requerido)
}
```

#### 3. `clicks` - Registro de clicks en productos (Grupo 1)
```javascript
{
  id_producto: String,  // ID del producto clickeado (requerido)
  nombre: String,       // Nombre del producto (requerido)
  fecha: Date,          // Fecha del click (requerido)
  userId: String        // ID del usuario (opcional, solo uso interno)
}
```

---

## 🚀 Creación del Esquema

### Opción A: Automática con Docker (Recomendado)

Los scripts se ejecutan automáticamente al iniciar el contenedor MongoDB:

```bash
# Desde la raíz del proyecto
docker-compose up -d db_mongodb_busqueda
```

Los scripts en `BD/init/` se ejecutan en orden alfabético:
1. `01-init.js` - Crea usuario, colecciones e índices
2. `02-seed.js` - Inserta datos de ejemplo

### Opción B: Manual con mongosh

```bash
# Conectar a MongoDB
mongosh "mongodb://root:rootpass@localhost:5173/admin"

# Ejecutar scripts
load('/ruta/a/BD/init/01-init.js')
load('/ruta/a/BD/init/02-seed.js')
```

### Opción C: Crear manualmente

```javascript
// Conectar como root
use admin
db.auth('root', 'rootpass')

// Cambiar a searchdb
use searchdb

// Crear usuario de aplicación
db.createUser({
  user: 'search_user',
  pwd: 'search_pass',
  roles: [{ role: 'readWrite', db: 'searchdb' }]
})

// Crear colecciones (ver 01-init.js para esquema completo)
db.createCollection('search_history')
db.createCollection('search_queries')
db.createCollection('clicks')

// Crear índices
db.search_history.createIndex({ userId: 1, requestedAt: -1 })
db.search_queries.createIndex({ fecha: -1 })
db.clicks.createIndex({ id_producto: 1, fecha: -1 })
```

---

## 📥 Carga Inicial de Datos

### Automática (con Docker)
El script `02-seed.js` inserta datos de ejemplo automáticamente.

### Manual
```bash
# Conectar y ejecutar
mongosh "mongodb://search_user:search_pass@localhost:5173/searchdb" --file BD/init/02-seed.js
```

---

## 🔗 Conexión desde Aplicación

### String de conexión (desarrollo local)
```
mongodb://search_user:search_pass@localhost:5173/searchdb?authSource=searchdb
```

### String de conexión (Docker)
```
mongodb://search_user:search_pass@db_mongodb_busqueda:27017/searchdb?authSource=searchdb
```

---

## 📊 Datos Expuestos a Otros Grupos

### Para Grupo 1 (Reportes y Analítica)

**Endpoint:** `GET /api/analytics/searches`
```json
[
  {"valor_busqueda": "laptop gaming", "fecha": "2025-01-15T10:30:00.000Z"},
  {"valor_busqueda": "mouse inalambrico", "fecha": "2025-01-15T09:15:00.000Z"}
]
```

**Endpoint:** `GET /api/analytics/clicks`
```json
[
  {"id_producto": "pub_123", "nombre": "Laptop HP", "fecha": "2025-01-15T10:32:00.000Z"},
  {"id_producto": "pub_456", "nombre": "Mouse Logitech", "fecha": "2025-01-15T09:20:00.000Z"}
]
```

> **Nota:** El campo `userId` NO se expone al Grupo 1 por privacidad.

---

## 🛠️ Comandos Útiles

```bash
# Ver estado de la BD
docker exec -it db_mongodb_busqueda mongosh -u root -p rootpass --eval "db.adminCommand('listDatabases')"

# Conectar a la BD
docker exec -it db_mongodb_busqueda mongosh -u search_user -p search_pass searchdb

# Ver colecciones
docker exec -it db_mongodb_busqueda mongosh -u search_user -p search_pass searchdb --eval "db.getCollectionNames()"

# Contar documentos
docker exec -it db_mongodb_busqueda mongosh -u search_user -p search_pass searchdb --eval "db.clicks.countDocuments()"

# Backup
docker exec db_mongodb_busqueda mongodump -u root -p rootpass --out /backup

# Restore
docker exec db_mongodb_busqueda mongorestore -u root -p rootpass /backup
```

---

## 📁 Estructura del Directorio

```
BD/
├── init/                      # Scripts de inicialización automática
│   ├── 01-init.js            # Crear usuario, colecciones e índices
│   └── 02-seed.js            # Datos de ejemplo
├── scripts/                   # Scripts de consulta
│   └── query-clicks-example.mjs
├── test/                      # Consultas de prueba
│   └── queries.md
├── docker-compose.yml         # Compose solo para BD (desarrollo)
└── README.md                  # Este archivo
```

---

## ⚠️ Notas Importantes

1. **Primera ejecución:** Los scripts de init solo se ejecutan si la BD está vacía
2. **Persistencia:** Los datos se guardan en el volumen `mongodb_data_busqueda`
3. **Reset completo:** Para reiniciar desde cero:
   ```bash
   docker-compose down -v
   docker-compose up -d
   ```
4. **Limpieza de sesiones:** El backend ejecuta un job cada 5 minutos que elimina historial de sesiones anónimas con más de 12 horas de inactividad
