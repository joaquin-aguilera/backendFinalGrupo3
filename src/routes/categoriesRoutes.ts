import { Router } from 'express';
import { getAllCategories, getTopClickedProducts, getProductsByCategory } from '../controllers/categoriesController';
import { rateLimit } from '../middleware/rateLimit';
import { validateNumericParams, validateCategoryName } from '../middleware/sanitize';

const router = Router();

// GET /api/categories - Obtener todas las categorías con imágenes
router.get('/',
    rateLimit,
    getAllCategories
);

// GET /api/categories/top-clicked - Obtener productos más buscados
router.get('/top-clicked',
    rateLimit,
    validateNumericParams,
    getTopClickedProducts
);

// GET /api/categories/:category/products - Obtener productos de una categoría específica
router.get('/:category/products',
    rateLimit,
    validateCategoryName,
    getProductsByCategory
);

export default router;