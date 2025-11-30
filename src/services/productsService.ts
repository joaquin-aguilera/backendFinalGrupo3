import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import productosDemo from '../data/productos_dummy.json';

dotenv.config();

// Control de modo dummy para productos
const USE_DUMMY_PRODUCTS = process.env.USE_DUMMY_PRODUCTS === 'true';

// Interfaz según respuesta real de GET /publicaciones
export interface PublicacionFromAPI {
  id: string;
  id_producto: string;
  titulo: string;
  descripcion: string;
  multimedia: Array<{
    id?: string;
    url: string;
    orden: number;
  }>;
  producto: {
    precio: number;
    categoria: string;
    condicion: string;
    stock: number;
    marca: string;
  } | null;
}

// Interfaz normalizada para el backend
export interface ProductoNormalizado {
  id: string;
  id_producto: string;
  titulo: string;
  descripcion: string;
  precio: number;
  categoria: string;
  condicion: string;
  stock: number;
  marca: string;
  multimedia: Array<{
    url: string;
    orden: number;
  }>;
}

export interface FilterOptions {
  busqueda?: string;
  precio_min?: number;
  precio_max?: number;
  categoria?: string;
  condicion?: string;
  ordenar?: 'precio-asc' | 'precio-desc';
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse {
  productos: ProductoNormalizado[];
  metadata: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// Tipos válidos según API OpenAPI
type CondicionProducto = 'nuevo' | 'usado' | 'reacondicionado';
type CategoriaProducto = 
  | 'Electrónica'
  | 'Ropa'
  | 'Calzado'
  | 'Hogar'
  | 'Juguetes'
  | 'Deportes'
  | 'Libros'
  | 'Alimentos'
  | 'Belleza'
  | 'Oficina'
  | 'Automotriz'
  | 'Mascotas'
  | 'General';

export class ProductsService {
  private apiClient: AxiosInstance;
  private baseURL: string;

  constructor() {
    // URL del microservicio de publicaciones
    this.baseURL = process.env.PUBLICATIONS_API_URL || 'http://localhost:4040/api';
    
    this.apiClient = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
    });

    // Agregar token si existe
    if (process.env.PUBLICATIONS_API_TOKEN) {
      this.apiClient.defaults.headers.common['Authorization'] = `Bearer ${process.env.PUBLICATIONS_API_TOKEN}`;
    }
  }

  /**
   * Normaliza una publicación de la API al formato interno
   */
  private normalizePublicacion(pub: PublicacionFromAPI): ProductoNormalizado | null {
    // Si producto es null, no podemos normalizar
    if (!pub.producto) {
      console.warn(`Publicación ${pub.id} sin datos de producto`);
      return null;
    }

    // Extraer primera imagen del multimedia si existe
    const primeraImagen = pub.multimedia && pub.multimedia.length > 0 
      ? pub.multimedia.sort((a, b) => a.orden - b.orden)[0].url 
      : undefined;

    return {
      id: pub.id,
      id_producto: pub.id_producto,
      titulo: pub.titulo,
      descripcion: pub.descripcion,
      precio: pub.producto.precio,
      categoria: pub.producto.categoria,
      condicion: pub.producto.condicion,
      stock: pub.producto.stock,
      marca: pub.producto.marca,
      multimedia: pub.multimedia || [],
      imagen: primeraImagen, // Agregar campo imagen para fácil acceso
    } as any;
  }

  /**
   * Datos de demostración desde productos_dummy.json cuando la API no está disponible
   */
  private getDemoProducts(): ProductoNormalizado[] {
    return (productosDemo as any[]).map((p: any) => {
      // Extraer primera imagen del multimedia si existe
      const primeraImagen = p.multimedia && p.multimedia.length > 0 
        ? p.multimedia.sort((a: any, b: any) => a.orden - b.orden)[0].url 
        : undefined;

      return {
        id: p.id,
        id_producto: p.id_producto,
        titulo: p.titulo,
        descripcion: p.descripcion,
        precio: p.producto.precio,
        categoria: p.producto.categoria,
        condicion: p.producto.condicion,
        stock: p.producto.stock,
        marca: p.producto.marca,
        multimedia: p.multimedia || [],
        imagen: primeraImagen,
      } as any;
    });
  }

