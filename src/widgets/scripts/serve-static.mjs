import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const widgetOutput = resolve('out');
const portArgument = process.argv.findIndex((argument) => argument === '--port' || argument === '-p');
const inlinePort = process.argv.find((argument) => argument.startsWith('--port='));
const port = Number(
  portArgument >= 0
    ? process.argv[portArgument + 1]
    : inlinePort?.split('=')[1] || 3001,
);

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

if (!existsSync(widgetOutput)) {
  throw new Error('Widget bundle is missing. Run `npm run build` from the project root before opening NitroStudio.');
}

function findFile(pathname) {
  const relativePath = normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, '');
  const basePath = resolve(widgetOutput, relativePath);
  if (!basePath.startsWith(`${widgetOutput}/`) && basePath !== widgetOutput) {
    return undefined;
  }

  const candidates = pathname === '/'
    ? [join(widgetOutput, 'handoff-dashboard.html'), join(widgetOutput, 'index.html')]
    : [basePath, `${basePath}.html`, join(basePath, 'index.html')];

  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

const server = createServer((request, response) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  const filePath = findFile(pathname);

  if (!filePath) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Widget route not found');
    return;
  }

  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': contentTypes[extname(filePath)] || 'application/octet-stream',
  });
  createReadStream(filePath).pipe(response);
});

// Studio resolves localhost to ::1 on this Linux host. Omitting the host lets
// Node bind its dual-stack listener so both IPv4 and IPv6 widget requests work.
server.listen(port, () => {
  // NitroStudio waits for this exact readiness signal from a managed widget server.
  console.log(`Widget server started on port ${port}`);
});

function shutdown() {
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
