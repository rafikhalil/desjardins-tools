"""Section 1 -- Duration. term_catalog.json IDs DUR-01..DUR-16.

Blocked, pending the Product Characteristics reference (a per-plan lookup
that does not exist yet -- see Context.Blocked):
  DUR-07 expiration_type, DUR-09 end_of_premium_age_or_duration,
  DUR-11 end_of_coverage_age_or_duration, DUR-12 end_of_premium_type
  -- and everything downstream of them: DUR-05, DUR-06, DUR-08, DUR-10,
  DUR-13 (needs coverage_type, COV-12), DUR-14, DUR-15 (needs product_type,
  COV-13).

DUR-16 (age) is ALSO blocked for a different reason: the catalog lists it as
a direct CAPSIL read with no dependencies, but our extract has no raw "age"
field, only birthdate -- whether it should be computed from birthdate (and
under which age convention) is an open question, not yet confirmed.

DUR-01 through DUR-04 have no such dependency and are fully implemented.
"""
from .context import variable, Blocked
from .dates import parse_date


# ---------------------------------------------------------------- computed
@variable('end_of_coverage_projection_without_adj')
def end_of_coverage_projection_without_adj(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-02.
    exp = parse_date(ctx.get('coverage_expiration_date', iCov=iCov))
    iss = parse_date(ctx.get('coverage_issue_date', iCov=iCov))
    return exp.year - iss.year


@variable('coverage_projection_adjustment')
def coverage_projection_adjustment(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-03.
    return 0 if ctx.get('policy_vs_coverage_offset', iCov=iCov) == 0 else 1


@variable('end_of_coverage_projection')
def end_of_coverage_projection(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-01.
    return (ctx.get('end_of_coverage_projection_without_adj', iCov=iCov) +
            ctx.get('coverage_projection_adjustment', iCov=iCov))


@variable('end_of_illustration_projection')
def end_of_illustration_projection(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-04. Policy-level: the max over every coverage on the illustration.
    return max(ctx.get('end_of_coverage_projection', iCov=c)
               for c in range(1, ctx.coverage_count() + 1))


# ------------------------------------------------------------------ blocked
@variable('expiration_type')
def expiration_type(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-07.
    raise Blocked('DUR-07', 'needs the Product Characteristics lookup (not yet available)')


@variable('end_of_premium_type')
def end_of_premium_type(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-12.
    raise Blocked('DUR-12', 'needs the Product Characteristics lookup (not yet available)')


@variable('end_of_premium_age_or_duration')
def end_of_premium_age_or_duration(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-09.
    raise Blocked('DUR-09', 'needs the Product Characteristics lookup (not yet available)')


@variable('end_of_coverage_age_or_duration')
def end_of_coverage_age_or_duration(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-11.
    raise Blocked('DUR-11', 'needs the Product Characteristics lookup (not yet available)')


@variable('end_of_premium_value')
def end_of_premium_value(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-08. Branches on end_of_premium_type (DUR-12).
    raise Blocked('DUR-08', 'needs end_of_premium_type (DUR-12), which is blocked')


@variable('expiration_value')
def expiration_value(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-10. Branches on expiration_type (DUR-07).
    raise Blocked('DUR-10', 'needs expiration_type (DUR-07), which is blocked')


@variable('end_of_premium_pmt_without_adj')
def end_of_premium_pmt_without_adj(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-06. Branches on end_of_premium_type (DUR-12).
    raise Blocked('DUR-06', 'needs end_of_premium_type (DUR-12), which is blocked')


@variable('end_of_premium_pmt')
def end_of_premium_pmt(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-05.
    raise Blocked('DUR-05', 'needs end_of_premium_pmt_without_adj (DUR-06), which is blocked')


@variable('maximum_age')
def maximum_age(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-13.
    raise Blocked('DUR-13', 'needs coverage_type (COV-12), which is blocked')


@variable('omega')
def omega(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-15. Branches on product_type (COV-13).
    raise Blocked('DUR-15', 'needs product_type (COV-13), which is blocked')


@variable('end_of_fiscal_projection')
def end_of_fiscal_projection(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-14. Branches on expiration_type (DUR-07); needs omega (DUR-15).
    raise Blocked('DUR-14', 'needs expiration_type (DUR-07) and omega (DUR-15), which are blocked')


@variable('age')
def age(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-16. See module docstring -- source convention not yet confirmed.
    raise Blocked('DUR-16', 'source convention (raw CAPSIL field vs. computed from birthdate) not yet confirmed')
