import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import hpp from 'hpp';
import { xss } from 'express-xss-sanitizer';
import path from 'path';
import searchRoutes from './routes/searchRoutes';
import categoriesRoutes from './routes/categoriesRoutes';
import imageRoutes from './routes/imageRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import { optionalAuthenticate } from './middleware/auth';
import connectDB from './services/db';
import { ImageService } from './services/imageService';
import { sanitizeInputs } from './middleware/sanitize';
import { logAccess, detectSuspiciousActivity } from './middleware/securityLogger';
import { globalLimiter } from './middleware/rateLimit';
import { AuthService } from './services/authService';
import { startSessionCleanupJob } from './services/sessionService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5610;

// ============================================
// CONECTAR A MONGODB
// ============================================
connectDB();

// ============================================
// INICIAR JOB DE LIMPIEZA DE SESIONES
// ============================================
startSessionCleanupJob();

// ============================================
// INICIALIZAR SERVICIO DE IMÁGENES
// ============================================
ImageService.initialize();
setTimeout(() => {
  ImageService.pregenerateCategories()
    .then(() => console.log('✅ Imágenes de categorías optimizadas'))
    .catch(err => console.error('❌ Error al pregenerar imágenes:', err));
}, 2000);

// ============================================
// CONFIGURACIÓN DE SEGURIDAD HELMET
// ============================================
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: {
    action: 'deny'
  },
  noSniff: true,
  xssFilter: true
}));

// ============================================
// PROTECCIÓN HTTP PARAMETER POLLUTION
// ============================================
app.use(hpp());

// ============================================
// PROTECCIÓN XSS
// ============================================
app.use(xss());

// ============================================
// CONFIGURACIÓN DE PROXY
// ============================================
app.set('trust proxy', 1);

// ============================================
// CONFIGURACIÓN DE CORS
// ============================================
const allowedOrigins = process.env.FRONTEND_ORIGIN
  ? process.env.FRONTEND_ORIGIN.split(',')
  : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:5620'];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      callback(null, true);
    } else {
      console.warn(`⚠️ Origen bloqueado por CORS: ${origin}`);
      callback(new Error('No permitido por CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type']
}));

// ============================================
// PARSING DE BODY (CON LÍMITE DE SEGURIDAD)
// ============================================
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// ============================================
// RATE LIMITING GLOBAL
// ============================================
// Aplicar solo a rutas de API específicas (no a /health ni /)
app.use('/api/search', globalLimiter);
app.use('/api/categories', globalLimiter);
app.use('/api/analytics', globalLimiter);

// ============================================
// LOGGING DE ACCESOS
// ============================================
app.use(logAccess);

// ============================================
// DETECCIÓN DE ACTIVIDAD SOSPECHOSA
// ============================================
app.use(detectSuspiciousActivity);

// ============================================
// SANITIZACIÓN DE INPUTS (PROTECCIÓN COMPLETA)
// ============================================
app.use(sanitizeInputs);

// ============================================
// SERVIR ARCHIVOS ESTÁTICOS
// ============================================
app.use('/images', express.static(path.join(__dirname, '../public/images')));

// ============================================
// RUTAS DE LA API
// ============================================
app.use('/api/search', optionalAuthenticate, searchRoutes);
app.use('/api/categories', optionalAuthenticate, categoriesRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/analytics', analyticsRoutes);

// ============================================
// RUTA DE HEALTH CHECK
// ============================================
app.get('/health', async (req: Request, res: Response) => {
  // Verificar estado del servicio de autenticación
  const authServiceStatus = await AuthService.healthCheck();

  res.status(200).json({
    status: 'OK',
    message: 'Microservicio de búsqueda funcionando correctamente',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    services: {
      authentication: {
        status: authServiceStatus ? 'online' : 'offline',
        url: process.env.AUTH_SERVICE_URL || 'http://localhost:3000/api'
      },
      database: {
        status: 'online',
        type: 'MongoDB'
      }
    },
    security: {
      helmet: 'enabled',
      cors: 'enabled',
      rateLimit: 'enabled',
      xssProtection: 'enabled (express-xss-sanitizer)',
      noSqlInjectionProtection: 'enabled (custom middleware)',
      hppProtection: 'enabled',
      sanitization: 'enabled',
      logging: 'enabled'
    }
  });
});

// ============================================
// RUTA RAÍZ
// ============================================
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'API de Búsqueda - Pulga Shop',
    version: '1.0.0',
    health: `http://localhost:${PORT}/health`,
    endpoints: {
      search: '/api/search',
      categories: '/api/categories',
      images: '/api/images',
      analytics: '/api/analytics'
    }
  });
});

