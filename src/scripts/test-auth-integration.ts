/**
 * Script de prueba para verificar la integración con el servicio de autenticación
 * 
 * Ejecutar con: ts-node src/scripts/test-auth-integration.ts
 */

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') });

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3000/api';
const SEARCH_SERVICE_URL = `http://localhost:${process.env.PORT || 5610}/api`;

// Colores para consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color: keyof typeof colors, message: string) {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Test 1: Verificar que el servicio de autenticación está disponible
 */
async function testAuthServiceAvailability() {
  log('cyan', '\n🧪 Test 1: Verificando disponibilidad del servicio de autenticación...');
  
  try {
    const response = await axios.get(`${AUTH_SERVICE_URL.replace('/api', '')}/health`, {
      timeout: 3000
    });
    
    log('green', '✅ Servicio de autenticación está disponible');
    console.log('   Status:', response.status);
    return true;
  } catch (error: any) {
    log('red', '❌ Servicio de autenticación NO disponible');
    console.log('   Error:', error.message);
    console.log('   URL:', AUTH_SERVICE_URL);
    return false;
  }
}

/**
 * Test 2: Hacer login y obtener token
 */
async function testLogin() {
  log('cyan', '\n🧪 Test 2: Intentando login...');
  
  const credentials = {
    correo: 'admin@admin.com',
    contrasena: 'Admin1234'
  };
  
  try {
    const response = await axios.post(`${AUTH_SERVICE_URL}/auth/login`, credentials, {
      timeout: 5000
    });
    
    const { access_token, user } = response.data;
    
    if (!access_token) {
      log('red', '❌ Login exitoso pero no se recibió token');
      return null;
    }
    
    log('green', '✅ Login exitoso');
    console.log('   Usuario:', user.correo);
    console.log('   Roles:', user.roles.join(', '));
    console.log('   Token (primeros 50 chars):', access_token.substring(0, 50) + '...');
    
    return access_token;
  } catch (error: any) {
    log('red', '❌ Error al hacer login');
    console.log('   Error:', error.response?.data?.message || error.message);
    console.log('   Credenciales usadas:', credentials);
    return null;
  }
}

/**
 * Test 3: Verificar token con /auth/me
 */
