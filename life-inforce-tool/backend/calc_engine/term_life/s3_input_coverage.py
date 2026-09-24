"""Section 3 -- Input Setup: Coverage. term_catalog.json IDs COV-01..COV-13,
plus COV-14/COV-15 (joint_type, joint_age_equivalent) added alongside
COV-12/13 -- all four read product_characteristics.json by
(coverage_plan_code, rate_scale) = (coverage.planId, coverage.rateScale).
A plan not yet in that file raises Blocked via PlanNotFound, not a crash --
see _pc_field below.
"""
from ..product_characteristics import lookup, PlanNotFound
from .context import variable, Blocked
from .dates import parse_date, fmt_date, make_date, days_between_365


def _pc_field(ctx, iCov, catalog_id, field):
    cov = ctx.coverage(iCov)
    try:
        row = lookup(cov['planId'], cov['rateScale'])
    except PlanNotFound as e:
        raise Blocked(catalog_id, str(e))
    return row[field]


# ------------------------------------------------------------ direct reads
@variable('coverage_issue_date')
def coverage_issue_date(ctx, iCov=None, iDur=None, iInsured=None):
    # COV-01. Direct CAPSIL read.
    return ctx.coverage(iCov)['coverageIssueDate']


@variable('coverage_expiration_date')
def coverage_expiration_date(ctx, iCov=None, iDur=None, iInsured=None):
    # COV-02. Direct CAPSIL read.
    return ctx.coverage(iCov)['coverageExpirationDate']


@variable('coverage_paid_up_date')
def coverage_paid_up_date(ctx, iCov=None, iDur=None, iInsured=None):
    # COV-03. Direct CAPSIL read.
    return ctx.coverage(iCov)['paidUpDate']


# ---------------------------------------------------------------- computed
@variable('coverage_duration_adjustment')
def coverage_duration_adjustment(ctx, iCov=None, iDur=None, iInsured=None):
    # COV-05.
    voa = parse_date(ctx.get('value_as_of_date'))
    ci = parse_date(ctx.get('coverage_issue_date', iCov=iCov))
    if voa.month < ci.month:
        return 0
    if voa.month == ci.month and voa.day < ci.day:
        return 0
    return 1


@variable('coverage_1st_duration')
def coverage_1st_duration(ctx, iCov=None, iDur=None, iInsured=None):
    # COV-04.
    voa = parse_date(ctx.get('value_as_of_date'))
    ci = parse_date(ctx.get('coverage_issue_date', iCov=iCov))
    return voa.year - ci.year + ctx.get('coverage_duration_adjustment', iCov=iCov)


@variable('premium_duration_adjustment')
def premium_duration_adjustment(ctx, iCov=None, iDur=None, iInsured=None):
    # COV-07.
    paid = parse_date(ctx.get('premiums_paid_to_date'))
    ci = parse_date(ctx.get('coverage_issue_date', iCov=iCov))
    if paid.month < ci.month:
        return 0
    if paid.month == ci.month and paid.day < ci.day:
        return 0
    return 1


@variable('premium_rate_duration')
def premium_rate_duration(ctx, iCov=None, iDur=None, iInsured=None):
    # COV-06.
    paid = parse_date(ctx.get('premiums_paid_to_date'))
    ci = parse_date(ctx.get('coverage_issue_date', iCov=iCov))
    return paid.year - ci.year + ctx.get('premium_duration_adjustment', iCov=iCov)


@variable('adjusted_coverage_issue_year')
def adjusted_coverage_issue_year(ctx, iCov=None, iDur=None, iInsured=None):
    # COV-10.
    pol_iss = parse_date(ctx.get('policy_issue_date'))
    cov_iss = parse_date(ctx.get('coverage_issue_date', iCov=iCov))
    if cov_iss.month >= pol_iss.month:
        return pol_iss.year
    return pol_iss.year + 1


@variable('adjusted_coverage_issue_date')
def adjusted_coverage_issue_date(ctx, iCov=None, iDur=None, iInsured=None):
    # COV-09.
    cov_iss = parse_date(ctx.get('coverage_issue_date', iCov=iCov))
    y = ctx.get('adjusted_coverage_issue_year', iCov=iCov)
    return fmt_date(make_date(y, cov_iss.month, cov_iss.day))


@variable('policy_vs_coverage_offset')
def policy_vs_coverage_offset(ctx, iCov=None, iDur=None, iInsured=None):
    # COV-08. Day-count for the Annual branch assumes a 365-day year with
    # February always 28 days (see dates.days_between_365), same convention
    # as POL-09.
    mode = ctx.get('pmt_mode')
    pol_iss = parse_date(ctx.get('policy_issue_date'))
    cov_iss = parse_date(ctx.get('coverage_issue_date', iCov=iCov))
    if mode == '12':   # Annual
        adj = parse_date(ctx.get('adjusted_coverage_issue_date', iCov=iCov))
        return days_between_365(pol_iss, adj)
    # Monthly
    delta = cov_iss.month - pol_iss.month
    if delta < 0:
        delta += 12
    return delta


@variable('coverage_dec31_indicator')
def coverage_dec31_indicator(ctx, iCov=None, iDur=None, iInsured=None):
    # COV-11.
    cov_iss = parse_date(ctx.get('coverage_issue_date', iCov=iCov))
    pol_iss = parse_date(ctx.get('policy_issue_date'))
    if cov_iss.month < pol_iss.month:
        return -1
    if cov_iss.month == pol_iss.month and cov_iss.day < pol_iss.day:
        return -1
    return 0


# ------------------------------------------------------ product characteristics
@variable('coverage_type')
def coverage_type(ctx, iCov=None, iDur=None, iInsured=None):
    # COV-12. 'Individual' or 'Joint'.
    return _pc_field(ctx, iCov, 'COV-12', 'coverage_type')


@variable('product_type')
def product_type(ctx, iCov=None, iDur=None, iInsured=None):
    # COV-13. 'Term' or 'Permanent'.
    return _pc_field(ctx, iCov, 'COV-13', 'product_type')


@variable('joint_type')
def joint_type(ctx, iCov=None, iDur=None, iInsured=None):
    # COV-14 (added alongside COV-12/13). 'JFTD' / 'JLTD' / 'JLTDPU' when
    # coverage_type is 'Joint'; null for 'Individual'.
    return _pc_field(ctx, iCov, 'COV-14', 'joint_type')


@variable('joint_age_equivalent')
def joint_age_equivalent(ctx, iCov=None, iDur=None, iInsured=None):
    # COV-15 (added alongside COV-12/13). True/False when coverage_type is
    # 'Joint' (whether Maximum Age, DUR-13, uses the equivalent-age
    # convention); null for 'Individual'.
    return _pc_field(ctx, iCov, 'COV-15', 'joint_age_equivalent')
