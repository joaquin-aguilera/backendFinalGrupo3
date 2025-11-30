import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analyticsService';

/**
 * Obtiene los productos más buscados
 * @route GET /api/analytics/top-products
 */
export const getTopProducts = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 6;
    const limitSafe = Math.min(Math.max(limit, 1), 20); // Entre 1 y 20

    const topProducts = await AnalyticsService.getPopularProducts(limitSafe);

    const endTime = Date.now();
    console.log(`Top productos obtenidos en ${endTime - startTime}ms`);

    res.json({
      success: true,
      total: topProducts.length,
      productos: topProducts
    });

  } catch (error) {
    console.error('Error al obtener top productos:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener productos más buscados' 
    });
  }
};

/**
 * Obtiene estadísticas generales de búsquedas
 * @route GET /api/analytics/stats
 */
export const getSearchStats = async (req: Request, res: Response) => {
  try {
    const stats = await AnalyticsService.getSearchStats();

    res.json({
      success: true,
      stats
    });

  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener estadísticas de búsquedas' 
    });
  }
};

/**
 * Obtiene los términos de búsqueda más populares
 * @route GET /api/analytics/top-terms
 */
export const getTopSearchTerms = async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
    const limitSafe = Math.min(Math.max(limit, 1), 50);

    const topTerms = await AnalyticsService.getTopSearchTerms(limitSafe);

    res.json({
      success: true,
      total: topTerms.length,
      terms: topTerms
    });

  } catch (error) {
    console.error('Error al obtener términos populares:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener términos de búsqueda populares' 
    });
  }
};

/**
 * Obtiene tendencias de búsqueda por período
 * @route GET /api/analytics/trends
 */
export const getSearchTrends = async (req: Request, res: Response) => {
  try {
    const days = req.query.days ? parseInt(req.query.days as string, 10) : 7;
    const daysSafe = Math.min(Math.max(days, 1), 90); // Entre 1 y 90 días

    const trends = await AnalyticsService.getSearchTrends(daysSafe);

    res.json({
      success: true,
      period: `${daysSafe} días`,
      total: trends.length,
      trends
    });

  } catch (error) {
    console.error('Error al obtener tendencias:', error);
    res.status(500).json({ 
      success: false,
      error: 'Error al obtener tendencias de búsqueda' 
    });
  }
};

/**
 * Obtiene todas las búsquedas para analítica externa (Grupo 1)
 * @route GET /api/analytics/searches
 * @returns Array plano de búsquedas [{valor_busqueda, fecha}, ...]
 */
export const getAllSearches = async (req: Request, res: Response) => {
  try {
    const searches = await AnalyticsService.getAllSearches();
    // Enviar array plano - Grupo 1 procesa los datos
    res.json(searches);

  } catch (error) {
    console.error('Error al obtener búsquedas:', error);
    res.status(500).json({ error: 'Error al obtener datos de búsquedas' });
  }
};

/**
 * Obtiene todos los clicks para analítica externa (Grupo 1)
 * @route GET /api/analytics/clicks
 * @returns Array plano de clicks [{id_producto, nombre, fecha}, ...]
 */
export const getAllClicks = async (req: Request, res: Response) => {
  try {
    const clicks = await AnalyticsService.getAllClicks();
    // Enviar array plano - Grupo 1 procesa los datos
    res.json(clicks);

  } catch (error) {
    console.error('Error al obtener clicks:', error);
    res.status(500).json({ error: 'Error al obtener datos de clicks' });
  }
};

export default {
  getTopProducts,
  getSearchStats,
  getTopSearchTerms,
  getSearchTrends,
  getAllSearches,
  getAllClicks
};
