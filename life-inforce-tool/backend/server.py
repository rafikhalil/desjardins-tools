"""Inforce Tool server (started by _start-life-inforce.bat).

Serves the TOOL folder (the one holding backend/, history_data/, etc.) like
`python -m http.server`, so the page at /backend/inforce.html reaches
../history_data/ and ../usernames.json. Extra routes:

  GET    /history_data/            -> every saved test case: [{file, entry}]
  POST   /history_data/<name>.json -> writes the body into history_data/, never
                                       overwrites (a taken name gets a timestamp
                                       suffix); replies {"name": <actual file>}
  DELETE /history_data/<name>.json -> moves the file to history_data/_deleted/
  GET    /usernames.json           -> the known-users list: [{name, ini}]
  POST   /usernames.json           -> body {"name": "..."}; adds it (case-
                                       insensitive de-duped, initials derived
                                       and disambiguated), replies the full list
  POST   /calc/term_life           -> body: the working dataset ({policy,
                                       coverages}, i.e. state.data). Runs
                                       every calc_engine.term_life variable
                                       the catalog and the code both know
                                       about and replies the results grouped
                                       by section, for the Dev Validations
                                       tab. See run_term_life_calc().

Listens on this PC only (127.0.0.1). Same atomic-write discipline as the
Coverage Optimizer's server.py: write to a temp file, then os.replace() it
into place, so a reader never sees a half-written file.
"""
import http.server
import json
import os
import re
import sys
import tempfile
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))   # this file lives in backend/
DATA = os.path.join(ROOT, 'history_data')
USERS_FILE = os.path.join(ROOT, 'usernames.json')
CATALOG_FILE = os.path.join(ROOT, 'calculation_specs', '1_term_life', 'term_catalog.json')
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8001
NAME = re.compile(r'[A-Za-z0-9_-]{1,100}\.json')   # a bare file name — nothing can land outside history_data/
MAX_BYTES = 5 * 1024 * 1024

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))   # so "import calc_engine" finds backend/calc_engine/
from calc_engine.term_life import Context, Blocked, REGISTRY  # noqa: E402


# ---------------------------------------------------------------- calc dev
SUPPORTED_SECTIONS = ('Duration', 'Input Setup - Policy', 'Input Setup - Coverage')


def run_term_life_calc(data):
    """Runs every catalog variable in SUPPORTED_SECTIONS that has a matching
    entry in calc_engine.term_life.REGISTRY against `data` (the working
    dataset), grouped by section, for the Dev Validations tab. A variable
    the catalog lists but the engine hasn't implemented yet is reported as
    "not implemented" rather than attempted; one that IS implemented but
    raises Blocked (e.g. needs Product Characteristics) is reported with its
    reason. This is dev tooling, not the real projection engine (§11 of
    INFORCE_REFERENCE.md) -- it exists to let a person eyeball every formula
    against a loaded extract while the engine is being built.
    """
    with open(CATALOG_FILE, encoding='utf-8') as f:
        catalog = json.load(f)

    ctx = Context(data)
    coverage_count = len(data.get('coverages') or [])
    sections = {}

    for entry in catalog:
        if entry['section'] not in SUPPORTED_SECTIONS:
            continue
        name = entry['python_name']
        indices = entry.get('indices') or ''
        row = {
            'id': entry['id'], 'python_name': name, 'business_name': entry['business_name'],
            'indices': indices, 'implemented': name in REGISTRY, 'results': [],
        }

        def one(iCov=None, iInsured=None):
            r = {'iCov': iCov, 'iInsured': iInsured, 'coverageNumber': None, 'value': None, 'error': None}
            if iCov is not None and 1 <= iCov <= coverage_count:
                r['coverageNumber'] = data['coverages'][iCov - 1].get('coverageNumber')
            if name not in REGISTRY:
                r['error'] = 'not implemented yet'
                return r
            try:
                r['value'] = ctx.get(name, iCov=iCov, iInsured=iInsured)
            except Blocked as e:
                r['error'] = e.reason
            except Exception as e:  # noqa: BLE001 -- surface a bug in a formula, don't crash the whole tab
                r['error'] = '%s: %s' % (type(e).__name__, e)
            return r

        if 'iInsured' in indices:
            for iCov in range(1, coverage_count + 1):
                nInsured = len(data['coverages'][iCov - 1].get('insureds') or [])
                for iInsured in range(1, nInsured + 1):
                    row['results'].append(one(iCov=iCov, iInsured=iInsured))
        elif 'iCov' in indices:
            for iCov in range(1, coverage_count + 1):
                row['results'].append(one(iCov=iCov))
        else:
            row['results'].append(one())

        sections.setdefault(entry['section'], []).append(row)

    return {'sections': [{'section': s, 'vars': sections[s]} for s in SUPPORTED_SECTIONS if s in sections]}