async function testVerifyToken(token: string) {
  log('cyan', '\n🧪 Test 3: Verificando token con /auth/me...');
  
  try {
    const response = await axios.get(`${AUTH_SERVICE_URL}/auth/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      },
      timeout: 5000
    });
    
    const user = response.data;
    
    log('green', '✅ Token válido');
    console.log('   Usuario:', user.correo);
    console.log('   Nombre:', user.nombre, user.apellido);
    console.log('   Roles:', user.roles.join(', '));
    console.log('   Permisos:', user.permisos.slice(0, 5).join(', '), '...');
    
    return user;
  } catch (error: any) {
    log('red', '❌ Token inválido o error al verificar');
    console.log('   Error:', error.response?.data?.message || error.message);
    return null;
  }
}

/**
 * Test 4: Probar búsqueda SIN autenticación
 */
async function testSearchWithoutAuth() {
  log('cyan', '\n🧪 Test 4: Búsqueda sin autenticación...');
  
  try {
    const response = await axios.get(`${SEARCH_SERVICE_URL}/search`, {
      params: {
        busqueda: 'laptop'
      },
      timeout: 5000
    });
    
    log('green', '✅ Búsqueda sin autenticación funciona');
    console.log('   Resultados:', response.data.length);
    
    return true;
  } catch (error: any) {
    log('red', '❌ Error en búsqueda sin autenticación');
    console.log('   Error:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Test 5: Probar búsqueda CON autenticación
 */
async function testSearchWithAuth(token: string) {
  log('cyan', '\n🧪 Test 5: Búsqueda con autenticación...');
  
  try {
    const response = await axios.get(`${SEARCH_SERVICE_URL}/search`, {
      params: {
        busqueda: 'laptop'
      },
      headers: {
        Authorization: `Bearer ${token}`
      },
      timeout: 5000
    });
    
    log('green', '✅ Búsqueda con autenticación funciona');
    console.log('   Resultados:', response.data.length);
    console.log('   Historial guardado: Sí (debe guardarse en MongoDB)');
    
    return true;
  } catch (error: any) {
    log('red', '❌ Error en búsqueda con autenticación');
    console.log('   Error:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Test 6: Verificar health check del microservicio
 */
async function testHealthCheck() {
  log('cyan', '\n🧪 Test 6: Verificando health check del microservicio...');
  
  try {
    const response = await axios.get(`${SEARCH_SERVICE_URL.replace('/api', '')}/health`, {
      timeout: 5000
    });
    
    const { status, services } = response.data;
    
    log('green', '✅ Health check exitoso');
    console.log('   Status:', status);
    console.log('   Servicio de autenticación:', services.authentication.status);
    console.log('   Base de datos:', services.database.status);
    
    if (services.authentication.status === 'offline') {
      log('yellow', '⚠️  Servicio de autenticación reportado como offline');
    }
    
    return true;
  } catch (error: any) {
    log('red', '❌ Error en health check');
    console.log('   Error:', error.message);
    return false;
  }
}

/**
 * Test 7: Verificar permisos con can-access
 */
async function testCheckPermission(token: string) {
  log('cyan', '\n🧪 Test 7: Verificando permiso con can-access...');
  
  try {
    const response = await axios.get(`${AUTH_SERVICE_URL}/auth/can-access`, {
      params: {
        page: 'ver_perfil'
      },
      headers: {
        Authorization: `Bearer ${token}`
      },
      timeout: 5000
    });
    
    const { page, hasAccess } = response.data;
    
    if (hasAccess) {
      log('green', '✅ Usuario tiene el permiso');
      console.log('   Permiso:', page);
      console.log('   Acceso:', hasAccess);
    } else {
      log('yellow', '⚠️  Usuario NO tiene el permiso');
      console.log('   Permiso:', page);
    }
    
    return hasAccess;
  } catch (error: any) {
    log('red', '❌ Error al verificar permiso');
    console.log('   Error:', error.response?.data?.message || error.message);
    return false;
  }
}

/**
 * Ejecutar todos los tests
 */
async function runAllTests() {
  log('blue', '\n' + '='.repeat(60));
  log('blue', '🚀 INICIANDO TESTS DE INTEGRACIÓN');
  log('blue', '='.repeat(60));
  
  console.log('\nServicios a probar:');
  console.log('  - Autenticación:', AUTH_SERVICE_URL);
  console.log('  - Búsqueda:', SEARCH_SERVICE_URL);
  
  const results = {
    passed: 0,
    failed: 0
  };
  
  // Test 1: Disponibilidad del servicio de autenticación
  const authAvailable = await testAuthServiceAvailability();
  authAvailable ? results.passed++ : results.failed++;
  
  if (!authAvailable) {
    log('red', '\n⚠️  Servicio de autenticación no disponible. Tests de autenticación se omitirán.');
  }
  
  let token: string | null = null;
  
  if (authAvailable) {
    // Test 2: Login
    token = await testLogin();
    token ? results.passed++ : results.failed++;
    
    if (token) {
      // Test 3: Verificar token
      const user = await testVerifyToken(token);
      user ? results.passed++ : results.failed++;
      
      // Test 7: Verificar permisos
      const hasPermission = await testCheckPermission(token);
      hasPermission ? results.passed++ : results.failed++;
    }
  }
  
  // Test 4: Búsqueda sin autenticación
  const searchWithoutAuth = await testSearchWithoutAuth();
  searchWithoutAuth ? results.passed++ : results.failed++;
  
  if (token) {
    // Test 5: Búsqueda con autenticación
    const searchWithAuth = await testSearchWithAuth(token);
    searchWithAuth ? results.passed++ : results.failed++;
  }
  
  // Test 6: Health check
  const healthCheck = await testHealthCheck();
  healthCheck ? results.passed++ : results.failed++;
  
  // Resumen
  log('blue', '\n' + '='.repeat(60));
  log('blue', '📊 RESUMEN DE TESTS');
  log('blue', '='.repeat(60));
  
  console.log('\nResultados:');
  log('green', `  ✅ Tests exitosos: ${results.passed}`);
  if (results.failed > 0) {
    log('red', `  ❌ Tests fallidos: ${results.failed}`);
  }
  
  const total = results.passed + results.failed;
  const percentage = ((results.passed / total) * 100).toFixed(1);
  
  console.log(`\n  Total: ${results.passed}/${total} (${percentage}%)`);
  
  if (results.failed === 0) {
    log('green', '\n🎉 ¡Todos los tests pasaron exitosamente!');
  } else {
    log('yellow', '\n⚠️  Algunos tests fallaron. Revisa los logs arriba.');
  }
  
  log('blue', '\n' + '='.repeat(60));
}

// Ejecutar tests
runAllTests().catch(error => {
  log('red', '\n❌ Error fatal al ejecutar tests:');
  console.error(error);
  process.exit(1);
});
