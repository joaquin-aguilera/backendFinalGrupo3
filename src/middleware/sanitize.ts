import { Request, Response, NextFunction } from 'express';
import validator from 'validator';

/**
 * Middleware de sanitización avanzada para prevenir XSS y NoSQL injection
 */

// Lista blanca de caracteres permitidos en búsquedas
const SEARCH_ALLOWED_CHARS = /^[a-zA-Z0-9\sáéíóúÁÉÍÓÚñÑüÜ.,\-_()]+$/;

// Patrones peligrosos de NoSQL injection
const NOSQL_INJECTION_PATTERNS = [
    /\$where/gi,
    /\$ne/gi,
    /\$gt/gi,
    /\$lt/gi,
    /\$or/gi,
    /\$and/gi,
    /\$regex/gi,
    /\$exists/gi,
    /javascript:/gi,
    /<script/gi,
    /eval\(/gi,
    /function\(/gi
];

/**
 * Sanitiza un string eliminando caracteres peligrosos
 */
function sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') return '';

    // Eliminar espacios extras
    let sanitized = input.trim();

    // Escapar HTML para prevenir XSS
    sanitized = validator.escape(sanitized);

    // Limitar longitud (máximo 200 caracteres)
    sanitized = sanitized.substring(0, 200);

    return sanitized;
}

/**
 * Verifica si un string contiene patrones de NoSQL injection
 */
function containsNoSQLInjection(input: string): boolean {
    return NOSQL_INJECTION_PATTERNS.some(pattern => pattern.test(input));
}

/**
 * Verifica si un string contiene solo caracteres permitidos
 */
function hasValidCharacters(input: string): boolean {
    return SEARCH_ALLOWED_CHARS.test(input);
}

/**
 * Middleware principal de sanitización
 */
export const sanitizeInputs = (req: Request, res: Response, next: NextFunction): void => {
    try {
        // Sanitizar query parameters
        if (req.query) {
            Object.keys(req.query).forEach(key => {
                const value = req.query[key];

                if (typeof value === 'string') {
                    // Verificar NoSQL injection
                    if (containsNoSQLInjection(value)) {
                        console.warn(`⚠️ Intento de NoSQL injection detectado en query.${key}: ${value}`);
                        res.status(400).json({
                            error: 'Parámetro inválido detectado',
                            message: 'La búsqueda contiene caracteres no permitidos'
                        });
                        return;
                    }

                    // Sanitizar el valor
                    req.query[key] = sanitizeString(value);
                }
            });
        }

        // Sanitizar body
        if (req.body) {
            Object.keys(req.body).forEach(key => {
                const value = req.body[key];

                if (typeof value === 'string') {
                    // Verificar NoSQL injection
                    if (containsNoSQLInjection(value)) {
                        console.warn(`⚠️ Intento de NoSQL injection detectado en body.${key}: ${value}`);
                        res.status(400).json({
                            error: 'Datos inválidos detectados',
                            message: 'Los datos enviados contienen caracteres no permitidos'
                        });
                        return;
                    }

                    // Sanitizar el valor
                    req.body[key] = sanitizeString(value);
                }
            });
        }

        // Sanitizar params
        if (req.params) {
            Object.keys(req.params).forEach(key => {
                const value = req.params[key];

                if (typeof value === 'string') {
                    // Verificar NoSQL injection
                    if (containsNoSQLInjection(value)) {
                        console.warn(`⚠️ Intento de NoSQL injection detectado en params.${key}: ${value}`);
                        res.status(400).json({
                            error: 'Parámetro inválido detectado',
                            message: 'El parámetro contiene caracteres no permitidos'
                        });
                        return;
                    }

                    // Sanitizar el valor
                    req.params[key] = sanitizeString(value);
                }
            });
        }

        next();
    } catch (error) {
        console.error('❌ Error en sanitización:', error);
        res.status(500).json({
            error: 'Error al procesar la solicitud',
            message: 'Ha ocurrido un error interno'
        });
    }
};

/**
 * Middleware específico para validar búsquedas de texto
 */
export const validateSearchText = (req: Request, res: Response, next: NextFunction): void => {
    const searchText = req.query.busqueda as string || req.query.q as string || req.query.texto as string;

    if (searchText) {
        // Verificar longitud mínima
        if (searchText.length < 2) {
            res.status(400).json({
                error: 'Búsqueda muy corta',
                message: 'La búsqueda debe tener al menos 2 caracteres'
            });
            return;
        }

        // Verificar longitud máxima
        if (searchText.length > 100) {
            res.status(400).json({
                error: 'Búsqueda muy larga',
                message: 'La búsqueda no puede superar los 100 caracteres'
            });
            return;
        }

        // Verificar caracteres válidos
        if (!hasValidCharacters(searchText)) {
            res.status(400).json({
                error: 'Caracteres no permitidos',
                message: 'La búsqueda contiene caracteres no permitidos. Use solo letras, números y espacios.'
            });
            return;
        }
    }

    next();
};

/**
 * Middleware para validar números (precios, IDs, etc.)
 */
export const validateNumericParams = (req: Request, res: Response, next: NextFunction): void => {
    const numericParams = ['precio_min', 'precio_max', 'limit', 'page', 'limite'];

    for (const param of numericParams) {
        const value = req.query[param] as string;

        if (value !== undefined) {
            // Verificar que sea un número válido
            if (!validator.isNumeric(value)) {
                res.status(400).json({
                    error: 'Parámetro inválido',
                    message: `El parámetro '${param}' debe ser un número válido`
                });
                return;
            }

            // Convertir a número
            const numValue = parseFloat(value);

            // Verificar que sea positivo
            if (numValue < 0) {
                res.status(400).json({
                    error: 'Parámetro inválido',
                    message: `El parámetro '${param}' debe ser un número positivo`
                });
                return;
            }

            // Verificar límites razonables
            if ((param === 'limit' || param === 'limite') && numValue > 10000) {
                res.status(400).json({
                    error: 'Límite excedido',
                    message: 'El límite máximo de resultados es 10000'
                });
                return;
            }
        }
    }

    next();
};

/**
 * Middleware para validar nombre de categoría en URL params
 */
export const validateCategoryName = (req: Request, res: Response, next: NextFunction): void => {
    const { category } = req.params;

    if (!category) {
        res.status(400).json({
            error: 'Categoría no especificada',
            message: 'Debes proporcionar una categoría válida'
        });
        return;
    }

    // Sanitizar categoría
    const sanitizedCategory = sanitizeString(category);

    // Validar longitud
    if (sanitizedCategory.length > 50) {
        res.status(400).json({
            error: 'Categoría inválida',
            message: 'El nombre de la categoría es demasiado largo'
        });
        return;
    }

    // Validar caracteres permitidos para categorías
    const categoryRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ0-9\s\-_]+$/;
    if (!categoryRegex.test(sanitizedCategory)) {
        res.status(400).json({
            error: 'Categoría inválida',
            message: 'El nombre de la categoría contiene caracteres no permitidos'
        });
        return;
    }

    // Reemplazar el parámetro con la versión sanitizada
    req.params.category = sanitizedCategory;

    next();
};

export default {
    sanitizeInputs,
    validateSearchText,
    validateNumericParams,
    validateCategoryName
};