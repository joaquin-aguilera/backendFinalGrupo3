import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

export interface ImageOptions {
  width?: number;
  height?: number;
  quality?: number;
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export class ImageService {
  private static cacheDir = path.join(__dirname, '../../public/images/cache');
  private static categoriesDir = path.join(__dirname, '../../public/images/categories');

  /**
   * Inicializar directorio de caché
   */
  static initialize(): void {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      console.log('✓ Directorio de caché de imágenes creado');
    }
  }

  /**
   * Obtener imagen optimizada (con caché)
   */
  static async getOptimizedImage(
    imageName: string,
    options: ImageOptions = {}
  ): Promise<Buffer | null> {
    try {
      // Opciones por defecto para imágenes de categorías
      const defaultOptions: ImageOptions = {
        width: 800,
        height: 600,
        quality: 85,
        fit: 'cover'
      };

      const finalOptions = { ...defaultOptions, ...options };

      // Construir nombre de archivo en caché
      const cacheFileName = this.getCacheFileName(imageName, finalOptions);
      const cachePath = path.join(this.cacheDir, cacheFileName);

      // Verificar si existe en caché
      if (fs.existsSync(cachePath)) {
        return fs.readFileSync(cachePath);
      }

      // Buscar imagen original
      const originalPath = this.findOriginalImage(imageName);
      if (!originalPath) {
        console.error(`Imagen no encontrada: ${imageName}`);
        return null;
      }

      // Procesar imagen
      const buffer = await sharp(originalPath)
        .resize(finalOptions.width, finalOptions.height, {
          fit: finalOptions.fit,
          withoutEnlargement: true // No agrandar imágenes pequeñas
        })
        .jpeg({ quality: finalOptions.quality })
        .toBuffer();

      // Guardar en caché
      fs.writeFileSync(cachePath, buffer);
      console.log(`✓ Imagen optimizada y cacheada: ${cacheFileName}`);

      return buffer;
    } catch (error) {
      console.error(`Error al optimizar imagen ${imageName}:`, error);
      return null;
    }
  }

  /**
   * Buscar imagen original con múltiples extensiones
   */
  private static findOriginalImage(imageName: string): string | null {
    const extensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const baseNameWithoutExt = path.parse(imageName).name;

    for (const ext of extensions) {
      const fullPath = path.join(this.categoriesDir, `${baseNameWithoutExt}${ext}`);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    return null;
  }

  /**
   * Generar nombre de archivo para caché
   */
  private static getCacheFileName(imageName: string, options: ImageOptions): string {
    const baseName = path.parse(imageName).name;
    const { width, height, quality, fit } = options;
    return `${baseName}_${width}x${height}_q${quality}_${fit}.jpg`;
  }

  /**
   * Limpiar caché de imágenes
   */
  static clearCache(): void {
    if (fs.existsSync(this.cacheDir)) {
      const files = fs.readdirSync(this.cacheDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(this.cacheDir, file));
      });
      console.log(`✓ Caché limpiado: ${files.length} archivos eliminados`);
    }
  }

  /**
   * Pre-generar miniaturas de todas las categorías
   */
  static async pregenerateCategories(): Promise<void> {
    console.log('Pregenerando imágenes optimizadas de categorías...');
    
    const categoryImages = [
      'Alimentos.jpg',
      'Automotriz.jpg',
      'Belleza.jpg',
      'Calzado.jpg',
      'Deportes.jpg',
      'Electrónica.jpg',
      'General.jpg',
      'Hogar.jpg',
      'Juguetes.jpg',
      'Libros.jpg',
      'Mascotas.jpg',
      'Oficina.jpg',
      'Ropa.jpg',
      'Todo.jpg'
    ];

    let success = 0;
    let failed = 0;

    for (const imageName of categoryImages) {
      try {
        await this.getOptimizedImage(imageName, {
          width: 800,
          height: 600,
          quality: 85,
          fit: 'cover'
        });
        success++;
      } catch (error) {
        console.error(`Error al pregenerar ${imageName}:`, error);
        failed++;
      }
    }

    console.log(`✓ Pregeneración completa: ${success} éxitos, ${failed} fallos`);
  }
}
