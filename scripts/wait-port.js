// scripts/wait-port.js
// A simple, dependency-free port waiter for Node.js.
// Usage: node wait-port.js <port> [timeoutMs]

const net = require('net');

const port = parseInt(process.argv[2] || '5173', 10);
const timeout = parseInt(process.argv[3] || '30000', 10);
const start = Date.now();

function check() {
  if (Date.now() - start > timeout) {
    console.error(`[wait-port] Timeout waiting for port ${port}`);
    process.exit(1);
  }

  const socket = net.createConnection(port, 'localhost', () => {
    socket.end();
    process.exit(0);
  });

  socket.on('error', () => {
    setTimeout(check, 200);
  });
}

check();
