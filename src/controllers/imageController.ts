import { Request, Response } from 'express';
import { ImageService } from '../services/imageService';

/**
 * Servir imagen de categoría optimizada
 */
export const getCategoryImage = async (req: Request, res: Response) => {
  try {
    const { imageName } = req.params;

    if (!imageName) {
      return res.status(400).json({ error: 'Nombre de imagen requerido' });
    }

    // Validar nombre de archivo (seguridad)
    if (imageName.includes('..') || imageName.includes('/') || imageName.includes('\\')) {
      return res.status(400).json({ error: 'Nombre de archivo inválido' });
    }

    // Obtener dimensiones de query params (opcional)
    const width = req.query.width ? parseInt(req.query.width as string) : undefined;
    const height = req.query.height ? parseInt(req.query.height as string) : undefined;
    const quality = req.query.quality ? parseInt(req.query.quality as string) : undefined;

    // Obtener imagen optimizada
    const imageBuffer = await ImageService.getOptimizedImage(imageName, {
      width,
      height,
      quality
    });

    if (!imageBuffer) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    // Configurar headers de caché (1 día)
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('ETag', `"${imageName}-${width}-${height}"`);

    res.send(imageBuffer);
  } catch (error) {
    console.error('Error al servir imagen:', error);
    res.status(500).json({ error: 'Error al procesar la imagen' });
  }
};

/**
 * Limpiar caché de imágenes (endpoint administrativo)
 */
export const clearImageCache = async (req: Request, res: Response) => {
  try {
    ImageService.clearCache();
    res.json({ success: true, message: 'Caché de imágenes limpiado' });
  } catch (error) {
    console.error('Error al limpiar caché:', error);
    res.status(500).json({ error: 'Error al limpiar caché' });
  }
};
