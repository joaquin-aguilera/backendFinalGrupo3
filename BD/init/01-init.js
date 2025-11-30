
// init/01-init.js
const dbName = 'searchdb';
const appUser = 'search_user';
const appPass = 'search_pass';
const db = db.getSiblingDB(dbName);
try {
  db.createUser({ user: appUser, pwd: appPass, roles: [{ role: 'readWrite', db: dbName }] });
  print(`Usuario '${appUser}' creado en DB '${dbName}'.`);
} catch (e) { print(`Usuario '${appUser}' puede existir: ${e}`); }

db.createCollection('search_history', {
  validator: { $jsonSchema: { bsonType: 'object', required: ['userId','queryText','requestedAt','results'], properties: {
    userId: { bsonType: 'string' },
    queryText: { bsonType: 'string' },
    filters: { bsonType: ['object','null'] },
    sortBy: { bsonType: ['string','null'] },
    sortDir: { enum: ['asc','desc',null] },
    page: { bsonType: ['int','null'] },
    pageSize: { bsonType: ['int','null'] },
    requestedAt: { bsonType: 'date' },
    results: { bsonType: 'array' }
  } } }
});
try { db.search_history.createIndex({ userId: 1, requestedAt: -1 }, { name: 'user_date' }); } catch(e){}
try { db.search_history.createIndex({ requestedAt: -1 }, { name: 'date_desc' }); } catch(e){}
try { db.search_history.createIndex({ queryText: 'text' }, { name: 'query_text' }); } catch(e){}

db.createCollection('search_queries', {
  validator: { $jsonSchema: { bsonType: 'object', required: ['valor_busqueda','fecha'], properties: {
    valor_busqueda: { bsonType: 'string' },
    fecha: { bsonType: 'date' }
  } } }
});
try { db.search_queries.createIndex({ fecha: -1 }, { name: 'fecha_desc' }); } catch(e){}
try { db.search_queries.createIndex({ valor_busqueda: 'text' }, { name: 'valor_text' }); } catch(e){}

db.createCollection('clicks', {
  validator: { $jsonSchema: { bsonType: 'object', required: ['id_producto','nombre','fecha'], properties: {
    id_producto: { bsonType: 'string' },
    nombre: { bsonType: 'string' },
    fecha: { bsonType: 'date' },
    userId: { bsonType: ['string','null'] }
  } } }
});
try { db.clicks.createIndex({ id_producto: 1, fecha: -1 }, { name: 'producto_fecha' }); } catch(e){}
try { db.clicks.createIndex({ fecha: -1 }, { name: 'fecha_desc' }); } catch(e){}
try { db.clicks.createIndex({ userId: 1, fecha: -1 }, { name: 'user_fecha' }); } catch(e){}

print('BD inicializada.');

