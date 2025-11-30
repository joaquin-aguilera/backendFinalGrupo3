declare module 'hpp' {
    import { RequestHandler } from 'express';
    export interface HppOptions {
        checkBody?: boolean;
        checkQuery?: boolean;
        checkBodyOnlyForContentType?: 'urlencoded' | 'multipart';
        whitelist?: string[] | Record<string, boolean>;
    }
    const hpp: (options?: HppOptions) => RequestHandler;
    export default hpp;
}