  /**
   * Busca y filtra productos de forma DINÁMICA con paginación
   * NO guarda productos en BD, trabaja directamente con la API
   */
  async searchAndFilterProducts(filters: FilterOptions = {}): Promise<PaginatedResponse> {
    const {
      busqueda = '',
      precio_min,
      precio_max,
      categoria,
      condicion,
      ordenar,
      page = 1,
      pageSize = 20
    } = filters;

    try {
      // 1. Intentar obtener productos de API externa
      let todosProductos: ProductoNormalizado[];

      // MODO DUMMY: Para pruebas sin API de publicaciones
      if (USE_DUMMY_PRODUCTS) {
        console.log('🔧 MODO DUMMY ACTIVADO: Usando productos_dummy.json');
        todosProductos = this.getDemoProducts();
      } else {
        try {
          console.log('🔍 Obteniendo publicaciones desde API externa (puerto 4040)...');
          const response = await this.apiClient.get('/publicaciones');
          
          const data = Array.isArray(response.data) ? response.data : response.data.data;
          
          if (data && Array.isArray(data) && data.length > 0) {
            console.log(`✅ ${data.length} publicaciones obtenidas de API EXTERNA (Grupo 2)`);
            
            // Normalizar y filtrar productos null
            todosProductos = data
              .map((p: PublicacionFromAPI) => this.normalizePublicacion(p))
              .filter((p): p is ProductoNormalizado => p !== null);
          } else {
            throw new Error('API no retornó datos');
          }
        } catch (apiError: any) {
          // En modo integración, lanzar error si la API no está disponible
          console.error('❌ API externa no disponible:', apiError.message);
          throw new Error(`No se pudo conectar con la API de publicaciones: ${apiError.message}`);
        }
      }

      // 2. Filtrar por búsqueda de texto (título, descripción, marca)
      let productosFiltrados = todosProductos;

      if (busqueda && busqueda.trim()) {
        const searchLower = busqueda.toLowerCase().trim();
        productosFiltrados = productosFiltrados.filter(
          p =>
            p.titulo.toLowerCase().includes(searchLower) ||
            p.descripcion.toLowerCase().includes(searchLower) ||
            p.marca.toLowerCase().includes(searchLower)
        );
      }

      // 3. Aplicar filtros de precio
      if (precio_min !== undefined) {
        productosFiltrados = productosFiltrados.filter(p => p.precio >= precio_min);
      }
      if (precio_max !== undefined) {
        productosFiltrados = productosFiltrados.filter(p => p.precio <= precio_max);
      }

      // 4. Aplicar filtros de categoría y condición
      if (categoria) {
        productosFiltrados = productosFiltrados.filter(
          p => p.categoria.toLowerCase() === categoria.toLowerCase()
        );
      }
      if (condicion) {
        productosFiltrados = productosFiltrados.filter(
          p => p.condicion.toLowerCase() === condicion.toLowerCase()
        );
      }

      // 5. Aplicar ordenamiento
      if (ordenar) {
        if (ordenar === 'precio-asc') {
          productosFiltrados.sort((a, b) => a.precio - b.precio);
        } else if (ordenar === 'precio-desc') {
          productosFiltrados.sort((a, b) => b.precio - a.precio);
        }
      }

      // 6. Calcular paginación
      const total = productosFiltrados.length;
      const totalPages = Math.ceil(total / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const productosPaginados = productosFiltrados.slice(startIndex, endIndex);

      console.log(`📄 Página ${page}/${totalPages} - Mostrando ${productosPaginados.length} de ${total} productos`);

      return {
        productos: productosPaginados,
        metadata: {
          total,
          page,
          pageSize,
          totalPages,
          hasMore: page < totalPages,
        },
      };
    } catch (error: any) {
      console.error('❌ Error en búsqueda y filtrado:', error.message);
      
      // En modo integración, propagar el error
      // En modo dummy, nunca debería llegar aquí
      throw error;
    }
  }

  /**
   * Obtiene un producto específico por ID
   */
  async getProductById(id: string): Promise<ProductoNormalizado | null> {
    // MODO DUMMY
    if (USE_DUMMY_PRODUCTS) {
      const demoProducts = this.getDemoProducts();
      return demoProducts.find(p => p.id === id || p.id_producto === id) || null;
    }

    try {
      const response = await this.apiClient.get(`/publicaciones/${id}`);
      return this.normalizePublicacion(response.data);
    } catch (error: any) {
      console.error(`Error obteniendo producto ${id}:`, error.message);
      throw new Error(`No se pudo obtener el producto ${id}: ${error.message}`);
    }
  }

  /**
   * Obtiene todos los productos (sin filtros ni paginación)
   * Útil para operaciones internas que necesitan todos los datos
   */
  async getProductos(filters?: { categoria?: string }): Promise<ProductoNormalizado[]> {
    try {
      // MODO DUMMY
      if (USE_DUMMY_PRODUCTS) {
        console.log('🔧 MODO DUMMY: Usando productos_dummy.json');
        let productos = this.getDemoProducts();
        
        if (filters?.categoria) {
          productos = productos.filter(
            p => p.categoria.toLowerCase() === filters.categoria!.toLowerCase()
          );
        }
        
        return productos;
      }

      // Intentar obtener de la API
      console.log('🔍 Obteniendo todos los productos desde API...');
      const response = await this.apiClient.get('/publicaciones');
      
      const data = Array.isArray(response.data) ? response.data : response.data.data;
      
      if (data && Array.isArray(data) && data.length > 0) {
        let productos = data
          .map((p: PublicacionFromAPI) => this.normalizePublicacion(p))
          .filter((p): p is ProductoNormalizado => p !== null);
        
        // Aplicar filtro de categoría si existe
        if (filters?.categoria) {
          productos = productos.filter(
            p => p.categoria.toLowerCase() === filters.categoria!.toLowerCase()
          );
        }
        
        console.log(`✓ ${productos.length} productos obtenidos`);
        return productos;
      } else {
        throw new Error('API no retornó datos');
      }
    } catch (error: any) {
      console.error('❌ Error obteniendo productos:', error.message);
      throw new Error(`No se pudo obtener productos: ${error.message}`);
    }
  }
}

// Exportar instancia singleton
export const productsService = new ProductsService();
