import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthService, UserInfo } from '../services/authService';
import SessionService from '../services/sessionService';

// Extender el tipo Request para incluir información del usuario autenticado
declare global {
    namespace Express {
        interface Request {
            userId?: string;
            userEmail?: string;
            userRole?: string;
            userName?: string;
            userRoles?: string[];
            userPermissions?: string[];
            userInfo?: UserInfo;
            sessionId?: string; // Para usuarios anónimos
            isAnonymous?: boolean; // Indica si es sesión anónima
        }
    }
}

interface JWTPayload {
    userId: string;
    email: string;
    role: string;
    iat?: number;
    exp?: number;
}

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * Genera un token JWT para un usuario
 */
export const generateToken = (userId: string, email: string, role: string = 'user'): string => {
    const payload: JWTPayload = {
        userId,
        email,
        role
    };

    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: JWT_EXPIRES_IN
    } as jwt.SignOptions);
};

/**
 * Verifica y decodifica un token JWT
 */
export const verifyToken = (token: string): JWTPayload | null => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
        return decoded;
    } catch (error) {
        console.warn('⚠️ Token inválido o expirado:', error);
        return null;
    }
};

/**
 * Middleware de autenticación JWT (Integrado con servicio de autenticación)
 * Verifica que el usuario esté autenticado - BLOQUEA si no hay token válido
 */
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        // Obtener token del header Authorization
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            res.status(401).json({
                error: 'No autorizado',
                message: 'Token de autenticación no proporcionado'
            });
            return;
        }

        // Verificar formato "Bearer <token>"
        const parts = authHeader.split(' ');

        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            res.status(401).json({
                error: 'No autorizado',
                message: 'Formato de token inválido. Use: Bearer <token>'
            });
            return;
        }

        const token = parts[1];

        // Verificar que el token no esté vacío
        if (!token || token.trim() === '') {
            res.status(401).json({
                error: 'No autorizado',
                message: 'Token vacío'
            });
            return;
        }

        // Verificar token con el servicio de autenticación
        const userInfo = await AuthService.verifyToken(token);

        if (!userInfo) {
            res.status(401).json({
                error: 'No autorizado',
                message: 'Token inválido o expirado'
            });
            return;
        }

        // Agregar información del usuario al request
        req.userId = userInfo.id;
        req.userEmail = userInfo.correo;
        req.userName = `${userInfo.nombre} ${userInfo.apellido}`;
        req.userRoles = userInfo.roles;
        req.userPermissions = userInfo.permisos;
        req.userInfo = userInfo;

        // Mantener compatibilidad con código anterior
        req.userRole = userInfo.roles && userInfo.roles.length > 0 ? userInfo.roles[0] : undefined;

        console.log(`✅ Usuario autenticado (strict): ${userInfo.correo} (${userInfo.id})`);
        next();
    } catch (error) {
        console.error('❌ Error en autenticación:', error);
        res.status(500).json({
            error: 'Error de autenticación',
            message: 'Ha ocurrido un error al verificar la autenticación'
        });
    }
};

/**
 * Middleware de autenticación opcional (Integrado con servicio de autenticación)
 * Si hay token, lo verifica con el servicio de autenticación, pero no bloquea si no hay token
 * Si no hay token, crea o recupera una sesión anónima
 */
export const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const authHeader = req.headers.authorization;
        const sessionIdHeader = req.headers['x-session-id'] as string;

        // CASO 1: Hay token de autenticación
        if (authHeader) {
            const parts = authHeader.split(' ');

            if (parts.length !== 2 || parts[0] !== 'Bearer') {
                console.warn('⚠️ Formato de token incorrecto, continuando sin autenticación');
                await handleAnonymousSession(req, sessionIdHeader);
                next();
                return;
            }

            const token = parts[1];

            // Verificar token con el servicio de autenticación
            const userInfo = await AuthService.verifyToken(token);

            if (userInfo) {
                // Token válido, agregar información del usuario al request
                req.userId = userInfo.id;
                req.userEmail = userInfo.correo;
                req.userName = `${userInfo.nombre} ${userInfo.apellido}`;
                req.userRoles = userInfo.roles;
                req.userPermissions = userInfo.permisos;
                req.userInfo = userInfo;
                req.userRole = userInfo.roles && userInfo.roles.length > 0 ? userInfo.roles[0] : undefined;
                req.isAnonymous = false;

                console.log(`✅ Usuario autenticado: ${userInfo.correo} (${userInfo.id})`);
            } else {
                console.warn('⚠️ Token inválido, usando sesión anónima');
                await handleAnonymousSession(req, sessionIdHeader);
            }

            next();
            return;
        }

        // CASO 2: No hay token, manejar como sesión anónima
        await handleAnonymousSession(req, sessionIdHeader);
        next();
    } catch (error) {
        console.error('❌ Error en autenticación opcional:', error);
        next(); // Continuar incluso si hay error
    }
};

