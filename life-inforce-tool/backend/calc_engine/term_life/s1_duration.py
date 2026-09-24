"""Section 1 -- Duration. term_catalog.json IDs DUR-01..DUR-16.

DUR-07, DUR-09, DUR-11, DUR-12 now read product_characteristics.json (see
s3_input_coverage.py's _pc_field) instead of raising Blocked -- and so do
DUR-08, DUR-10, DUR-15, which only needed those plus DUR-13/DUR-16's own
values to branch. Concretely, for every plan in product_characteristics.json
today (all Term, all expiration_type/end_of_premium_type == 'C'):
  DUR-07/09/11/12: direct lookups.
  DUR-10 expiration_value: resolves to end_of_coverage_age_or_duration (85).
  DUR-08 end_of_premium_value: resolves to MIN(100, expiration_value) (85).
  DUR-15 omega: resolves to expiration_value for every Term plan (85).

Still genuinely blocked -- on DUR-16 (age), not on Product Characteristics:
  DUR-13 maximum_age needs each insured's age.
  DUR-06 end_of_premium_pmt_without_adj needs maximum_age when
    end_of_premium_type == 'C' (true for every plan so far).
  DUR-05 end_of_premium_pmt needs DUR-06.
  DUR-14 end_of_fiscal_projection needs age directly.
These are written as their real formulas below, not stubs -- they raise
Blocked automatically the moment they call ctx.get('age', ...), because
DUR-16 itself still raises Blocked (see its own docstring: the catalog lists
age as a direct CAPSIL read with no dependencies, but the extract has no raw
age field, only birthdate -- whether/how it should be computed is still an
open question).

DUR-13 has one more edge a Term-only test can't exercise yet: a Joint
coverage with joint_age_equivalent == true would need an "equivalent age"
CAPSIL value the extract model doesn't have at all (every current plan is
joint_age_equivalent == false, so this branch is untested) -- see its own
Blocked message.
"""
from .context import variable, Blocked
from .dates import parse_date
from .s3_input_coverage import _pc_field


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


# ------------------------------------------------------ product characteristics
@variable('expiration_type')
def expiration_type(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-07. 'A' never ends, 'B' predetermined years, 'C' predetermined age.
    return _pc_field(ctx, iCov, 'DUR-07', 'expiration_type')


@variable('end_of_premium_type')
def end_of_premium_type(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-12. 'A' predetermined years, 'B' predetermined age, 'C' never ends.
    return _pc_field(ctx, iCov, 'DUR-12', 'end_of_premium_type')


@variable('end_of_premium_age_or_duration')
def end_of_premium_age_or_duration(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-09.
    return _pc_field(ctx, iCov, 'DUR-09', 'end_of_premium_age_or_duration')


@variable('end_of_coverage_age_or_duration')
def end_of_coverage_age_or_duration(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-11.
    return _pc_field(ctx, iCov, 'DUR-11', 'end_of_coverage_age_or_duration')


# ---------------------------------------------------------------- computed
@variable('expiration_value')
def expiration_value(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-10.
    if ctx.get('expiration_type', iCov=iCov) == 'A':
        return 100
    return ctx.get('end_of_coverage_age_or_duration', iCov=iCov)


@variable('end_of_premium_value')
def end_of_premium_value(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-08.
    if ctx.get('end_of_premium_type', iCov=iCov) == 'C':
        return min(100, ctx.get('expiration_value', iCov=iCov))
    return ctx.get('end_of_premium_age_or_duration', iCov=iCov)


@variable('omega')
def omega(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-15.
    if ctx.get('product_type', iCov=iCov) == 'Permanent':
        return 106
    return ctx.get('expiration_value', iCov=iCov)


@variable('end_of_premium_pmt_without_adj')
def end_of_premium_pmt_without_adj(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-06.
    ept = ctx.get('end_of_premium_type', iCov=iCov)
    if ept in ('A', 'B'):
        paid_up = parse_date(ctx.get('coverage_paid_up_date', iCov=iCov))
        issue = parse_date(ctx.get('coverage_issue_date', iCov=iCov))
        return paid_up.year - issue.year
    # ept == 'C'
    if ctx.get('expiration_type', iCov=iCov) == 'A':
        return ctx.get('end_of_premium_value', iCov=iCov)
    return ctx.get('end_of_premium_value', iCov=iCov) - ctx.get('maximum_age', iCov=iCov)


@variable('end_of_premium_pmt')
def end_of_premium_pmt(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-05.
    return (ctx.get('end_of_premium_pmt_without_adj', iCov=iCov) +
            ctx.get('coverage_projection_adjustment', iCov=iCov))


@variable('maximum_age')
def maximum_age(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-13.
    if ctx.get('coverage_type', iCov=iCov) == 'Individual':
        return ctx.get('age', iCov=iCov, iInsured=1)
    if ctx.get('joint_age_equivalent', iCov=iCov):
        # Untested by any current plan (every one is joint_age_equivalent ==
        # False) -- needs an "equivalent age" CAPSIL value the extract model
        # doesn't carry at all yet, not just DUR-16.
        raise Blocked('DUR-13', "needs the equivalent-age value (from CAPSIL) for a joint_age_equivalent coverage -- "
                                 "not modelled in the extract yet")
    # Joint, not equivalent-age: age of the oldest insured on the coverage.
    ages = [ctx.get('age', iCov=iCov, iInsured=i) for i in range(1, ctx.insured_count(iCov) + 1)]
    return max(ages)


@variable('end_of_fiscal_projection')
def end_of_fiscal_projection(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-14.
    et = ctx.get('expiration_type', iCov=iCov)
    if et in ('A', 'C'):
        return ctx.get('omega', iCov=iCov) - ctx.get('age', iCov=iCov, iInsured=iInsured)
    return ctx.get('omega', iCov=iCov)


# ------------------------------------------------------------------ blocked
@variable('age')
def age(ctx, iCov=None, iDur=None, iInsured=None):
    # DUR-16. See module docstring -- source convention not yet confirmed.
    raise Blocked('DUR-16', 'source convention (raw CAPSIL field vs. computed from birthdate) not yet confirmed')
