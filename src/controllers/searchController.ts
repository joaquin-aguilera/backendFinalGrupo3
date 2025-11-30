import { Request, Response } from 'express';
import { SearchService, SearchFilters } from '../services/searchService';
import { productsService, ProductoNormalizado } from '../services/productsService';
import { BadRequestError } from '../errors/BadRequestError';
import axios from 'axios';

export const getSuggestions = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { texto } = req.query;

    // Validación básica de seguridad
    if (texto !== undefined && typeof texto !== 'string') {
      return res.status(400).json({ error: 'texto debe ser string' });
    }
    const textoSafe = typeof texto === 'string' ? texto.trim() : '';
    if (textoSafe.length > 100) {
      return res.status(400).json({ error: 'texto demasiado largo' });
    }

    // Obtener sugerencias del historial (máximo 5)
    const historial = await SearchService.getSuggestions(textoSafe, req.userId?.toString());

    // Si ya tenemos 5 del historial, no buscar coincidencias
    let sugerencias = [...historial];
    
    // Si hay texto y aún no tenemos 5 sugerencias, buscar coincidencias en productos
    if (textoSafe.length >= 2 && sugerencias.length < 5) {
      const maxCoincidencias = 5 - sugerencias.length;
      const { productos } = await productsService.searchAndFilterProducts({
        busqueda: textoSafe,
        pageSize: maxCoincidencias,
      });

      const coincidencias = productos.map(p => ({
        texto: p.titulo,
        tipo: 'coincidencia' as const,
      }));

      sugerencias = [...sugerencias, ...coincidencias];
    }

    // Asegurar máximo 5 sugerencias
    sugerencias = sugerencias.slice(0, 5);

    const endTime = Date.now();
    console.log(`Sugerencias obtenidas en ${endTime - startTime}ms (${sugerencias.length} total)`);

    res.json(sugerencias);
  } catch (error) {
    console.error('Error al obtener sugerencias:', error);
    res.status(500).json({ error: 'Error al obtener sugerencias' });
  }
};


export const search = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    // Preferir parámetros saneados por el middleware
    const safe = ((req as any).searchQuery ?? req.query) as {
      busqueda?: string;
      precio?: string;
      categoria?: string;
      condicion?: string;
      ordenar?: string;
      page?: string;
      pageSize?: string;
    };

    const {
      busqueda = '',
      precio,
      categoria,
      condicion,
      ordenar,
      page = '1',
      pageSize = '20'
    } = safe;

    // Parsear paginación (ahora viene del middleware ya parseado)
    const pageNum = typeof page === 'number' ? page : Math.max(1, parseInt(page as string, 10) || 1);
    const pageSizeNum = typeof pageSize === 'number' ? pageSize : Math.min(50, Math.max(1, parseInt(pageSize as string, 10) || 20));

    // Convertir filtro de precio a rango (precios en CLP)
    let precio_min: number | undefined;
    let precio_max: number | undefined;

    if (precio) {
      switch (precio) {
        case 'hasta 5000':
          precio_max = 5000;
          break;
        case 'entre 5000 - 10000':
          precio_min = 5000;
          precio_max = 10000;
          break;
        case 'entre 10000 - 25000':
          precio_min = 10000;
          precio_max = 25000;
          break;
        case 'entre 25000 - 50000':
          precio_min = 25000;
          precio_max = 50000;
          break;
        case 'entre 50000 - 100000':
          precio_min = 50000;
          precio_max = 100000;
          break;
        case 'entre 100000 - 300000':
          precio_min = 100000;
          precio_max = 300000;
          break;
        case 'entre 300000 - 500000':
          precio_min = 300000;
          precio_max = 500000;
          break;
        case 'mas de 500000':
          precio_min = 500000;
          break;
      }
    }

    // Buscar y filtrar productos dinámicamente
    const result = await productsService.searchAndFilterProducts({
      busqueda: busqueda as string,
      precio_min,
      precio_max,
      categoria: categoria as string,
      condicion: condicion as string,
      ordenar: ordenar as 'precio-asc' | 'precio-desc',
      page: pageNum,
      pageSize: pageSizeNum,
    });

    // LÓGICA DE GUARDADO:
    // 1. Guardar search_query SIEMPRE si hay texto de búsqueda (para análisis)
    const hasSearchText = busqueda && (busqueda as string).trim() !== '';
    
    if (hasSearchText) {
      await SearchService.saveSearchQuery(busqueda as string);
    }

    // 2. Guardar en search_history SOLO si:
    //    - Hay texto de búsqueda (NO solo filtros)
    //    - Hay userId (autenticado o anónimo con sesión)
    //    - Hay resultados
    if (hasSearchText && req.userId && result.productos.length > 0) {
      const filtros: SearchFilters = {};
      if (precio) filtros.precio = precio as string;
      if (categoria) filtros.categoria = categoria as string;
      if (condicion) filtros.condicion = condicion as string;
      if (ordenar) filtros.ordenar = ordenar as string;

      await SearchService.saveSearchHistory({
        userId: req.userId,
        queryText: busqueda as string,
        filters: filtros,
        sortBy: ordenar as string,
        sortDir: ordenar === 'precio-asc' ? 'asc' : ordenar === 'precio-desc' ? 'desc' : undefined,
        page: pageNum,
        pageSize: pageSizeNum,
        results: result.productos.map(p => p.id_producto),
        isAnonymous: req.isAnonymous || false,
      });
    }

    const endTime = Date.now();
    console.log(`Búsqueda realizada en ${endTime - startTime}ms`);
    console.log(`Página ${result.metadata.page}/${result.metadata.totalPages} - ${result.metadata.total} resultados`);

    // Incluir sessionId en respuesta si es usuario anónimo
    const response: any = result;
    if (req.isAnonymous && req.sessionId) {
      response.sessionId = req.sessionId;
    }

    res.json(response);
  } catch (error: any) {
    console.error('Error en búsqueda:', error);
    if (error instanceof BadRequestError) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error al realizar la búsqueda' });
  }
};



