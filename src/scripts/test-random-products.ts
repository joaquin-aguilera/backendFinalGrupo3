import axios from 'axios';

const BASE_URL = 'http://localhost:5610';

interface Product {
    _id: string;
    nombre: string;
    categoria: string;
    precio: number;
    condicion: string;
}

interface RandomProductsResponse {
    productos: Product[];
    metadata: {
        total: number;
        totalDisponible: number;
        hasMore: boolean;
    };
}

async function testRandomProducts() {
    console.log('🎲 Probando endpoint de productos aleatorios...\n');

    try {
        // Test 1: Sin parámetros (por defecto 20 productos)
        console.log('Test 1: Sin parámetros (límite por defecto)');
        const response1 = await axios.get<RandomProductsResponse>(
            `${BASE_URL}/api/search/products/random`
        );
        
        console.log(`✓ Total de productos disponibles: ${response1.data.metadata.total}`);
        console.log(`✓ Productos retornados: ${response1.data.metadata.totalDisponible}`);
        console.log(`✓ ¿Hay más productos?: ${response1.data.metadata.hasMore ? 'Sí' : 'No'}`);
        
        // Verificar que no haya productos TODO
        const productosTodo = response1.data.productos.filter(p => p.categoria === 'TODO');
        console.log(`✓ Productos con categoría TODO: ${productosTodo.length} (debe ser 0)`);
        
        if (response1.data.productos.length > 0) {
            console.log(`✓ Primer producto: ${response1.data.productos[0].nombre} - ${response1.data.productos[0].categoria}`);
        }
        console.log('');

        // Test 2: Con límite específico (5 productos)
        console.log('Test 2: Con límite de 5 productos');
        const response2 = await axios.get<RandomProductsResponse>(
            `${BASE_URL}/api/search/products/random`,
            { params: { limite: 5 } }
        );
        
        console.log(`✓ Productos retornados: ${response2.data.productos.length}`);
        console.log('✓ Productos:');
        response2.data.productos.forEach((p, i) => {
            console.log(`   ${i + 1}. ${p.nombre} (${p.categoria}) - $${p.precio}`);
        });
        console.log('');

        // Test 3: Verificar que los productos son diferentes en cada llamada
        console.log('Test 3: Verificar aleatoriedad');
        const response3 = await axios.get<RandomProductsResponse>(
            `${BASE_URL}/api/search/products/random`,
            { params: { limite: 3 } }
        );
        
        const productos1 = response2.data.productos.slice(0, 3).map(p => p._id);
        const productos2 = response3.data.productos.map(p => p._id);
        
        const sonIguales = JSON.stringify(productos1) === JSON.stringify(productos2);
        console.log(`✓ Productos diferentes en llamadas sucesivas: ${!sonIguales ? 'Sí ✓' : 'No (puede ser coincidencia)'}`);
        console.log('');

        // Test 4: Límite máximo
        console.log('Test 4: Límite máximo (50 productos)');
        const response4 = await axios.get<RandomProductsResponse>(
            `${BASE_URL}/api/search/products/random`,
            { params: { limite: 50 } }
        );
        
        console.log(`✓ Productos retornados: ${response4.data.productos.length}`);
        
        // Contar categorías
        const categorias = new Map<string, number>();
        response4.data.productos.forEach(p => {
            categorias.set(p.categoria, (categorias.get(p.categoria) || 0) + 1);
        });
        
        console.log('✓ Distribución por categorías:');
        Array.from(categorias.entries())
            .sort((a, b) => b[1] - a[1])
            .forEach(([cat, count]) => {
                console.log(`   - ${cat}: ${count} productos`);
            });

        console.log('\n✅ Todos los tests completados exitosamente');

    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error('❌ Error en la petición:', error.response?.data || error.message);
        } else {
            console.error('❌ Error:', error);
        }
    }
}

// Ejecutar tests
testRandomProducts().catch(console.error);
