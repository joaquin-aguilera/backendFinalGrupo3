import { Router } from 'express';
import {
  getTopProducts,
  getSearchStats,
  getTopSearchTerms,
  getSearchTrends,
  getAllSearches,
  getAllClicks
} from '../controllers/analyticsController';
import { rateLimit } from '../middleware/rateLimit';
import { validateNumericParams } from '../middleware/sanitize';

const router = Router();

// GET /api/analytics/top-products - Obtiene los productos más clickeados (populares)
router.get('/top-products', rateLimit, validateNumericParams, getTopProducts);

// GET /api/analytics/stats - Obtiene estadísticas generales de búsquedas
router.get('/stats', rateLimit, getSearchStats);

// GET /api/analytics/top-terms - Obtiene los términos de búsqueda más populares
router.get('/top-terms', rateLimit, validateNumericParams, getTopSearchTerms);

// GET /api/analytics/trends - Obtiene tendencias de búsqueda por período
router.get('/trends', rateLimit, validateNumericParams, getSearchTrends);

// GET /api/analytics/searches - Obtiene TODAS las búsquedas (para analítica externa)
router.get('/searches', rateLimit, getAllSearches);

// GET /api/analytics/clicks - Obtiene TODOS los clicks (para analítica externa)
router.get('/clicks', rateLimit, getAllClicks);

export default router;
