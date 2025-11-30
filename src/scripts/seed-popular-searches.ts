/**
 * Script para generar búsquedas de ejemplo y simular popularidad de productos
 * Ejecutar con: ts-node src/scripts/seed-popular-searches.ts
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import Search from '../models/Search';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://search_user:search_pass@localhost:5173/searchdb?authSource=searchdb';

// Productos con sus frecuencias de búsqueda simuladas
const searchData = [
  // Productos más populares (más búsquedas)
  { productId: '1', productName: 'Laptop HP Pavilion 15', searches: 45, categoria: 'Electrónica' },
  { productId: '2', productName: 'Monitor LG 24 pulgadas', searches: 38, categoria: 'Electrónica' },
  { productId: '13', productName: 'Monitor 27 pulgadas 144Hz', searches: 35, categoria: 'Electrónica' },
  
  // Productos moderadamente populares
  { productId: '5', productName: 'Silla Gamer Premium', searches: 28, categoria: 'Muebles' },
  { productId: '8', productName: 'Headset Gamer Pro', searches: 25, categoria: 'Accesorios' },
  { productId: '3', productName: 'Teclado Mecánico RGB', searches: 22, categoria: 'Accesorios' },
  
  // Productos con búsquedas regulares
  { productId: '4', productName: 'Mouse Inalámbrico Logitech', searches: 18, categoria: 'Accesorios' },
  { productId: '6', productName: 'Escritorio Ajustable', searches: 15, categoria: 'Muebles' },
  { productId: '10', productName: 'Micrófono Condenser USB', searches: 14, categoria: 'Accesorios' },
  { productId: '11', productName: 'Laptop Dell XPS 13', searches: 12, categoria: 'Electrónica' },
  
  // Productos con pocas búsquedas
  { productId: '7', productName: 'Webcam 1080p HD', searches: 10, categoria: 'Accesorios' },
  { productId: '14', productName: 'Dock para Laptop', searches: 8, categoria: 'Accesorios' },
  { productId: '9', productName: 'Hub USB 3.0 (7 puertos)', searches: 7, categoria: 'Accesorios' },
  { productId: '12', productName: 'Teclado Inalámbrico', searches: 5, categoria: 'Accesorios' },
  { productId: '15', productName: 'Mousepad Grande', searches: 4, categoria: 'Accesorios' }
];

// Términos de búsqueda variados para simular
const searchTerms = [
  'laptop', 'monitor', 'teclado', 'mouse', 'silla gamer',
  'escritorio', 'webcam', 'headset', 'micrófono', 'usb'
];

// Usuarios de ejemplo
const sampleUsers = [
  'user_001', 'user_002', 'user_003', 'user_004', 'user_005',
  'user_006', 'user_007', 'user_008', undefined, undefined // Algunos anónimos
];

/**
 * Genera búsquedas aleatorias para un producto
 */
function generateSearchesForProduct(
  productId: string,
  productName: string,
  categoria: string,
  count: number
): any[] {
  const searches: any[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    // Fecha aleatoria en los últimos 30 días
    const daysAgo = Math.floor(Math.random() * 30);
    const hoursAgo = Math.floor(Math.random() * 24);
    const requestedAt = new Date(now);
    requestedAt.setDate(requestedAt.getDate() - daysAgo);
    requestedAt.setHours(requestedAt.getHours() - hoursAgo);

    // Usuario aleatorio (puede ser anónimo)
    const userId = sampleUsers[Math.floor(Math.random() * sampleUsers.length)];

    // Término de búsqueda aleatorio relacionado
    const isDirectSearch = Math.random() > 0.3; // 70% búsquedas directas del producto
    const queryText = isDirectSearch 
      ? productName
      : searchTerms[Math.floor(Math.random() * searchTerms.length)];

    // Filtros aleatorios (30% de las veces)
    const hasFilters = Math.random() > 0.7;
    const filters: any = {};
    if (hasFilters) {
      filters.categoria = categoria;
      if (Math.random() > 0.5) {
        filters.condicion = Math.random() > 0.5 ? 'nuevo' : 'usado';
      }
    }

    searches.push({
      userId,
      queryText,
      filters: Object.keys(filters).length > 0 ? filters : undefined,
      results: [
        {
          productId,
          position: Math.floor(Math.random() * 3) + 1 // Posición 1-3
        }
      ],
      requestedAt,
      page: 1,
      pageSize: 20
    });
  }

  return searches;
}

/**
 * Poblar la base de datos con búsquedas de ejemplo
 */
async function seedSearches() {
  try {
    console.log('🔌 Conectando a MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');

    // Limpiar búsquedas existentes (opcional - comentar si quieres mantener datos)
    console.log('🧹 Limpiando búsquedas antiguas...');
    await Search.deleteMany({});
    console.log('✅ Búsquedas antiguas eliminadas');

    console.log('📝 Generando búsquedas de ejemplo...');
    
    let totalSearches = 0;
    const allSearches: any[] = [];

    for (const product of searchData) {
      const searches = generateSearchesForProduct(
        product.productId,
        product.productName,
        product.categoria,
        product.searches
      );
      
      allSearches.push(...searches);
      totalSearches += searches.length;
      
      console.log(`   ✓ ${product.productName}: ${searches.length} búsquedas`);
    }

    console.log('\n💾 Insertando búsquedas en la base de datos...');
    await Search.insertMany(allSearches);

    console.log('\n✅ ¡Proceso completado!');
    console.log(`📊 Total de búsquedas insertadas: ${totalSearches}`);
    console.log(`📦 Productos con datos: ${searchData.length}`);
    console.log('\n🎯 Top 6 productos más buscados:');
    
    searchData
      .sort((a, b) => b.searches - a.searches)
      .slice(0, 6)
      .forEach((p, idx) => {
        console.log(`   ${idx + 1}. ${p.productName} - ${p.searches} búsquedas`);
      });

    console.log('\n🚀 Ahora puedes:');
    console.log('   1. Iniciar el backend: npm run dev');
    console.log('   2. Verificar el endpoint: http://localhost:5610/api/analytics/top-products');
    console.log('   3. Ver la página principal del frontend con productos populares');

  } catch (error) {
    console.error('❌ Error al poblar búsquedas:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Conexión cerrada');
  }
}

// Ejecutar
seedSearches().catch(console.error);
