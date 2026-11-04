/**
 * The Loops Universal Retail Suite — Root Process Orchestrator & Supervisor
 * Starts all microservices, outbox event worker, and unified frontend with a single command: npm run dev
 */

const { spawn } = require('child_process');
const path = require('path');

const SERVICES = [
  {
    name: 'Stock API',
    port: 3000,
    command: 'node',
    args: ['--no-warnings', 'Stock_management_loops/backend/src/server.js'],
    color: '\x1b[36m' // Cyan
  },
  {
    name: 'Finance API',
    port: 3001,
    command: 'node',
    args: ['--no-warnings', 'account_system_Loops/backend/src/server.js'],
    color: '\x1b[35m' // Magenta
  },
  {
    name: 'POS API',
    port: 3002,
    command: 'node',
    args: ['--no-warnings', 'The_Loop.s_POS/backend/src/server.js'],
    color: '\x1b[33m' // Yellow
  },
  {
    name: 'Outbox Worker',
    port: 'BUS',
    command: 'node',
    args: ['--no-warnings', 'shared/database/outboxWorker.js'],
    color: '\x1b[36m' // Cyan
  },
  {
    name: 'Gateway',
    port: 5000,
    command: 'node',
    args: ['--no-warnings', 'gateway/server.js'],
    color: '\x1b[32m' // Green
  },
  {
    name: 'Unified Web',
    port: 5175,
    command: process.platform === 'win32' ? 'npm.cmd' : 'npm',
    args: ['--prefix', 'The_Loop.s_POS/frontend', 'run', 'dev', '--', '--port', '5175'],
    color: '\x1b[34m' // Blue
  }
];

const children = new Map();
let isShuttingDown = false;

console.log('\x1b[1m\x1b[33m%s\x1b[0m', '=====================================================');
console.log('\x1b[1m\x1b[33m%s\x1b[0m', '  THE LOOPS — UNIVERSAL RETAIL ECOSYSTEM (v2.0)');
console.log('\x1b[1m\x1b[33m%s\x1b[0m', '  Orchestrating microservices, outbox worker & web...');
console.log('\x1b[1m\x1b[33m%s\x1b[0m', '=====================================================\n');

function startService(service) {
  if (isShuttingDown) return;

  const child = spawn(service.command, service.args, {
    cwd: __dirname,
    shell: true,
    env: { ...process.env, FORCE_COLOR: '1' }
  });

  const prefix = `${service.color}[${service.name} :${service.port}]\x1b[0m `;
  children.set(service.name, child);

  child.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) console.log(`${prefix}${line}`);
    });
  });

  child.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach(line => {
      if (line.trim()) console.error(`${prefix}\x1b[31m${line}\x1b[0m`);
    });
  });

  child.on('close', (code) => {
    children.delete(service.name);
    console.log(`${prefix}Process exited with code ${code}`);

    // Automatic crash recovery supervisor loop
    if (!isShuttingDown && code !== 0) {
      console.log(`${prefix}\x1b[33mUnexpected exit. Restarting service in 1.5s...\x1b[0m`);
      setTimeout(() => startService(service), 1500);
    }
  });
}

SERVICES.forEach(service => startService(service));

function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\n\x1b[33m[The Loops] Gracefully stopping all services...\x1b[0m');

  children.forEach((child) => {
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', child.pid, '/f', '/t']);
      } else {
        child.kill('SIGTERM');
      }
    } catch (e) {}
  });

  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
