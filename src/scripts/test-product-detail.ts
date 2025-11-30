import axios from 'axios';

const BASE_URL = 'http://localhost:5610';

async function testProductDetail() {
    console.log('🧪 Probando endpoint de detalle de producto...\n');

    // Probar los primeros 5 productos (tienen datos completos)
    for (let i = 1; i <= 5; i++) {
        try {
            console.log(`\n━━━ Producto ${i} ━━━`);
            const response = await axios.get(`${BASE_URL}/api/search/products/${i}/detail`);
            
            const { producto, vendedor, publicacion } = response.data;
            
            console.log(`✓ Nombre: ${producto.nombre}`);
            console.log(`✓ Precio: $${producto.precio}`);
            console.log(`✓ Vendedor: ${vendedor.nombre} (${vendedor.tipo})`);
            
            if (vendedor.email) {
                console.log(`✓ Email: ${vendedor.email}`);
            }
            
            if (publicacion) {
                console.log(`✓ Imágenes: ${publicacion.multimedia.length}`);
                console.log(`✓ Despacho: ${publicacion.despacho}`);
                console.log(`✓ Precio envío: $${publicacion.precio_envio}`);
            }
            
        } catch (error) {
            if (axios.isAxiosError(error)) {
                console.error(`❌ Error: ${error.response?.data?.error || error.message}`);
            } else {
                console.error(`❌ Error: ${error}`);
            }
        }
    }
    
    console.log('\n✅ Pruebas completadas');
}

testProductDetail().catch(console.error);
