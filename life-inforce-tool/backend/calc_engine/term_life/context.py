"""Evaluation context and variable registry for the Term Life calc engine.

Every catalog variable (term_catalog.json) is implemented as a small function
registered here under its `python_name`, one function per file per section
(s1_duration.py, s2_input_policy.py, ...). Formulas call each other through
Context.get(...), never by importing and calling another module's function
directly -- that keeps "what a variable means" (the function) separate from
"how it gets looked up and cached" (this file), and lets the exact same
machinery serve a policy-level scalar (no index), a per-coverage variable
(iCov), and later a per-duration or per-insured one (iDur, iInsured) without
any formula needing to know how its own inputs were produced.

Indexing note: iCov and iInsured are 1-based here, matching the calculation
spec's own notation (sum_{iCov=1}^{NbCov}, ...) so the code reads next to the
spec without an off-by-one translation in your head. Context converts to
Python's 0-based lists internally.
"""

REGISTRY = {}


def variable(name):
    """Decorator: registers a formula function under its catalog python_name.
    Raises at import time on a duplicate registration (almost always a typo)."""
    def wrap(fn):
        if name in REGISTRY:
            raise ValueError("variable '%s' already registered (by %s)" % (name, REGISTRY[name].__module__))
        REGISTRY[name] = fn
        return fn
    return wrap


class Blocked(Exception):
    """Raised by a variable that is written but cannot be evaluated yet --
    e.g. it needs the Product Characteristics lookup, which does not exist
    yet. Deliberately distinct from NotImplementedError so a caller (the Dev
    Validations tab, a test) can tell "missing an input, formula is fine"
    apart from "this is a bug in the formula itself"."""
    def __init__(self, catalog_id, reason):
        self.catalog_id = catalog_id
        self.reason = reason
        super().__init__('%s blocked: %s' % (catalog_id, reason))


class Context:
    """One policy's working data, plus a memoized cache of computed variables.

    `data` is the same {"policy": {...}, "coverages": [...]} shape the
    browser tool's extract parser produces (INFORCE_REFERENCE.md Sec 6/11) --
    coverages is a list of dicts, each carrying its own "insureds" list.
    """

    def __init__(self, data):
        self.data = data
        self._cache = {}

    def policy(self):
        return self.data['policy']

    def coverage_count(self):
        return len(self.data['coverages'])

    def coverage(self, iCov):
        return self.data['coverages'][iCov - 1]

    def insured_count(self, iCov):
        return len(self.coverage(iCov)['insureds'])

    def insured(self, iCov, iInsured):
        return self.coverage(iCov)['insureds'][iInsured - 1]

    def get(self, name, iCov=None, iDur=None, iInsured=None):
        """Look up a variable by its catalog python_name at the given
        indices, computing and caching it on first use. Indices a variable
        doesn't need are simply ignored by its function."""
        key = (name, iCov, iDur, iInsured)
        if key in self._cache:
            return self._cache[key]
        if name not in REGISTRY:
            raise KeyError("no variable registered for '%s'" % name)
        value = REGISTRY[name](self, iCov=iCov, iDur=iDur, iInsured=iInsured)
        self._cache[key] = value
        return value