// Nuevo controlador para obtener todos los productos (con paginación)
export const getAllProducts = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const pageSize = parseInt(req.query.pageSize as string, 10) || 20;

    const result = await productsService.searchAndFilterProducts({
      page,
      pageSize,
    });

    const endTime = Date.now();
    console.log(`Todos los productos obtenidos en ${endTime - startTime}ms`);

    res.json(result);
  } catch (error) {
    console.error('Error al obtener todos los productos:', error);
    res.status(500).json({ error: 'Error al obtener todos los productos' });
  }
};

// Nuevo controlador para obtener productos aleatorios
export const getRandomProducts = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 20));

    // Obtener todos los productos y mezclarlos
    const { productos } = await productsService.searchAndFilterProducts({
      pageSize: 1000, // Obtener muchos para mezclar
    });
    
    // Algoritmo Fisher-Yates para mezclar
    const productosAleatorios = [...productos];
    for (let i = productosAleatorios.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [productosAleatorios[i], productosAleatorios[j]] = [productosAleatorios[j], productosAleatorios[i]];
    }

    const resultados = productosAleatorios.slice(0, limit);

    const endTime = Date.now();
    console.log(`Productos aleatorios obtenidos en ${endTime - startTime}ms`);

    res.json({
      productos: resultados,
      metadata: {
        total: resultados.length,
        totalDisponible: productos.length,
        hasMore: false
      }
    });
  } catch (error) {
    console.error('Error al obtener productos aleatorios:', error);
    res.status(500).json({ error: 'Error al obtener productos aleatorios' });
  }
};


export const getSearchHistory = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const historial = await SearchService.getSearchHistory(req.userId);

    const endTime = Date.now();
    console.log(`Historial obtenido en ${endTime - startTime}ms`);

    // Incluir información de sesión si es anónimo
    const response: any = { historial };
    if (req.isAnonymous && req.sessionId) {
      response.sessionId = req.sessionId;
      response.isTemporary = true;
      response.message = 'Historial temporal de sesión anónima (se borrará al cerrar)';
    }

    res.json(response);
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({ error: 'Error al obtener el historial' });
  }
};

/**
 * Elimina una búsqueda específica del historial
 * Solo el dueño del historial puede eliminarlo
 */
export const deleteSearchHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'ID de búsqueda requerido' });
    }

    if (!req.userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const deleted = await SearchService.deleteSearchHistory(id, req.userId);

    if (!deleted) {
      return res.status(404).json({ error: 'Búsqueda no encontrada o no autorizado' });
    }

    res.json({ success: true, message: 'Búsqueda eliminada del historial' });
  } catch (error) {
    console.error('Error al eliminar búsqueda del historial:', error);
    res.status(500).json({ error: 'Error al eliminar búsqueda del historial' });
  }
};

/**
 * Elimina TODO el historial del usuario
 */
export const clearSearchHistory = async (req: Request, res: Response) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    const deletedCount = await SearchService.clearUserHistory(req.userId);

    res.json({
      success: true,
      message: `Historial completo eliminado: ${deletedCount} registros`,
      deletedCount
    });
  } catch (error) {
    console.error('Error al limpiar historial:', error);
    res.status(500).json({ error: 'Error al limpiar el historial' });
  }
};

/**
 * Cierra una sesión anónima y borra su historial temporal
 */
