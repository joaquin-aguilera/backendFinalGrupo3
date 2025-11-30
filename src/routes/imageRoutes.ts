import { Router } from 'express';
import { getCategoryImage, clearImageCache } from '../controllers/imageController';

const router = Router();

// GET /api/images/categories/:imageName - Obtener imagen de categoría optimizada
router.get('/categories/:imageName', getCategoryImage);

// POST /api/images/cache/clear - Limpiar caché de imágenes optimizadas
router.post('/cache/clear', clearImageCache);

export default router;
