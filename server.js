const http = require('http');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const port = process.env.PORT || 3000;

const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.ico': 'image/x-icon'
};

function safePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const resolved = path.resolve(root, '.' + (clean === '/' ? '/index.html' : clean));
  return resolved.startsWith(root + path.sep) || resolved === path.join(root, 'index.html') ? resolved : null;
}

const server = http.createServer((req, res) => {
  let requestPath = req.url || '/';

  // Keep the Garba entry point available on the same domain while the
  // booking UI remains part of the main FANTASTIC page.
  if (requestPath === '/garba' || requestPath === '/garba/') {
    res.writeHead(302, { Location: '/#garba' });
    return res.end();
  }

  const filePath = safePath(requestPath);
  if (!filePath) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      // SPA-style fallback for unknown routes.
      const index = path.join(root, 'index.html');
      return fs.readFile(index, (readErr, data) => {
        if (readErr) {
          res.writeHead(500);
          return res.end('Server error');
        }
        res.writeHead(200, { 'Content-Type': types['.html'] });
        res.end(data);
      });
    }

    fs.readFile(filePath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500);
        return res.end('Server error');
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': types[ext] || 'application/octet-stream',
        'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
      });
      res.end(data);
    });
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`FANTASTIC website listening on port ${port}`);
});
