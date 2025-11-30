const db = db.getSiblingDB('searchdb');

db.search_history.insertMany([
  {
    userId: 'user_001',
    queryText: 'laptop hp',
    filters: { categoria: 'Electrónica', precioMax: 600000 },
    sortBy: 'precio',
    sortDir: 'asc',
    page: 1,
    pageSize: 20,
    requestedAt: new Date('2025-11-01T10:00:00Z'),
    results: ['prod_456def', 'prod_789ghi']
  },
  {
    userId: 'user_001',
    queryText: 'teclado gaming',
    filters: { categoria: 'Accesorios' },
    sortBy: null,
    sortDir: null,
    page: 1,
    pageSize: 20,
    requestedAt: new Date('2025-11-01T11:30:00Z'),
    results: ['prod_321mno']
  },
  {
    userId: 'user_002',
    queryText: 'monitor 27 pulgadas',
    filters: { categoria: 'Electrónica' },
    sortBy: 'precio',
    sortDir: 'desc',
    page: 1,
    pageSize: 20,
    requestedAt: new Date('2025-11-02T14:20:00Z'),
    results: ['prod_111vwx']
  }
]);

db.search_queries.insertMany([
  {
    valor_busqueda: 'laptop',
    fecha: new Date('2025-11-01T10:00:00Z')
  },
  {
    valor_busqueda: 'teclado gaming',
    fecha: new Date('2025-11-01T11:30:00Z')
  },
  {
    valor_busqueda: 'monitor',
    fecha: new Date('2025-11-02T14:20:00Z')
  },
  {
    valor_busqueda: 'mouse inalambrico',
    fecha: new Date('2025-11-03T09:15:00Z')
  }
]);

db.clicks.insertMany([
  {
    id_producto: 'prod_456def',
    nombre: 'Laptop HP Pavilion 15',
    fecha: new Date('2025-11-01T10:05:30Z'),
    userId: 'user_001'
  },
  {
    id_producto: 'prod_321mno',
    nombre: 'Teclado Mecánico RGB Gaming',
    fecha: new Date('2025-11-01T11:32:45Z'),
    userId: 'user_001'
  },
  {
    id_producto: 'prod_111vwx',
    nombre: 'Monitor Gaming 27 pulgadas 144Hz',
    fecha: new Date('2025-11-02T14:25:00Z'),
    userId: 'user_002'
  },
  {
    id_producto: 'prod_456def',
    nombre: 'Laptop HP Pavilion 15',
    fecha: new Date('2025-11-03T08:10:00Z'),
    userId: null
  }
]);

print('Datos de ejemplo insertados correctamente.');

