declare module 'express-xss-sanitizer' {
    import { RequestHandler } from 'express';

    export interface XssOptions {
        allowedKeys?: string[];
        allowedTags?: string[];
        allowedAttributes?: Record<string, string[]>;
    }

    export function xss(options?: XssOptions): RequestHandler;
}