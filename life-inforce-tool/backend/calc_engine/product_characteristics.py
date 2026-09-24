"""Loads and looks up product_characteristics.json -- the per-plan reference
(expiration rules, premium-payment rules, joint-age convention, ...) that
CAPSIL and the policy extract don't carry. Lives at the calc_engine/ package
level, not inside term_life/, because it's meant to be shared by every
product line's engine (term_life today; perm_life and critical_illness
later use the same file, extended with their own plans).
"""
import json
import os

_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'product_characteristics.json')
_data = None


def _load():
    global _data
    if _data is None:
        with open(_PATH, encoding='utf-8') as f:
            _data = json.load(f)
    return _data


class PlanNotFound(Exception):
    """(coverage_plan_code, rate_scale) has no entry yet -- a real gap in
    product_characteristics.json, not a bug in the calc engine."""
    def __init__(self, plan_code, rate_scale):
        self.plan_code = plan_code
        self.rate_scale = rate_scale
        super().__init__("no product characteristics for plan '%s' rate scale '%s'" % (plan_code, rate_scale))


def lookup(plan_code, rate_scale):
    """The one product-characteristics record for this (plan, rate scale)
    pair. Raises PlanNotFound if there is none -- callers turn that into a
    Blocked with their own catalog ID, since PlanNotFound alone can't say
    which variable was being computed."""
    for row in _load()['characteristics']:
        if row['coverage_plan_code'] == plan_code and row['rate_scale'] == rate_scale:
            return row
    raise PlanNotFound(plan_code, rate_scale)
