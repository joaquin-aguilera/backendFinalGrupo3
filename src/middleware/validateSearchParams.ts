import { Request, Response, NextFunction } from 'express';
import { sanitizePlainObject, escapeRegex } from '../utils/security';

const ALLOWED_KEYS = new Set(['busqueda', 'precio', 'categoria', 'ubicacion', 'condicion', 'ordenar', 'page', 'pageSize']);
const RANGOS_PRECIO = new Set([
  'hasta 5000',
  'entre 5000 - 10000',
  'entre 10000 - 25000',
  'entre 25000 - 50000',
  'entre 50000 - 100000',
  'entre 100000 - 300000',
  'entre 300000 - 500000',
  'mas de 500000'
]);
const ORDENAMIENTO_VALIDOS = new Set(['precio-asc', 'precio-desc']);

export function validateSearchParams(req: Request, res: Response, next: NextFunction) {
    try {
        // 1) Bloquea llaves peligrosas ($, .) y no permitidas + anti-HPP (no arrays)
        const cleaned = sanitizePlainObject(req.query);
        for (const key of Object.keys(cleaned)) {
            if (!ALLOWED_KEYS.has(key)) {
                return res.status(400).json({ error: `Parámetro no permitido: ${key}` });
            }
            if (Array.isArray((cleaned as any)[key])) {
                return res.status(400).json({ error: `Parámetro duplicado no permitido: ${key}` });
            }
        }

        // 2) Tipos y tamaños
        const busquedaRaw = cleaned.busqueda;
        const precioRaw = cleaned.precio;
        const categoriaRaw = cleaned.categoria;
        const ubicacionRaw = cleaned.ubicacion;
        const condicionRaw = cleaned.condicion;
        const ordenarRaw = cleaned.ordenar;

        if (busquedaRaw !== undefined && typeof busquedaRaw !== 'string') {
            return res.status(400).json({ error: 'busqueda debe ser string' });
        }
        if (categoriaRaw !== undefined && typeof categoriaRaw !== 'string') {
            return res.status(400).json({ error: 'categoria debe ser string' });
        }
        if (ubicacionRaw !== undefined && typeof ubicacionRaw !== 'string') {
            return res.status(400).json({ error: 'ubicacion debe ser string' });
        }
        if (condicionRaw !== undefined && typeof condicionRaw !== 'string') {
            return res.status(400).json({ error: 'condicion debe ser string' });
        }
        if (precioRaw !== undefined && typeof precioRaw !== 'string') {
            return res.status(400).json({ error: 'precio debe ser string' });
        }
        if (ordenarRaw !== undefined && typeof ordenarRaw !== 'string') {
            return res.status(400).json({ error: 'ordenar debe ser string' });
        }

        const busqueda = typeof busquedaRaw === 'string' ? busquedaRaw.trim() : undefined;
        const categoria = typeof categoriaRaw === 'string' ? categoriaRaw.trim() : undefined;
        const ubicacion = typeof ubicacionRaw === 'string' ? ubicacionRaw.trim() : undefined;
        const condicion = typeof condicionRaw === 'string' ? condicionRaw.trim() : undefined;
        const precio = typeof precioRaw === 'string' ? precioRaw.trim() : undefined;
        const ordenar = typeof ordenarRaw === 'string' ? ordenarRaw.trim() : undefined;

        if (busqueda && busqueda.length > 100) return res.status(400).json({ error: 'busqueda demasiado larga' });
        if (categoria && categoria.length > 50) return res.status(400).json({ error: 'categoria demasiado larga' });
        if (ubicacion && ubicacion.length > 50) return res.status(400).json({ error: 'ubicacion demasiado larga' });
        if (condicion && condicion.length > 20) return res.status(400).json({ error: 'condicion demasiado larga' });
        if (precio && !RANGOS_PRECIO.has(precio)) {
            return res.status(400).json({
                error: 'precio inválido (use: "hasta 50000", "entre 50000 - 100000", "entre 100000 - 300000", "entre 300000 - 500000", "mas de 500000")',
            });
        }
        if (ordenar && !ORDENAMIENTO_VALIDOS.has(ordenar)) {
            return res.status(400).json({
                error: 'ordenar inválido (use: "precio-asc" o "precio-desc")',
            });
        }

        // 3) Preparar valores seguros (escape regex)
        const safe_busqueda = busqueda ? escapeRegex(busqueda) : undefined;
        const safe_categoria = categoria ? escapeRegex(categoria) : undefined;
        const safe_ubicacion = ubicacion ? escapeRegex(ubicacion) : undefined;
        const safe_condicion = condicion ? escapeRegex(condicion) : undefined;

        // Validar page y pageSize
        const pageRaw = cleaned.page;
        const pageSizeRaw = cleaned.pageSize;
        
        let page = 1;
        let pageSize = 20;
        
        if (pageRaw !== undefined) {
            const parsed = parseInt(pageRaw as string, 10);
            if (isNaN(parsed) || parsed < 1) {
                return res.status(400).json({ error: 'page debe ser un número entero positivo' });
            }
            page = parsed;
        }
        
        if (pageSizeRaw !== undefined) {
            const parsed = parseInt(pageSizeRaw as string, 10);
            if (isNaN(parsed) || parsed < 1 || parsed > 100) {
                return res.status(400).json({ error: 'pageSize debe ser un número entre 1 y 100' });
            }
            pageSize = parsed;
        }

        // 4) Guardar query saneada para el controller
        (req as any).searchQuery = {
            busqueda: safe_busqueda,
            precio,
            categoria: safe_categoria,
            ubicacion: safe_ubicacion,
            condicion: safe_condicion,
            ordenar,
            page,
            pageSize,
        };

        return next();
    } catch (err) {
        console.error('validateSearchParams error:', err);
        return res.status(400).json({ error: 'Parámetros inválidos' });
    }
}   