def derive_initials(name, taken):
    letters = re.findall(r"[A-Za-z]+", name)
    base = ''.join(w[0] for w in letters).lower() or 'u'
    if base not in taken:
        return base
    for n in range(2, 100):
        cand = base + str(n)
        if cand not in taken:
            return cand
    return base + str(int(time.time()))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # Revalidate on every load: without this the browser can reuse a
        # stale cached .html/.js for hours after an edit.
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
        if self.path.split('?')[0] == '/usernames.json' and not os.path.isfile(USERS_FILE):
            return self.reply(200, [])
        super().do_GET()

    def do_DELETE(self):
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
        path = self.path.split('?')[0]
        if path == '/usernames.json':
            return self.post_username()
        if path == '/calc/term_life':
            return self.post_calc_term_life()
        name = path[len('/history_data/'):] if path.startswith('/history_data/') else ''
        if not NAME.fullmatch(name):
            return self.reply(400, {'error': 'bad file name'})
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
        for n in range(100):
            final = name if n == 0 else '%s_%d.json' % (base, int(time.time() * 1000) + n)
            try:
                os.close(os.open(os.path.join(DATA, final), os.O_CREAT | os.O_EXCL | os.O_WRONLY))
                break
            except FileExistsError:
                continue
        else:
            return self.reply(500, {'error': 'no free file name'})

        fd, tmp = tempfile.mkstemp(dir=DATA, suffix='.tmp')
        with os.fdopen(fd, 'wb') as f:
            f.write(body)
        os.replace(tmp, os.path.join(DATA, final))
        self.reply(201, {'name': final})

    def post_username(self):
        if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
            return self.reply(415, {'error': 'application/json only'})
        size = int(self.headers.get('Content-Length') or 0)
        if not 0 < size <= 4096:
            return self.reply(413, {'error': 'bad size'})
        try:
            payload = json.loads(self.rfile.read(size))
            name = str(payload.get('name', '')).strip()[:40]
        except (ValueError, AttributeError):
            return self.reply(400, {'error': 'not JSON'})
        if not name:
            return self.reply(400, {'error': 'name required'})

        users = []
        if os.path.isfile(USERS_FILE):
            try:
                with open(USERS_FILE, encoding='utf-8') as fh:
                    users = json.load(fh)
            except (ValueError, OSError):
                users = []

        existing = next((u for u in users if u.get('name', '').lower() == name.lower()), None)
        if not existing:
            taken = set(u.get('ini', '') for u in users)
            users.append({'name': name, 'ini': derive_initials(name, taken)})
            os.makedirs(ROOT, exist_ok=True)
            fd, tmp = tempfile.mkstemp(dir=ROOT, suffix='.tmp')
            with os.fdopen(fd, 'w', encoding='utf-8') as f:
                json.dump(users, f, indent=2)
            os.replace(tmp, USERS_FILE)

        self.reply(201, users)

    def post_calc_term_life(self):
        if self.headers.get('Content-Type', '').split(';')[0].strip() != 'application/json':
            return self.reply(415, {'error': 'application/json only'})
        size = int(self.headers.get('Content-Length') or 0)
        if not 0 < size <= MAX_BYTES:
            return self.reply(413, {'error': 'bad size'})
        try:
            data = json.loads(self.rfile.read(size))
        except ValueError:
            return self.reply(400, {'error': 'not JSON'})
        if not isinstance(data, dict) or 'policy' not in data or 'coverages' not in data:
            return self.reply(400, {'error': 'expected {"policy": {...}, "coverages": [...]}'})
        try:
            result = run_term_life_calc(data)
        except Exception as e:  # noqa: BLE001 -- a bug in run_term_life_calc itself, not a formula
            return self.reply(500, {'error': '%s: %s' % (type(e).__name__, e)})
        self.reply(200, result)


if __name__ == '__main__':
    print('Inforce Tool server: http://localhost:%d/backend/inforce.html  (Ctrl+C to stop)' % PORT)
    http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