export const closeAnonymousSession = async (req: Request, res: Response) => {
  try {
    const sessionId = req.sessionId || req.body.sessionId || req.query.sessionId as string;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId requerido' });
    }

    const SessionService = require('../services/sessionService').default;
    await SessionService.closeSession(sessionId);

    res.json({
      success: true,
      message: 'Sesión anónima cerrada y historial temporal eliminado'
    });
  } catch (error) {
    console.error('Error al cerrar sesión anónima:', error);
    res.status(500).json({ error: 'Error al cerrar sesión anónima' });
  }
};


export const saveSearchHistory = async (req: Request, res: Response) => {
  try {
    const { busqueda, filtros } = req.body;

    // Validación básica
    if (!busqueda || typeof busqueda !== 'string') {
      return res.status(400).json({ error: 'busqueda es requerida y debe ser string' });
    }

    if (!req.userId) {
      return res.status(401).json({ error: 'Usuario no autenticado' });
    }

    // Guardar la búsqueda en historial
    const resultado = await SearchService.saveSearchHistory({
      userId: req.userId.toString(),
      queryText: busqueda,
      filters: filtros || {},
      results: [],
    });

    res.json({ success: true, message: 'Búsqueda guardada exitosamente', resultado });
  } catch (error) {
    console.error('Error al guardar búsqueda:', error);
    res.status(500).json({ error: 'Error al guardar la búsqueda' });
  }
};

// Controlador para registrar click en producto
export const registerProductClick = async (req: Request, res: Response) => {
  try {
    const { id_producto, nombre } = req.body;

    // Validación básica
    if (!id_producto || typeof id_producto !== 'string') {
      return res.status(400).json({ error: 'id_producto es requerido y debe ser string' });
    }
    if (!nombre || typeof nombre !== 'string') {
      return res.status(400).json({ error: 'nombre es requerido y debe ser string' });
    }

    // Registrar el click
    await SearchService.saveClick({
      id_producto,
      nombre,
      userId: req.userId?.toString(),
    });

    res.json({ success: true, message: 'Click registrado exitosamente' });
  } catch (error) {
    console.error('Error al registrar click:', error);
    res.status(500).json({ error: 'Error al registrar el click' });
  }
};

// Controlador para obtener clicks de un producto
export const getProductClicks = async (req: Request, res: Response) => {
  try {
    const { id_producto } = req.params;

    if (!id_producto) {
      return res.status(400).json({ error: 'id_producto es requerido' });
    }

    const clicks = await SearchService.getClicksByProduct(id_producto);

    res.json({ id_producto, totalClicks: clicks.length, clicks });
  } catch (error) {
    console.error('Error al obtener clicks del producto:', error);
    res.status(500).json({ error: 'Error al obtener clicks del producto' });
  }
};


// Controlador para exportar búsquedas simples (para integración con otros grupos)
export const getProductSearches = async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { desde, hasta, limite } = req.query;

    // Construir filtro de fecha
    const filtroFecha: any = {};
    if (desde) {
      const fechaDesde = new Date(desde as string);
      if (!isNaN(fechaDesde.getTime())) {
        filtroFecha.$gte = fechaDesde;
      }
    }
    if (hasta) {
      const fechaHasta = new Date(hasta as string);
      if (!isNaN(fechaHasta.getTime())) {
        filtroFecha.$lte = fechaHasta;
      }
    }

    const matchFilter: any = {};
    if (Object.keys(filtroFecha).length > 0) {
      matchFilter.fecha = filtroFecha;
    }

    // Agregar límite si se especifica
    const limitNum = limite ? parseInt(limite as string, 10) : 1000;
    const limiteSafe = Math.min(Math.max(limitNum, 1), 10000);

    // Obtener búsquedas simples desde search_queries
    const { SearchQuery } = require('../models/Search');
    const searchQueries = await SearchQuery.find(matchFilter)
      .sort({ fecha: -1 })
      .limit(limiteSafe)
      .lean();

    const endTime = Date.now();
    console.log(`Búsquedas exportadas en ${endTime - startTime}ms`);
    console.log(`Total de registros: ${searchQueries.length}`);

    res.json({
      total: searchQueries.length,
      periodo: {
        desde: desde || 'inicio',
        hasta: hasta || 'ahora'
      },
      datos: searchQueries.map((sq: any) => ({
        valor_busqueda: sq.valor_busqueda,
        fecha: sq.fecha.toISOString()
      }))
    });
  } catch (error) {
    console.error('Error al obtener búsquedas:', error);
    res.status(500).json({ error: 'Error al obtener búsquedas' });
  }
};


/**
 * Obtiene el detalle completo de un producto desde el microservicio de publicaciones
 */
export const getProductDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ error: 'ID de producto requerido' });
    }

    // Intentar obtener la publicación completa
    const producto = await productsService.getProductById(id);

    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json(producto);
  } catch (error) {
    console.error('Error al obtener detalle del producto:', error);
    res.status(500).json({ 
      error: 'Error al obtener detalle del producto',
      message: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};
