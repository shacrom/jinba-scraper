import http from 'node:http';
import { logger } from './logger.js';

let server: http.Server | null = null;

export function startHealthServer(port: number): void {
  server = http.createServer((req, res) => {
    const url = req.url ?? '/';

    if (url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          status: 'ok',
          uptime: process.uptime(),
          timestamp: new Date().toISOString(),
        }),
      );
      return;
    }

    if (url === '/ready') {
      // Shallow check — in prod we'd ping Redis+Supabase here
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ready' }));
      return;
    }

    res.writeHead(404);
    res.end();
  });

  server.listen(port, () => {
    logger.info({ port }, 'health server started');
  });

  server.on('error', (err) => {
    logger.error({ err }, 'health server error');
  });
}

export function stopHealthServer(): void {
  server?.close();
  server = null;
}
