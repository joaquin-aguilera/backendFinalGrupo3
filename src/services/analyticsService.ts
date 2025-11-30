import { SearchHistory, SearchQuery } from '../models/Search';
import Click from '../models/Click';
import { productsService } from './productsService';
import clicksDummy from '../data/clicks_dummy.json';
import searchesDummy from '../data/searches_dummy.json';

// Control de modo dummy para analytics
const USE_DUMMY_ANALYTICS = process.env.USE_DUMMY_ANALYTICS === 'true';

/**
 * Servicio para generar analíticas de búsquedas y productos
 */
export class AnalyticsService {
  /**
   * Obtiene los 6 productos más populares basados en CLICKS (no búsquedas)
   * Si USE_DUMMY_ANALYTICS=true y no hay datos en BD, usa datos dummy
   * Si USE_DUMMY_ANALYTICS=false, solo usa datos reales de BD
   * @param limit Número de productos a retornar (default: 6)
   * @returns Array de productos más clickeados con información completa
   */
  static async getPopularProducts(limit: number = 6) {
    try {
      // MODO DUMMY: Siempre usar datos dummy
      if (USE_DUMMY_ANALYTICS) {
        const validClickCount = await Click.countDocuments({ 
          id_producto: { $exists: true, $nin: [null, ''] }
        });
        
        if (validClickCount === 0) {
          console.log('🔧 MODO DUMMY ANALYTICS: Usando clicks_dummy.json');
          return await this.getPopularProductsFromDummy(limit);
        }
      }

      // 2. Obtener productos más clickeados desde BD real (solo con id_producto válido)
      const topClicks = await Click.aggregate([
        // Filtrar solo clicks con id_producto válido
        {
          $match: {
            id_producto: { $exists: true, $nin: [null, ''] }
          }
        },
        // Agrupar por id_producto y contar clicks
        {
          $group: {
            _id: '$id_producto',
            clickCount: { $sum: 1 },
            lastClick: { $max: '$fecha' },
            nombre: { $first: '$nombre' }
          }
        },
        
        // Ordenar por cantidad de clicks (descendente)
        { $sort: { clickCount: -1 } },
        
        // Limitar resultados
        { $limit: limit },
        
        // Proyectar campos
        {
          $project: {
            _id: 0,
            id_producto: '$_id',
            clickCount: 1,
            lastClick: 1,
            nombre: 1
          }
        }
      ]);

      console.log(`✅ Top ${topClicks.length} productos más clickeados (BD real)`);

      // 3. Obtener información completa de productos desde API
      try {
        const result = await productsService.searchAndFilterProducts({});
        const productosCompletos = result.productos;
        
        return topClicks.map((item: any) => {
          const producto = productosCompletos.find(
            (p: any) => p.id_producto === item.id_producto
          );
          
          return {
            id_producto: item.id_producto,
            nombre: item.nombre,
            clickCount: item.clickCount,
            lastClick: item.lastClick,
            producto: producto || null
          };
        });
      } catch (apiError) {
        console.warn('⚠️ API de productos no disponible, usando datos locales');
        return topClicks;
      }

    } catch (error) {
      console.error('❌ Error al obtener productos populares:', error);
      throw error;
    }
  }

  /**
   * Obtiene productos populares desde datos dummy
   * @param limit Número de productos a retornar
   */
  private static async getPopularProductsFromDummy(limit: number = 6) {
    // Contar clicks por producto desde datos dummy
    const clickCounts = new Map<string, { count: number; nombre: string; lastClick: string }>();
    
    clicksDummy.forEach(click => {
      const current = clickCounts.get(click.id_producto) || { 
        count: 0, 
        nombre: click.nombre,
        lastClick: click.fecha 
      };
      
      current.count++;
      
      // Actualizar última fecha si es más reciente
      if (new Date(click.fecha) > new Date(current.lastClick)) {
        current.lastClick = click.fecha;
      }
      
      clickCounts.set(click.id_producto, current);
    });

    // Obtener productos normalizados desde el servicio
    const productosNormalizados = await productsService.getProductos();

    // Convertir a array y ordenar por cantidad de clicks
    const topProducts = Array.from(clickCounts.entries())
      .map(([id_producto, data]) => {
        const producto = productosNormalizados.find(p => p.id_producto === id_producto);
        return {
          id_producto,
          nombre: data.nombre,
          clickCount: data.count,
          lastClick: data.lastClick,
          producto: producto || null
        };
      })
      .sort((a, b) => b.clickCount - a.clickCount)
      .slice(0, limit);

    console.log(`✅ Top ${topProducts.length} productos populares (DUMMY)`);
    return topProducts;
  }

