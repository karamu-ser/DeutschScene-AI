#!/usr/bin/env node

/**
 * 🧪 API Integration Test
 *
 * Test tous les endpoints d'authentification et vérifier la protection des routes
 *
 * Utilisation:
 *   node test-api.js
 */

const API_URL = 'http://localhost:3001/api';

// Couleurs console
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(color, msg) {
  console.log(`${color}${msg}${colors.reset}`);
}

async function test(name, fn) {
  try {
    log(colors.blue, `\n▶️  ${name}`);
    await fn();
    log(colors.green, `✅ ${name}`);
  } catch (err) {
    log(colors.red, `❌ ${name}: ${err.message}`);
    throw err;
  }
}

async function request(method, path, body = null, token = null) {
  const url = `${API_URL}${path}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (token) {
    options.headers['Authorization'] = `Bearer ${token}`;
  }

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(`${response.status}: ${data.error || JSON.stringify(data)}`);
  }

  return data;
}

async function runTests() {
  log(colors.yellow, '\n🚀 Starting API Integration Tests\n');

  let authToken = '';
  let userId = '';

  try {
    // 1. Health check
    await test('Health Check', async () => {
      const data = await request('GET', '/health');
      if (!data.status || data.status !== 'ok') {
        throw new Error('Health check failed');
      }
    });

    // 2. Register user
    await test('Register new user', async () => {
      const email = `test-${Date.now()}@example.com`;
      const data = await request('POST', '/auth/register', {
        email,
        password: 'TestPassword123',
        name: 'Test User',
      });

      if (!data.user || !data.user.id) {
        throw new Error('Registration failed - no user returned');
      }

      userId = data.user.id;
      log(colors.blue, `  → User ID: ${userId}`);
    });

    // 3. Login
    await test('Login with credentials', async () => {
      const data = await request('POST', '/auth/login', {
        email: `test-${Date.now() - 1000}@example.com`,
        password: 'TestPassword123',
      });

      if (!data.token) {
        throw new Error('Login failed - no token returned');
      }

      authToken = data.token;
      log(colors.blue, `  → Token: ${authToken.substring(0, 20)}...`);
    });

    // 4. Get user profile
    await test('Get authenticated user profile', async () => {
      const data = await request('GET', '/auth/me', null, authToken);

      if (!data.id || !data.email) {
        throw new Error('Profile fetch failed');
      }

      log(colors.blue, `  → Email: ${data.email}`);
      log(colors.blue, `  → Name: ${data.name}`);
    });

    // 5. Test route protection (should fail without token)
    await test('Test route protection (should reject without token)', async () => {
      try {
        await request('GET', '/words');
        throw new Error('Route should be protected!');
      } catch (err) {
        if (err.message.includes('401')) {
          // Expected
        } else {
          throw err;
        }
      }
    });

    // 6. Test invalid login
    await test('Test invalid login (should fail)', async () => {
      try {
        await request('POST', '/auth/login', {
          email: 'nonexistent@example.com',
          password: 'WrongPassword',
        });
        throw new Error('Should have failed');
      } catch (err) {
        if (err.message.includes('Invalid credentials')) {
          // Expected
        } else {
          throw err;
        }
      }
    });

    // 7. Test password validation
    await test('Test password validation (too short)', async () => {
      try {
        await request('POST', '/auth/register', {
          email: `test-${Date.now()}@example.com`,
          password: 'short',
          name: 'Test',
        });
        throw new Error('Should have failed validation');
      } catch (err) {
        if (err.message.includes('6 characters')) {
          // Expected
        } else {
          throw err;
        }
      }
    });

    log(colors.yellow, '\n\n✅ All tests passed!\n');
  } catch (err) {
    log(colors.red, `\n\n❌ Tests failed: ${err.message}\n`);
    process.exit(1);
  }
}

// Check if backend is running
async function checkBackend() {
  try {
    await request('GET', '/health');
  } catch (err) {
    log(colors.red, `\n❌ Backend not responding at ${API_URL}`);
    log(colors.yellow, '\nStart backend with: npm run dev (in backend/)\n');
    process.exit(1);
  }
}

(async () => {
  await checkBackend();
  await runTests();
})();
