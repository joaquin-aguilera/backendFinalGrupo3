import { Router } from 'express';
import {
    search,
    getSearchHistory,
    deleteSearchHistory,
    clearSearchHistory,
    closeAnonymousSession,
    getSuggestions,
    getAllProducts,
    getRandomProducts,
    getProductDetail,
    saveSearchHistory,
    registerProductClick,
    getProductClicks,
    getProductSearches
} from '../controllers/searchController';
import { validateSearchParams } from '../middleware/validateSearchParams';
import { rateLimit } from '../middleware/rateLimit';
import { validateSearchText, validateNumericParams } from '../middleware/sanitize';
import { searchLimiter, writeLimiter } from '../middleware/rateLimit';
import { optionalAuthenticate } from '../middleware/auth';

const router = Router();

// Aplicar autenticación opcional a todas las rutas
// Maneja tanto usuarios autenticados como anónimos (con sesión temporal)
router.use(optionalAuthenticate);

// GET /api/search/products - Buscar productos con filtros avanzados
router.get('/products',
    searchLimiter,          // Rate limit específico para búsquedas (30/min)
    validateSearchText,     // Validar texto de búsqueda
    validateNumericParams,  // Validar parámetros numéricos
    validateSearchParams,   // Tu validación original
    search
);

// GET /api/search/products/all - Obtener todos los productos disponibles
router.get('/products/all',
    rateLimit,  // Rate limit básico
    getAllProducts
);

// GET /api/search/products/random - Obtener productos aleatorios
router.get('/products/random',
    rateLimit,
    validateNumericParams,
    getRandomProducts
);

// GET /api/search/products/:id/detail - Obtener detalle completo del producto
router.get('/products/:id/detail',
    rateLimit,
    getProductDetail
);

// GET /api/search/suggestions - Obtener sugerencias de búsqueda
router.get('/suggestions',
    searchLimiter,       // Rate limit para sugerencias
    validateSearchText,  // Validar texto de búsqueda
    getSuggestions
);

// GET /api/search/history - Obtener historial de búsquedas
router.get('/history',
    rateLimit,  // Rate limit básico
    getSearchHistory
);

// DELETE /api/search/history/:id - Eliminar una búsqueda del historial
router.delete('/history/:id',
    writeLimiter,  // Rate limit para escritura
    deleteSearchHistory
);

// DELETE /api/search/history - Limpiar todo el historial del usuario
router.delete('/history',
    writeLimiter,  // Rate limit para escritura
    clearSearchHistory
);

// POST /api/search/session/close - Cerrar sesión anónima
router.post('/session/close',
    writeLimiter,  // Rate limit para escritura
    closeAnonymousSession
);

// POST /api/search/history - Guardar una búsqueda en el historial
router.post('/history',
    writeLimiter,  // Rate limit para escritura (20/5min)
    saveSearchHistory
);

// POST /api/search/clicks - Registrar un click en un producto
router.post('/clicks',
    writeLimiter,  // Rate limit para escritura
    registerProductClick
);

// GET /api/search/clicks/:productId - Obtener clicks de un producto específico
router.get('/clicks/:productId',
    rateLimit,  // Rate limit básico
    getProductClicks
);

// GET /api/search/product-searches - Obtener búsquedas de productos para integración externa
router.get('/product-searches',
    rateLimit,              // Rate limit básico
    validateNumericParams,  // Validar parámetro 'limite'
    getProductSearches
);

export default router;