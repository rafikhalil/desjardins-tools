"""Term Life calculation engine.

Importing this package registers every implemented variable (see
context.REGISTRY) by importing each section module for its side effect.
Callers only need `from calc_engine.term_life import Context` plus
`Context(data).get(python_name, iCov=..., iDur=..., iInsured=...)`.
"""
from .context import Context, Blocked, REGISTRY  # noqa: F401

from . import s1_duration      # noqa: F401,E402
from . import s2_input_policy  # noqa: F401,E402
from . import s3_input_coverage  # noqa: F401,E402