  /**
   * Obtiene TODOS los datos de búsquedas de la BD para analítica
   * Si USE_DUMMY_ANALYTICS=true y BD vacía, retorna datos dummy
   * @returns Array completo de búsquedas (search_queries: solo valor_busqueda y fecha)
   */
  static async getAllSearches() {
    try {
      const searchCount = await SearchQuery.countDocuments();
      
      if (searchCount === 0 && USE_DUMMY_ANALYTICS) {
        console.log('🔧 MODO DUMMY ANALYTICS: Usando searches_dummy.json');
        return searchesDummy;
      }

      // Obtener todas las búsquedas desde BD real (search_queries)
      const searches = await SearchQuery.find()
        .select('valor_busqueda fecha')
        .sort({ fecha: -1 })
        .lean();

      console.log(`✅ ${searches.length} búsquedas obtenidas (BD real)`);
      return searches;

    } catch (error) {
      console.error('❌ Error al obtener búsquedas:', error);
      throw error;
    }
  }

  /**
   * Obtiene TODOS los datos de clicks de la BD para analítica
   * Si USE_DUMMY_ANALYTICS=true y BD vacía, retorna datos dummy
   * @returns Array completo de clicks
   */
  static async getAllClicks() {
    try {
      const clickCount = await Click.countDocuments();
      
      if (clickCount === 0 && USE_DUMMY_ANALYTICS) {
        console.log('🔧 MODO DUMMY ANALYTICS: Usando clicks_dummy.json');
        return clicksDummy;
      }

      // Obtener todos los clicks desde BD real
      // NO incluir userId - no le incumbe al Grupo 1 de Analítica
      const clicks = await Click.find()
        .select('id_producto nombre fecha')
        .sort({ fecha: -1 })
        .lean();

      console.log(`✅ ${clicks.length} clicks obtenidos (BD real)`);
      return clicks;

    } catch (error) {
      console.error('❌ Error al obtener clicks:', error);
      throw error;
    }
  }

  /**
   * Obtiene estadísticas generales de búsquedas
   */
  static async getSearchStats() {
    try {
      const stats = await SearchHistory.aggregate([
        {
          $facet: {
            totalSearches: [{ $count: 'count' }],
            searchesByCategory: [
              { $match: { 'filters.categoria': { $exists: true, $ne: null } } },
              { $group: { _id: '$filters.categoria', count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ],
            searchesByCondition: [
              { $match: { 'filters.condicion': { $exists: true, $ne: null } } },
              { $group: { _id: '$filters.condicion', count: { $sum: 1 } } },
              { $sort: { count: -1 } }
            ],
            recentSearches: [
              { $sort: { requestedAt: -1 } },
              { $limit: 10 },
              {
                $project: {
                  queryText: 1,
                  requestedAt: 1,
                  resultsCount: { $size: '$results' }
                }
              }
            ]
          }
        }
      ]);

      return {
        totalSearches: stats[0].totalSearches[0]?.count || 0,
        searchesByCategory: stats[0].searchesByCategory,
        searchesByCondition: stats[0].searchesByCondition,
        recentSearches: stats[0].recentSearches
      };

    } catch (error) {
      console.error('❌ Error al obtener estadísticas:', error);
      throw error;
    }
  }

  /**
   * Obtiene los términos de búsqueda más populares
   * @param limit Número de términos a retornar
   */
  static async getTopSearchTerms(limit: number = 10) {
    try {
      const topTerms = await SearchHistory.aggregate([
        // Filtrar búsquedas con texto real (no navegación por categoría)
        {
          $match: {
            queryText: { 
              $exists: true, 
              $nin: ['[navegación por categoría/filtros]', '']
            }
          }
        },
        
        // Agrupar por término de búsqueda
        {
          $group: {
            _id: { $toLower: '$queryText' },
            count: { $sum: 1 },
            lastSearched: { $max: '$requestedAt' }
          }
        },
        
        // Ordenar por frecuencia
        { $sort: { count: -1 } },
        
        // Limitar resultados
        { $limit: limit },
        
        // Proyectar
        {
          $project: {
            _id: 0,
            term: '$_id',
            count: 1,
            lastSearched: 1
          }
        }
      ]);

      console.log(`✅ Top ${topTerms.length} términos de búsqueda obtenidos`);
      return topTerms;

    } catch (error) {
      console.error('❌ Error al obtener términos populares:', error);
      throw error;
    }
  }

  /**
   * Obtiene tendencias de búsqueda por período
   * @param days Número de días atrás para analizar
   */
  static async getSearchTrends(days: number = 7) {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const trends = await SearchHistory.aggregate([
        // Filtrar por fecha
        { $match: { requestedAt: { $gte: startDate } } },
        
        // Agrupar por día
        {
          $group: {
            _id: {
              $dateToString: {
                format: '%Y-%m-%d',
                date: '$requestedAt'
              }
            },
            count: { $sum: 1 },
            uniqueUsers: { $addToSet: '$userId' }
          }
        },
        
        // Ordenar por fecha
        { $sort: { _id: 1 } },
        
        // Proyectar
        {
          $project: {
            _id: 0,
            date: '$_id',
            searches: '$count',
            uniqueUsers: { $size: '$uniqueUsers' }
          }
        }
      ]);

      console.log(`✅ Tendencias de búsqueda para últimos ${days} días obtenidas`);
      return trends;

    } catch (error) {
      console.error('❌ Error al obtener tendencias:', error);
      throw error;
    }
  }
}

export default AnalyticsService;
