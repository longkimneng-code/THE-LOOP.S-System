const http = require('http');
const net = require('net');
const url = require('url');
const crypto = require('crypto');
const { applySecurityHeaders, checkRateLimit } = require('../shared/security/middleware');

const PORT = process.env.GATEWAY_PORT || 5000;

const SERVICES = {
  STOCK: { host: 'localhost', port: 3000 },
  FINANCE: { host: 'localhost', port: 3001 },
  POS: { host: 'localhost', port: 3002 },
  FRONTEND: { host: 'localhost', port: 5175 }
};

// Forward HTTP request to target service
function proxyRequest(req, res, target, targetPath) {
  const parsedUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const reqId = res.getHeader('X-Request-Id') || req.headers['x-request-id'] || `req_${crypto.randomUUID()}`;
  const options = {
    hostname: target.host,
    port: target.port,
    path: targetPath || (parsedUrl.pathname + parsedUrl.search),
    method: req.method,
    headers: {
      ...req.headers,
      host: `${target.host}:${target.port}`,
      'x-forwarded-for': req.socket.remoteAddress,
      'x-forwarded-proto': 'http',
      'x-gateway': 'TheLoops-Unified-Gateway/2.0',
      'x-request-id': reqId
    }
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  proxyReq.on('error', (err) => {
    console.error(`[Gateway Proxy Error] Target: ${target.host}:${target.port}${options.path}`, err.message);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: false,
        error: `Bad Gateway: Target service at port ${target.port} is currently unreachable.`,
        servicePort: target.port,
        message: err.message
      }));
    }
  });

  req.pipe(proxyReq, { end: true });
}

// Health check aggregator across Stock (3000), Finance (3001), POS (3002)
async function checkServiceHealth(target) {
  return new Promise((resolve) => {
    const req = http.get({
      hostname: target.host,
      port: target.port,
      path: '/api/health',
      timeout: 1500
    }, (res) => {
      resolve({ online: res.statusCode === 200, status: res.statusCode });
    });
    req.on('error', () => resolve({ online: false, status: 0 }));
    req.on('timeout', () => { req.destroy(); resolve({ online: false, status: 'TIMEOUT' }); });
  });
}

const server = http.createServer(async (req, res) => {
  const reqId = req.headers['x-request-id'] || `req_${crypto.randomUUID()}`;
  res.setHeader('X-Request-Id', reqId);
  applySecurityHeaders(res);

  // CORS Headers for API calls
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key, x-organization-id, x-business-id, x-session-token, x-request-id');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const pathname = parsedUrl.pathname;

  // Rate limiting on sensitive auth endpoints
  if (pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/auth/register')) {
    if (!checkRateLimit(req, res, 40, 60000)) return;
  }

  // 1. Aggregated Ecosystem Health Check
  if (pathname === '/health' || pathname === '/api/health') {
    const [stockHealth, financeHealth, posHealth] = await Promise.all([
      checkServiceHealth(SERVICES.STOCK),
      checkServiceHealth(SERVICES.FINANCE),
      checkServiceHealth(SERVICES.POS)
    ]);

    const isHealthy = stockHealth.online && financeHealth.online && posHealth.online;
    res.writeHead(isHealthy ? 200 : 207, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: isHealthy ? 'HEALTHY' : 'DEGRADED',
      gateway: { port: PORT, uptime: process.uptime() },
      services: {
        pos: { port: 3002, ...posHealth },
        stock: { port: 3000, ...stockHealth },
        finance: { port: 3001, ...financeHealth }
      },
      timestamp: new Date().toISOString()
    }, null, 2));
    return;
  }

  // 2. Route Stock Management API (/api/stock/*) -> Port 3000
  if (pathname.startsWith('/api/stock/')) {
    return proxyRequest(req, res, SERVICES.STOCK);
  }

  // 3. Route Finance & Account System API (/api/finance/*) -> Port 3001
  if (pathname.startsWith('/api/finance/')) {
    return proxyRequest(req, res, SERVICES.FINANCE);
  }

  // 4. Route POS API (/api/pos/*, /api/auth/*, /api/orders/*, /api/shifts/*, /api/catalog/*, /api/devices/*, /api/users/*, /api/stores/*, etc.) -> Port 3002
  if (
    pathname.startsWith('/api/pos/') ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/api/orders') ||
    pathname.startsWith('/api/shifts') ||
    pathname.startsWith('/api/catalog') ||
    pathname.startsWith('/api/devices') ||
    pathname.startsWith('/api/users') ||
    pathname.startsWith('/api/stores') ||
    pathname.startsWith('/api/roles') ||
    pathname.startsWith('/api/audit') ||
    pathname.startsWith('/api/currency') ||
    pathname.startsWith('/api/cashiers') ||
    pathname.startsWith('/api/petty-cash') ||
    pathname.startsWith('/api/inventory') ||
    pathname.startsWith('/api/dashboard')
  ) {
    return proxyRequest(req, res, SERVICES.POS);
  }

  // Direct fallback API paths
  if (pathname.startsWith('/api/products') || pathname.startsWith('/api/categories') || pathname.startsWith('/api/sync')) {
    return proxyRequest(req, res, SERVICES.STOCK);
  }
  if (pathname.startsWith('/api/purchases') || pathname.startsWith('/api/suppliers') || pathname.startsWith('/api/reports')) {
    return proxyRequest(req, res, SERVICES.FINANCE);
  }

  // 5. Route all web assets and frontend pages -> Unified Frontend on Port 5175
  return proxyRequest(req, res, SERVICES.FRONTEND);
});

// Proxy WebSocket connections (e.g. Vite HMR hot reloading) to Frontend
server.on('upgrade', (req, socket, head) => {
  const target = SERVICES.FRONTEND;
  const proxySocket = net.connect(target.port, target.host, () => {
    proxySocket.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`);
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      proxySocket.write(`${req.rawHeaders[i]}: ${req.rawHeaders[i + 1]}\r\n`);
    }
    proxySocket.write('\r\n');
    if (head && head.length) proxySocket.write(head);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxySocket.on('error', (err) => {
    socket.destroy();
  });
  socket.on('error', (err) => {
    proxySocket.destroy();
  });
});

server.listen(PORT, () => {
  console.log(`[The Loops] Unified API Gateway & Reverse Proxy running on http://localhost:${PORT}`);
  console.log(`- Unified Platform Web URL: http://localhost:${PORT}`);
  console.log(`- Ecosystem Health Endpoint: http://localhost:${PORT}/api/health`);
  console.log(`- Microservices: Stock (3000) | Finance (3001) | POS (3002) | Frontend (5175)`);
});