// ============================================
// MANEJO DE RUTAS NO ENCONTRADAS (404)
// ============================================
app.use((req: Request, res: Response) => {
  console.warn(`⚠️ Ruta no encontrada: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Ruta no encontrada',
    message: `La ruta ${req.originalUrl} no existe`,
    suggestion: 'Consulta la documentación en /api-docs'
  });
});

// ============================================
// MANEJO GLOBAL DE ERRORES
// ============================================
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('❌ Error no controlado:', err);

  if (err.message === 'No permitido por CORS') {
    return res.status(403).json({
      error: 'Acceso denegado',
      message: 'Tu origen no está permitido para acceder a esta API'
    });
  }

  if (err?.name === 'BadRequestError') {
    return res.status(400).json({
      error: 'Solicitud inválida',
      message: err.message
    });
  }

  return res.status(500).json({
    error: 'Error interno del servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Ha ocurrido un error inesperado',
    timestamp: new Date().toISOString()
  });
});

// ============================================
// MANEJO DE FALLAS NO ATRAPADAS
// ============================================
process.on('unhandledRejection', (reason) => {
  console.error('🔴 Unhandled Rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('🔴 Uncaught Exception:', err);
  process.exit(1);
});

// ============================================
// INICIAR SERVIDOR
// ============================================
app.listen(PORT, async () => {
  console.log('🚀 ====================================');
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  console.log(`💚 Health Check: http://localhost:${PORT}/health`);
  console.log(`🔒 Seguridad activada:`);
  console.log(`   ✅ Helmet (headers seguros)`);
  console.log(`   ✅ CORS (orígenes: ${allowedOrigins.join(', ')})`);
  console.log(`   ✅ Rate Limiting (500 req/15min - Global | 30 req/min - Búsquedas | 20 req/5min - Escritura)`);
  console.log(`   ✅ XSS Protection (express-xss-sanitizer)`);
  console.log(`   ✅ NoSQL Injection Protection (custom middleware)`);
  console.log(`   ✅ HPP Protection`);
  console.log(`   ✅ Input Sanitization (custom)`);
  console.log(`   ✅ Security Logging`);
  console.log(`   ✅ JWT Authentication (integrado con servicio externo)`);
  console.log('🔐 ====================================');
  console.log(`🔐 Servicio de Autenticación (Grupo 4):`);
  console.log(`   🌐 URL: ${process.env.AUTH_SERVICE_URL || 'http://localhost:3000/api'}`);
  
  // Verificar conexión con servicio de autenticación
  const authServiceStatus = await AuthService.healthCheck();
  if (authServiceStatus) {
    console.log(`   ✅ Estado: ONLINE`);
  } else {
    console.log(`   ⚠️  Estado: OFFLINE (el servicio continuará funcionando en modo anónimo)`);
  }
  
  console.log('🔗 ====================================');
  console.log(`🔗 Servicio de Publicaciones (Grupo 2):`);
  console.log(`   🌐 URL: ${process.env.PUBLICATIONS_API_URL || process.env.PRODUCTS_API_URL || 'http://localhost:4040/api'}`);
  console.log(`   ⚠️  Estado: Usando datos dummy (productos_dummy.json)`);
  console.log(`   💡 El servicio usará API externa cuando esté disponible`);
  
  console.log('🚀 ====================================');
});

export default app;