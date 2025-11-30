import SearchHistory, { ISearchHistory, SearchQuery } from '../models/Search';
import Click from '../models/Click';
import SessionService from './sessionService';

export interface SearchFilters {
  precio?: string;
  categoria?: string;
  condicion?: string;
  ordenar?: string;
  ordenPrecio?: string;  // Alias para frontend
}

export interface Suggestion {
  texto: string;
  tipo: 'historial' | 'coincidencia';
  filtros?: SearchFilters;
  id?: string;  // ID para poder eliminar del historial
}

export class SearchService {
  /**
   * Guarda una búsqueda en el historial del usuario
   * - Usuario autenticado: Guarda permanentemente en BD
   * - Usuario anónimo: Guarda temporalmente (se borrará al cerrar sesión)
   */
  static async saveSearchHistory(data: {
    userId: string;
    queryText: string;
    filters?: SearchFilters;
    sortBy?: string;
    sortDir?: 'asc' | 'desc';
    page?: number;
    pageSize?: number;
    results: string[]; // IDs de productos
    isAnonymous?: boolean;
  }): Promise<ISearchHistory> {
    const searchHistory = new SearchHistory({
      userId: data.userId, // Para anónimos será "anonymous_session_xxx"
      queryText: data.queryText,
      filters: data.filters || {},
      sortBy: data.sortBy,
      sortDir: data.sortDir,
      page: data.page || 1,
      pageSize: data.pageSize || 20,
      requestedAt: new Date(),
      results: data.results,
    });

    const saved = await searchHistory.save();

    if (data.isAnonymous) {
      console.log(`💾 Historial temporal guardado para sesión anónima: ${data.userId}`);
    } else {
      console.log(`💾 Historial permanente guardado para usuario: ${data.userId}`);
    }

    return saved;
  }

  /**
   * Guarda una búsqueda simple para análisis (anónima)
   * Se guarda SIEMPRE, independiente de si el usuario está autenticado o no
   */
  static async saveSearchQuery(queryText: string): Promise<void> {
    if (queryText && queryText.trim()) {
      await SearchQuery.create({
        valor_busqueda: queryText.trim(),
        fecha: new Date(),
      });
      console.log(`📊 Búsqueda registrada para análisis: "${queryText}"`);
    }
  }

  /**
   * Obtiene sugerencias desde el historial del usuario
   * - Usuario autenticado: Desde su historial permanente
   * - Usuario anónimo: Desde su historial temporal de la sesión
   * Si queryText está vacío, retorna las últimas 5 búsquedas del usuario
   */
  static async getSuggestions(queryText: string, userId?: string): Promise<Suggestion[]> {
    if (!userId) return [];

    // Si no hay texto, mostrar las últimas 5 búsquedas del historial
    const query: any = { userId };
    
    // Solo agregar filtro de regex si hay texto de búsqueda
    if (queryText && queryText.trim() !== '') {
      query.queryText = { $regex: queryText, $options: 'i' };
    }

    const searches = await SearchHistory.find(query)
      .sort({ requestedAt: -1 })
      .limit(5)
      .select('_id queryText filters');
      
    return searches.map(search => {
      // Mapear nombres de filtros del backend al frontend
      const filtrosOriginales = search.filters as SearchFilters || {};
      const filtrosMapeados: SearchFilters = {};
      
      if (filtrosOriginales.precio) filtrosMapeados.precio = filtrosOriginales.precio;
      if (filtrosOriginales.categoria) filtrosMapeados.categoria = filtrosOriginales.categoria;
      if (filtrosOriginales.condicion) filtrosMapeados.condicion = filtrosOriginales.condicion;
      // Mapear 'ordenar' a 'ordenPrecio' que es como lo espera el frontend
      if (filtrosOriginales.ordenar) filtrosMapeados.ordenPrecio = filtrosOriginales.ordenar;
      
      return {
        id: (search._id as any).toString(),
        texto: search.queryText,
        tipo: 'historial' as const,
        filtros: filtrosMapeados
      };
    });
  }

  /**
   * Obtiene el historial de búsquedas del usuario
   * - Usuario autenticado: Historial permanente
   * - Usuario anónimo: Historial temporal de la sesión
   */
  static async getSearchHistory(userId?: string, limit: number = 10): Promise<ISearchHistory[]> {
    if (!userId) return [];
    
    return await SearchHistory.find({ userId })
      .sort({ requestedAt: -1 })
      .limit(limit);
  }

  /**
   * Elimina una búsqueda del historial del usuario
   * SOLO el usuario puede eliminar su propio historial
   */
  static async deleteSearchHistory(searchId: string, userId: string): Promise<boolean> {
    const result = await SearchHistory.deleteOne({
      _id: searchId,
      userId: userId, // Verificar que pertenezca al usuario
    });

    return result.deletedCount > 0;
  }

  /**
   * Elimina TODO el historial de un usuario
   */
  static async clearUserHistory(userId: string): Promise<number> {
    const result = await SearchHistory.deleteMany({ userId });
    console.log(`🗑️  Historial completo eliminado para usuario ${userId}: ${result.deletedCount} registros`);
    return result.deletedCount;
  }

  /**
   * Registra un click en un producto
   * - Usuario autenticado: Con su userId
   * - Usuario anónimo: Con userId temporal de la sesión
   */
  static async saveClick(data: {
    id_producto: string;
    nombre: string;
    userId?: string;
  }): Promise<void> {
    await Click.create({
      id_producto: data.id_producto,
      nombre: data.nombre,
      fecha: new Date(),
      userId: data.userId,
    });

    const type = data.userId && !SessionService.isAnonymousUserId(data.userId) ? 'permanente' : 'temporal';
    console.log(`👆 Click ${type} registrado: ${data.nombre} (${data.id_producto})`);
  }

  /**
   * Obtiene clicks por producto (para análisis de popularidad)
   */
  static async getClicksByProduct(id_producto: string, limit: number = 100) {
    return await Click.find({ id_producto })
      .sort({ fecha: -1 })
      .limit(limit);
  }

  /**
   * Obtiene clicks por usuario
   */
  static async getClicksByUser(userId: string, limit: number = 50) {
    return await Click.find({ userId })
      .sort({ fecha: -1 })
      .limit(limit);
  }
}

