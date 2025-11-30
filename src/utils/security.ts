// ...existing code...
export function escapeRegex(input: string) {
    return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function sanitizePlainObject<T extends Record<string, any>>(obj: T): Partial<T> {
    const clean: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj || {})) {
        if (k.includes('$') || k.includes('.')) continue;
        clean[k] = v;
    }
    return clean as Partial<T>;
}

// Limpieza profunda por si llegan objetos anidados en el futuro
export function deepSanitize<T>(value: T): T {
    if (Array.isArray(value)) return value.map((v) => deepSanitize(v)) as any;
    if (value && typeof value === 'object') {
        const out: any = {};
        for (const [k, v] of Object.entries(value as any)) {
            if (k.includes('$') || k.includes('.')) continue;
            out[k] = deepSanitize(v as any);
        }
        return out;
    }
    return value;
}