"""Coverage Optimizer server (started by _start-coverage-optimizer.bat).

Serves the TOOL folder (the one holding backend_files/, rates/ and history_data/) like
`python -m http.server`, so the page at /backend_files/optimizer.html reaches ../rates/
and ../history_data/. One extra route: POST /history_data/<name>.json writes the body
into history_data/ and never overwrites — a taken name gets a timestamp suffix, and
the JSON reply {"name": ...} carries the name actually used. GET /history_data/ lists every
saved test case; DELETE /history_data/<name>.json moves one to history_data/_deleted/. Listens on this PC only
(127.0.0.1).
"""
import http.server
import json
import os
import re
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # this file lives in backend_files/
DATA = os.path.join(ROOT, 'history_data')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
NAME = re.compile(r'[A-Za-z0-9_-]{1,100}\.json')   # a bare file name — nothing can land outside history_data/
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

    def do_GET(self):
        # GET /history_data/ -> every saved test case in the folder, in one reply: [{file, entry}] (entry null if unreadable).
        if self.path.split('?')[0] == '/history_data/':
            out = []
            for f in sorted(os.listdir(DATA)) if os.path.isdir(DATA) else []:
                if NAME.fullmatch(f):
                    try:
                        with open(os.path.join(DATA, f), encoding='utf-8') as fh:
                            out.append({'file': f, 'entry': json.load(fh)})
                    except (ValueError, OSError):
                        out.append({'file': f, 'entry': None})
            return self.reply(200, out)
        super().do_GET()

    def do_DELETE(self):
        # DELETE /history_data/<name>.json -> moved to history_data/_deleted/ (with a timestamp), never erased.
        name = self.path.split('?')[0][len('/history_data/'):] if self.path.startswith('/history_data/') else ''
        if not NAME.fullmatch(name):
            return self.reply(400, {'error': 'bad file name'})
        src = os.path.join(DATA, name)
        if not os.path.isfile(src):
            return self.reply(404, {'error': 'no such file'})
        trash = os.path.join(DATA, '_deleted')
        os.makedirs(trash, exist_ok=True)
        os.replace(src, os.path.join(trash, '%d_%s' % (int(time.time() * 1000), name)))
        self.reply(200, {'moved': name})

    def do_POST(self):
        name = self.path.split('?')[0][len('/history_data/'):] if self.path.startswith('/history_data/') else ''
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
    print('Coverage Optimizer server: http://localhost:%d/backend_files/optimizer.html  (Ctrl+C to stop)' % PORT)
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
