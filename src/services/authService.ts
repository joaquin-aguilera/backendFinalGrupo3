import axios, { AxiosError } from 'axios';
import testAuthenticatedUser from '../data/test_authenticated_user.json';
import anonymousUserTemplate from '../data/anonymous_user_template.json';

/**
 * Información del usuario autenticado desde el servicio de autenticación
 */
export interface UserInfo {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  roles: string[];
  permisos: string[];
  activo: boolean;
  creado_en?: string;
  actualizado_en?: string;
}

/**
 * Respuesta del endpoint can-access
 */
export interface CanAccessResponse {
  page: string;
  hasAccess: boolean;
}

/**
 * Configuración del servicio de autenticación
 */
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3000/api';
const AUTH_SERVICE_TIMEOUT = parseInt(process.env.AUTH_SERVICE_TIMEOUT || '5000', 10);
const USE_DUMMY_AUTH = process.env.USE_DUMMY_AUTH === 'true'; // Activar modo dummy para pruebas

/**
 * Cache simple en memoria para reducir llamadas al servicio de autenticación
 * Estructura: token -> { userInfo, timestamp }
 */
interface CacheEntry {
  userInfo: UserInfo;
  timestamp: number;
}

const tokenCache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos en milisegundos

/**
 * Servicio para interactuar con el sistema de autenticación del grupo de autenticación
 */
export class AuthService {
  /**
   * Verifica un token JWT consultando el servicio de autenticación
   * MODO DUMMY: Si USE_DUMMY_AUTH=true, retorna usuario dummy sin consultar servicio
   * @param token Token JWT a verificar
   * @returns Información del usuario si el token es válido, null en caso contrario
   */
  static async verifyToken(token: string): Promise<UserInfo | null> {
    if (!token || token.trim() === '') {
      return null;
    }

    // MODO PRUEBA: Para desarrollo sin servicio de autenticación
    if (USE_DUMMY_AUTH) {
      console.log('🔧 MODO PRUEBA ACTIVADO: Usando usuario de prueba autenticado');
      return testAuthenticatedUser as UserInfo;
    }

    try {
      // Verificar cache
      const cached = tokenCache.get(token);
      if (cached) {
        const age = Date.now() - cached.timestamp;
        if (age < CACHE_DURATION) {
          console.log('✅ Token verificado desde cache');
          return cached.userInfo;
        } else {
          // Cache expirado, eliminar
          tokenCache.delete(token);
        }
      }

      // Consultar servicio de autenticación
      console.log(`🔍 Verificando token con servicio de autenticación: ${AUTH_SERVICE_URL}/auth/me`);
      
      const response = await axios.get<UserInfo>(`${AUTH_SERVICE_URL}/auth/me`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        timeout: AUTH_SERVICE_TIMEOUT,
        validateStatus: (status) => status === 200
      });

      const userInfo = response.data;

      // Guardar en cache
      tokenCache.set(token, {
        userInfo,
        timestamp: Date.now()
      });

      console.log(`✅ Token válido para usuario: ${userInfo.correo} (${userInfo.id})`);
      return userInfo;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (axiosError.response?.status === 401) {
          console.warn('⚠️ Token inválido o expirado');
        } else if (axiosError.code === 'ECONNREFUSED') {
          console.error('❌ No se pudo conectar con el servicio de autenticación');
        } else if (axiosError.code === 'ETIMEDOUT') {
          console.error('❌ Timeout al conectar con el servicio de autenticación');
        } else {
          console.error('❌ Error al verificar token:', axiosError.message);
        }
      } else {
        console.error('❌ Error desconocido al verificar token:', error);
      }
      
      return null;
    }
  }

  /**
   * Obtiene la plantilla de usuario anónimo para sesiones sin autenticación
   * NOTA: Esto NO es un dummy - se usa en producción para usuarios no logueados
   * @returns UserInfo del usuario anónimo
   */
  static getAnonymousUser(): UserInfo {
    console.log('👤 Usando plantilla de usuario anónimo (sin autenticación)');
    return anonymousUserTemplate as UserInfo;
  }

  /**
   * Verifica si el modo de prueba está activado (USE_DUMMY_AUTH=true)
   * En modo prueba, no se conecta al servicio de autenticación del Grupo 4
   */
  static isTestMode(): boolean {
    return USE_DUMMY_AUTH;
  }

  /**
   * Verifica si un usuario tiene un permiso específico
   * NOTA: Grupo 4 NO expone endpoint /auth/can-access
   * Se verifica directamente desde userInfo.permisos obtenido en verifyToken
   * @param userInfo Información del usuario obtenida de verifyToken
   * @param permission Código del permiso a verificar
   * @returns true si el usuario tiene el permiso, false en caso contrario
   */
  static checkPermission(userInfo: UserInfo | null, permission: string): boolean {
    if (!userInfo || !permission) {
      return false;
    }

    const hasPermission = userInfo.permisos && userInfo.permisos.includes(permission);
    console.log(`${hasPermission ? '✅' : '❌'} Usuario ${hasPermission ? 'tiene' : 'NO tiene'} permiso: ${permission}`);
    
    return hasPermission;
  }

  /**
   * Obtiene el perfil público de un usuario
   * NOTA: Grupo 4 expone GET /api/users/{id} (requiere autenticación con token)
   * Para obtener perfil público, usar: GET /api/users/{id} con token válido
   * @param token Token JWT para autenticación
   * @param userId ID del usuario
   * @returns Información del usuario o null si no se encuentra
   */
  static async getPublicProfile(token: string, userId: string): Promise<Partial<UserInfo> | null> {
    if (!userId || userId.trim() === '' || !token) {
      return null;
    }

    try {
      console.log(`🔍 Obteniendo perfil del usuario: ${userId}`);
      
      const response = await axios.get<Partial<UserInfo>>(
        `${AUTH_SERVICE_URL}/users/${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          },
          timeout: AUTH_SERVICE_TIMEOUT,
          validateStatus: (status) => status === 200
        }
      );

      console.log(`✅ Perfil obtenido: ${response.data.correo}`);
      return response.data;

    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        
        if (axiosError.response?.status === 404) {
          console.warn(`⚠️ Usuario no encontrado: ${userId}`);
        } else if (axiosError.response?.status === 401) {
          console.warn('⚠️ Token inválido al obtener perfil');
        } else {
          console.error('❌ Error al obtener perfil:', axiosError.message);
        }
      } else {
        console.error('❌ Error desconocido al obtener perfil:', error);
      }
      
      return null;
    }
  }

  /**
   * Limpia el cache de tokens (útil para pruebas o mantenimiento)
   */
  static clearCache(): void {
    tokenCache.clear();
    console.log('🧹 Cache de tokens limpiado');
  }

  /**
   * Obtiene estadísticas del cache
   */
  static getCacheStats(): { size: number; keys: number } {
    return {
      size: tokenCache.size,
      keys: tokenCache.size
    };
  }

  /**
   * Verifica si el servicio de autenticación está disponible
   * NOTA: Grupo 4 no documenta endpoint /health, se verifica intentando validar un token dummy
   */
  static async healthCheck(): Promise<boolean> {
    try {
      // Intentar conexión al servicio base
      const response = await axios.get(`${AUTH_SERVICE_URL.replace('/api', '')}`, {
        timeout: 3000,
        validateStatus: (status) => status < 500 // Cualquier respuesta que no sea error de servidor
      });

      console.log('✅ Servicio de autenticación disponible');
      return true;

    } catch (error) {
      console.error('❌ Servicio de autenticación NO disponible');
      return false;
    }
  }
}

export default AuthService;
