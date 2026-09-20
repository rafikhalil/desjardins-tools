"""Coverage Optimizer server (started by start-server.bat).

Serves this folder like `python -m http.server`, plus one extra route:
POST /data/<name>.json writes the body into data/ and never overwrites — a
taken name gets a timestamp suffix, and the JSON reply {"name": ...} carries
the name actually used. Listens on this PC only (127.0.0.1).
"""
import http.server
import json
import os
import re
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, 'data')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
NAME = re.compile(r'[A-Za-z0-9_-]{1,100}\.json')   # a bare file name — nothing can land outside data/
MAX_BYTES = 5 * 1024 * 1024


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Revalidate on every load (a cheap 304 when unchanged): without this the browser
        # reuses a stale cached .html/.js for hours after an edit and shows the OLD tool.
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def reply(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        name = self.path.split('?')[0][len('/data/'):] if self.path.startswith('/data/') else ''
        if not NAME.fullmatch(name):
            return self.reply(400, {'error': 'bad file name'})
        # Only our own page sends application/json: another site's request would need a CORS preflight, which we never answer.
        if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
            return self.reply(415, {'error': 'application/json only'})
        size = int(self.headers.get('Content-Length') or 0)
        if not 0 < size <= MAX_BYTES:
            return self.reply(413, {'error': 'bad size'})
        body = self.rfile.read(size)
        try:
            json.loads(body)
        except ValueError:
            return self.reply(400, {'error': 'not JSON'})

        os.makedirs(DATA, exist_ok=True)
        base = name[:-len('.json')]
        for n in range(100):                        # reserve a free name atomically (O_EXCL), never overwrite
            final = name if n == 0 else '%s_%d.json' % (base, int(time.time() * 1000) + n)
            try:
                os.close(os.open(os.path.join(DATA, final), os.O_CREAT | os.O_EXCL | os.O_WRONLY))
                break
            except FileExistsError:
                continue
        else:
            return self.reply(500, {'error': 'no free file name'})

        fd, tmp = tempfile.mkstemp(dir=DATA, suffix='.tmp')   # write elsewhere, then swap in: never half a file
        with os.fdopen(fd, 'wb') as f:
            f.write(body)
        os.replace(tmp, os.path.join(DATA, final))
        self.reply(201, {'name': final})


if __name__ == '__main__':
    print('Coverage Optimizer server: http://localhost:%d/optimizer.html  (Ctrl+C to stop)' % PORT)
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
