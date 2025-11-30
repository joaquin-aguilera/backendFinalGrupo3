// Script para pregenerar/regenerar caché de imágenes optimizadas
import { ImageService } from '../services/imageService';

async function main() {
  console.log('🖼️  Iniciando pregeneración de imágenes...\n');
  
  ImageService.initialize();
  
  await ImageService.pregenerateCategories();
  
  console.log('\n✅ Proceso completado exitosamente');
  process.exit(0);
}

main().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});