/**
 * Función auxiliar para manejar sesiones anónimas
 */
async function handleAnonymousSession(req: Request, sessionIdHeader?: string): Promise<void> {
    // Obtener usuario anónimo
    const anonymousUser = AuthService.getAnonymousUser();

    // Obtener o crear sessionId
    let sessionId = sessionIdHeader;
    
    if (!sessionId || !SessionService.isSessionActive(sessionId)) {
        // Generar nuevo sessionId
        sessionId = SessionService.generateSessionId();
        console.log(`🆕 Nueva sesión anónima: ${sessionId}`);
    } else {
        console.log(`♻️  Sesión anónima existente: ${sessionId}`);
    }

    // Registrar/actualizar sesión
    SessionService.registerSession(sessionId);

    // Configurar request con información anónima
    req.sessionId = sessionId;
    req.userId = SessionService.getAnonymousUserId(sessionId); // "anonymous_session_xxx"
    req.userEmail = anonymousUser.correo;
    req.userName = `${anonymousUser.nombre} ${anonymousUser.apellido}`;
    req.userRoles = anonymousUser.roles;
    req.userPermissions = anonymousUser.permisos;
    req.userInfo = anonymousUser;
    req.userRole = anonymousUser.roles[0];
    req.isAnonymous = true;

    // Enviar sessionId en la respuesta para que el cliente lo guarde
    if (req.res) {
        req.res.setHeader('X-Session-Id', sessionId);
    }
}


/**
 * Middleware para verificar que el usuario tiene un rol específico
 */
export const requireRole = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.userRoles || req.userRoles.length === 0) {
            res.status(401).json({
                error: 'No autorizado',
                message: 'Debe estar autenticado para acceder a este recurso'
            });
            return;
        }

        // Verificar si el usuario tiene al menos uno de los roles permitidos
        const hasRole = req.userRoles.some(role => allowedRoles.includes(role));

        if (!hasRole) {
            console.warn(`⚠️ Acceso denegado: Usuario con roles [${req.userRoles.join(', ')}] intentó acceder a recurso que requiere [${allowedRoles.join(', ')}]`);
            res.status(403).json({
                error: 'Acceso denegado',
                message: 'No tiene permisos para acceder a este recurso',
                requiredRoles: allowedRoles,
                userRoles: req.userRoles
            });
            return;
        }

        next();
    };
};

/**
 * Middleware para verificar que el usuario solo accede a sus propios recursos
 */
export const requireOwnership = (userIdParam: string = 'userId') => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const requestedUserId = req.params[userIdParam] || req.query[userIdParam];

        if (!req.userId) {
            res.status(401).json({
                error: 'No autorizado',
                message: 'Debe estar autenticado'
            });
            return;
        }

        if (req.userId !== requestedUserId && req.userRole !== 'admin') {
            console.warn(`⚠️ Intento de acceso no autorizado: Usuario ${req.userId} intentó acceder a recursos de ${requestedUserId}`);
            res.status(403).json({
                error: 'Acceso denegado',
                message: 'No tiene permisos para acceder a este recurso'
            });
            return;
        }

        next();
    };
};

/**
 * Middleware para verificar que el usuario tiene un permiso específico
 */
export const requirePermission = (requiredPermissions: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.userPermissions || req.userPermissions.length === 0) {
            res.status(401).json({
                error: 'No autorizado',
                message: 'Debe estar autenticado para acceder a este recurso'
            });
            return;
        }

        // Verificar si el usuario tiene al menos uno de los permisos requeridos
        const hasPermission = req.userPermissions.some(permission => 
            requiredPermissions.includes(permission)
        );

        if (!hasPermission) {
            console.warn(`⚠️ Acceso denegado: Usuario con permisos [${req.userPermissions.join(', ')}] intentó acceder a recurso que requiere [${requiredPermissions.join(', ')}]`);
            res.status(403).json({
                error: 'Acceso denegado',
                message: 'No tiene los permisos necesarios para acceder a este recurso',
                requiredPermissions: requiredPermissions,
                userPermissions: req.userPermissions
            });
            return;
        }

        next();
    };
};

export default {
    generateToken,
    verifyToken,
    authenticate,
    optionalAuthenticate,
    requireRole,
    requireOwnership,
    requirePermission
};