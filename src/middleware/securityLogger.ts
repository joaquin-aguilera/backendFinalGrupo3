import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';

// Directorio para logs de seguridad
const LOGS_DIR = path.join(__dirname, '../../logs');
const SECURITY_LOG_FILE = path.join(LOGS_DIR, 'security.log');
const ACCESS_LOG_FILE = path.join(LOGS_DIR, 'access.log');

// Crear directorio de logs si no existe
if (!fs.existsSync(LOGS_DIR)) {
    fs.mkdirSync(LOGS_DIR, { recursive: true });
}

interface SecurityEvent {
    timestamp: string;
    type: 'WARNING' | 'ERROR' | 'INFO' | 'CRITICAL';
    ip: string;
    userId?: string;
    endpoint: string;
    method: string;
    message: string;
    userAgent?: string;
    additionalData?: any;
}

/**
 * Escribe un evento de seguridad en el log
 */
function writeSecurityLog(event: SecurityEvent): void {
    const logEntry = `[${event.timestamp}] [${event.type}] IP: ${event.ip} | User: ${event.userId || 'N/A'} | ${event.method} ${event.endpoint} | ${event.message} | UA: ${event.userAgent || 'N/A'}\n`;

    fs.appendFile(SECURITY_LOG_FILE, logEntry, (err) => {
        if (err) {
            console.error('❌ Error al escribir log de seguridad:', err);
        }
    });

    // También imprimir en consola si es crítico
    if (event.type === 'CRITICAL' || event.type === 'ERROR') {
        console.error('🔴 EVENTO DE SEGURIDAD:', logEntry);
    } else if (event.type === 'WARNING') {
        console.warn('🟡 ADVERTENCIA DE SEGURIDAD:', logEntry);
    }
}

/**
 * Escribe un evento de acceso en el log
 */
function writeAccessLog(req: Request, res: Response, responseTime: number): void {
    const logEntry = `[${new Date().toISOString()}] ${req.ip} | ${req.userId || 'ANON'} | ${req.method} ${req.originalUrl} | Status: ${res.statusCode} | ${responseTime}ms | UA: ${req.get('user-agent') || 'N/A'}\n`;

    fs.appendFile(ACCESS_LOG_FILE, logEntry, (err) => {
        if (err) {
            console.error('❌ Error al escribir log de acceso:', err);
        }
    });
}

/**
 * Obtiene la IP real del cliente (considerando proxies)
 */
function getClientIp(req: Request): string {
    return (
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        req.headers['x-real-ip'] as string ||
        req.socket.remoteAddress ||
        'Unknown'
    );
}

/**
 * Middleware para registrar todos los accesos
 */
export const logAccess = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    // Registrar cuando la respuesta se complete
    res.on('finish', () => {
        const responseTime = Date.now() - startTime;
        writeAccessLog(req, res, responseTime);
    });

    next();
};

/**
 * Middleware para detectar y registrar intentos sospechosos
 */
export const detectSuspiciousActivity = (req: Request, res: Response, next: NextFunction): void => {
    const ip = getClientIp(req);
    const userAgent = req.get('user-agent') || 'N/A';

    // Patrones sospechosos
    const suspiciousPatterns = [
        /\.\.\//g,  // Directory traversal
        /<script/gi,  // XSS attempts
        /union.*select/gi,  // SQL injection
        /\$where/gi,  // NoSQL injection
        /eval\(/gi,  // Code injection
        /javascript:/gi,  // XSS
        /onerror=/gi,  // XSS
        /onclick=/gi,  // XSS
    ];

    // Verificar URL
    const fullUrl = req.originalUrl;
    for (const pattern of suspiciousPatterns) {
        if (pattern.test(fullUrl)) {
            writeSecurityLog({
                timestamp: new Date().toISOString(),
                type: 'WARNING',
                ip,
                userId: req.userId,
                endpoint: req.originalUrl,
                method: req.method,
                message: `Patrón sospechoso detectado en URL: ${pattern}`,
                userAgent
            });
            break;
        }
    }

    // Verificar body
    if (req.body) {
        const bodyStr = JSON.stringify(req.body);
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(bodyStr)) {
                writeSecurityLog({
                    timestamp: new Date().toISOString(),
                    type: 'WARNING',
                    ip,
                    userId: req.userId,
                    endpoint: req.originalUrl,
                    method: req.method,
                    message: `Patrón sospechoso detectado en body: ${pattern}`,
                    userAgent,
                    additionalData: { body: req.body }
                });
                break;
            }
        }
    }

    // Verificar query params
    if (req.query) {
        const queryStr = JSON.stringify(req.query);
        for (const pattern of suspiciousPatterns) {
            if (pattern.test(queryStr)) {
                writeSecurityLog({
                    timestamp: new Date().toISOString(),
                    type: 'WARNING',
                    ip,
                    userId: req.userId,
                    endpoint: req.originalUrl,
                    method: req.method,
                    message: `Patrón sospechoso detectado en query: ${pattern}`,
                    userAgent,
                    additionalData: { query: req.query }
                });
                break;
            }
        }
    }

    next();
};

/**
 * Registra un intento de acceso no autorizado
 */
export const logUnauthorizedAccess = (req: Request, endpoint: string, reason: string): void => {
    writeSecurityLog({
        timestamp: new Date().toISOString(),
        type: 'CRITICAL',
        ip: getClientIp(req),
        userId: req.userId,
        endpoint,
        method: req.method,
        message: `Intento de acceso no autorizado: ${reason}`,
        userAgent: req.get('user-agent')
    });
};

/**
 * Registra un error de validación
 */
export const logValidationError = (req: Request, field: string, value: any, reason: string): void => {
    writeSecurityLog({
        timestamp: new Date().toISOString(),
        type: 'WARNING',
        ip: getClientIp(req),
        userId: req.userId,
        endpoint: req.originalUrl,
        method: req.method,
        message: `Error de validación en campo '${field}': ${reason}`,
        userAgent: req.get('user-agent'),
        additionalData: { field, value }
    });
};

/**
 * Registra un evento de seguridad personalizado
 */
export const logSecurityEvent = (
    req: Request,
    type: 'WARNING' | 'ERROR' | 'INFO' | 'CRITICAL',
    message: string,
    additionalData?: any
): void => {
    writeSecurityLog({
        timestamp: new Date().toISOString(),
        type,
        ip: getClientIp(req),
        userId: req.userId,
        endpoint: req.originalUrl,
        method: req.method,
        message,
        userAgent: req.get('user-agent'),
        additionalData
    });
};

export default {
    logAccess,
    detectSuspiciousActivity,
    logUnauthorizedAccess,
    logValidationError,
    logSecurityEvent
};