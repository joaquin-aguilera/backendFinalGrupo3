import { randomUUID } from 'crypto';
import SearchHistory from '../models/Search';
import Click from '../models/Click';

/**
 * Información de sesión anónima
 */
interface SessionInfo {
  sessionId: string;
  createdAt: Date;
  lastActivity: Date;
}

/**
 * Cache de sesiones anónimas activas en memoria
 * Estructura: sessionId -> SessionInfo
 */
const activeSessions = new Map<string, SessionInfo>();

/**
 * Duración máxima de una sesión anónima inactiva (12 horas)
 */
const SESSION_TIMEOUT = 12 * 60 * 60 * 1000;

/**
 * Intervalo de limpieza de sesiones expiradas (cada 5 minutos)
 */
const CLEANUP_INTERVAL = 5 * 60 * 1000;

/**
 * Servicio para gestionar sesiones anónimas y su historial temporal
 */
export class SessionService {
  /**
   * Genera un nuevo ID de sesión único
   */
  static generateSessionId(): string {
    return `session_${randomUUID()}`;
  }

  /**
   * Registra o actualiza una sesión anónima
   */
  static registerSession(sessionId: string): void {
    const now = new Date();
    
    if (activeSessions.has(sessionId)) {
      // Actualizar última actividad
      const session = activeSessions.get(sessionId)!;
      session.lastActivity = now;
    } else {
      // Crear nueva sesión
      activeSessions.set(sessionId, {
        sessionId,
        createdAt: now,
        lastActivity: now,
      });
      console.log(`📝 Nueva sesión anónima creada: ${sessionId}`);
    }
  }

  /**
   * Verifica si una sesión existe y está activa
   */
  static isSessionActive(sessionId: string): boolean {
    if (!activeSessions.has(sessionId)) {
      return false;
    }

    const session = activeSessions.get(sessionId)!;
    const age = Date.now() - session.lastActivity.getTime();

    return age < SESSION_TIMEOUT;
  }

  /**
   * Obtiene información de una sesión
   */
  static getSession(sessionId: string): SessionInfo | null {
    if (!this.isSessionActive(sessionId)) {
      return null;
    }

    return activeSessions.get(sessionId) || null;
  }

  /**
   * Limpia el historial de búsqueda de una sesión anónima
   * Se ejecuta al cerrar la sesión o cuando expira
   */
  static async cleanupSessionHistory(sessionId: string): Promise<void> {
    try {
      // Eliminar búsquedas de esta sesión de search_history
      // (Usuarios anónimos tienen userId = "anonymous" + sessionId temporal en metadata)
      const deletedSearches = await SearchHistory.deleteMany({
        userId: `anonymous_${sessionId}`
      });

      // Eliminar clicks de esta sesión
      const deletedClicks = await Click.deleteMany({
        userId: `anonymous_${sessionId}`
      });

      console.log(`🗑️  Historial de sesión ${sessionId} limpiado: ${deletedSearches.deletedCount} búsquedas, ${deletedClicks.deletedCount} clicks`);

      // Remover de sesiones activas
      activeSessions.delete(sessionId);
    } catch (error) {
      console.error(`❌ Error al limpiar historial de sesión ${sessionId}:`, error);
    }
  }

  /**
   * Cierra una sesión manualmente y limpia su historial
   */
  static async closeSession(sessionId: string): Promise<void> {
    if (!sessionId) return;

    console.log(`🔒 Cerrando sesión: ${sessionId}`);
    await this.cleanupSessionHistory(sessionId);
  }

  /**
   * Limpia todas las sesiones expiradas
   * Se ejecuta periódicamente por el cleanup job
   */
  static async cleanupExpiredSessions(): Promise<void> {
    const now = Date.now();
    const expiredSessions: string[] = [];

    // Identificar sesiones expiradas
    activeSessions.forEach((session, sessionId) => {
      const age = now - session.lastActivity.getTime();
      if (age >= SESSION_TIMEOUT) {
        expiredSessions.push(sessionId);
      }
    });

    // Limpiar sesiones expiradas
    for (const sessionId of expiredSessions) {
      await this.cleanupSessionHistory(sessionId);
    }

    if (expiredSessions.length > 0) {
      console.log(`🧹 Limpieza automática: ${expiredSessions.length} sesiones expiradas eliminadas`);
    }
  }

  /**
   * Obtiene estadísticas de sesiones activas
   */
  static getStats(): { active: number; total: number } {
    return {
      active: activeSessions.size,
      total: activeSessions.size,
    };
  }

  /**
   * Obtiene el userId temporal para una sesión anónima
   */
  static getAnonymousUserId(sessionId: string): string {
    return `anonymous_${sessionId}`;
  }

  /**
   * Verifica si un userId corresponde a una sesión anónima
   */
  static isAnonymousUserId(userId: string): boolean {
    return userId.startsWith('anonymous_');
  }

  /**
   * Extrae el sessionId de un userId anónimo
   */
  static extractSessionId(userId: string): string | null {
    if (!this.isAnonymousUserId(userId)) {
      return null;
    }
    return userId.replace('anonymous_', '');
  }
}

/**
 * Iniciar job de limpieza automática de sesiones expiradas
 */
let cleanupJob: NodeJS.Timeout | null = null;

export function startSessionCleanupJob(): void {
  if (cleanupJob) {
    console.log('⚠️  Job de limpieza ya está en ejecución');
    return;
  }

  cleanupJob = setInterval(async () => {
    await SessionService.cleanupExpiredSessions();
  }, CLEANUP_INTERVAL);

  console.log('✅ Job de limpieza de sesiones iniciado (cada 5 minutos)');
}

export function stopSessionCleanupJob(): void {
  if (cleanupJob) {
    clearInterval(cleanupJob);
    cleanupJob = null;
    console.log('🛑 Job de limpieza de sesiones detenido');
  }
}

export default SessionService;
