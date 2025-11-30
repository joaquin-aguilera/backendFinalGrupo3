// ============================================
// IMPLEMENTACIÓN ORIGINAL (para compatibilidad)
// ============================================
type Entry = { count: number; resetAt: number };

const windowMs = 60_000;
const maxPerWindow = 60;
const bucket = new Map<string, Entry>();

export function rateLimit(req: any, res: any, next: any) {
    const key = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = bucket.get(key);

    if (!entry || now >= entry.resetAt) {
        bucket.set(key, { count: 1, resetAt: now + windowMs });
        return next();
    }

    if (entry.count >= maxPerWindow) {
        const retry = Math.max(0, Math.ceil((entry.resetAt - now) / 1000));
        res.setHeader('Retry-After', retry.toString());
        return res.status(429).json({ error: 'Too many requests' });
    }

    entry.count += 1;
    return next();
}

// ============================================
// NUEVAS IMPLEMENTACIONES CON express-rate-limit
// ============================================
import rateLimitLib from 'express-rate-limit';
import { Request, Response } from 'express';

/**
 * Rate limiter global para todas las rutas (MÁS PERMISIVO)
 * - Permite 500 solicitudes por 15 minutos (33 req/min)
 * - Suficiente para desarrollo y uso normal
 */
export const globalLimiter = rateLimitLib({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 500, // Aumentado de 100 a 500
    message: {
        error: 'Demasiadas solicitudes',
        message: 'Has excedido el límite de solicitudes. Por favor, espera unos minutos.',
        retryAfter: '15 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        const ip = req.ip || req.socket.remoteAddress || 'Unknown';
        console.warn(`⚠️ Rate limit global excedido para IP: ${ip} en ${req.originalUrl}`);
        res.status(429).json({
            error: 'Demasiadas solicitudes',
            message: 'Has excedido el límite de solicitudes. Por favor, espera 15 minutos.',
            retryAfter: '15 minutos'
        });
    }
});

/**
 * Rate limiter estricto para búsquedas
 */
export const searchLimiter = rateLimitLib({
    windowMs: 1 * 60 * 1000,
    max: 30,
    message: {
        error: 'Demasiadas búsquedas',
        message: 'Has realizado demasiadas búsquedas. Por favor, espera un minuto.',
        retryAfter: '1 minuto'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        const ip = req.ip || req.socket.remoteAddress || 'Unknown';
        console.warn(`⚠️ Rate limit de búsqueda excedido para IP: ${ip}`);
        res.status(429).json({
            error: 'Demasiadas búsquedas',
            message: 'Has realizado demasiadas búsquedas. Por favor, espera un minuto.',
            retryAfter: '1 minuto'
        });
    }
});

/**
 * Rate limiter para endpoints de escritura
 */
export const writeLimiter = rateLimitLib({
    windowMs: 5 * 60 * 1000,
    max: 20,
    message: {
        error: 'Demasiadas operaciones de escritura',
        message: 'Has realizado demasiadas operaciones. Por favor, espera unos minutos.',
        retryAfter: '5 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        const ip = req.ip || req.socket.remoteAddress || 'Unknown';
        console.warn(`⚠️ Rate limit de escritura excedido para IP: ${ip}`);
        res.status(429).json({
            error: 'Demasiadas operaciones de escritura',
            message: 'Has realizado demasiadas operaciones. Por favor, espera unos minutos.',
            retryAfter: '5 minutos'
        });
    }
});

/**
 * Rate limiter para autenticación
 */
export const authLimiter = rateLimitLib({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        error: 'Demasiados intentos de autenticación',
        message: 'Has realizado demasiados intentos. Por favor, espera 15 minutos.',
        retryAfter: '15 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: (req: Request, res: Response) => {
        const ip = req.ip || req.socket.remoteAddress || 'Unknown';
        console.error(`🔴 Rate limit de autenticación excedido para IP: ${ip}`);
        res.status(429).json({
            error: 'Demasiados intentos de autenticación',
            message: 'Has realizado demasiados intentos. Por favor, espera 15 minutos.',
            retryAfter: '15 minutos'
        });
    }
});

/**
 * Rate limiter muy estricto para operaciones sensibles
 */
export const strictLimiter = rateLimitLib({
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: {
        error: 'Límite de operaciones excedido',
        message: 'Has excedido el límite de operaciones sensibles. Espera 1 hora.',
        retryAfter: '1 hora'
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
        const ip = req.ip || req.socket.remoteAddress || 'Unknown';
        console.error(`🔴 Rate limit estricto excedido para IP: ${ip}`);
        res.status(429).json({
            error: 'Límite de operaciones excedido',
            message: 'Has excedido el límite de operaciones sensibles. Espera 1 hora.',
            retryAfter: '1 hora'
        });
    }
});

export default {
    rateLimit, // Exportar el original también
    globalLimiter,
    searchLimiter,
    writeLimiter,
    authLimiter,
    strictLimiter
};