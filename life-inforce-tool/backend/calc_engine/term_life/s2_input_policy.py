"""Section 2 -- Input Setup: Policy. term_catalog.json IDs POL-01..POL-13.

These are all policy-level scalars (no iCov/iDur/iInsured), fully computable
from the extract alone -- no Product Characteristics dependency in this
section. Every function still takes the uniform (ctx, iCov=None, iDur=None,
iInsured=None) signature so Context.get() can dispatch to any variable the
same way regardless of section.
"""
from .context import variable
from .dates import parse_date, fmt_date, make_date, days_between_365


# ------------------------------------------------------------ direct reads
@variable('policy_issue_date')
def policy_issue_date(ctx, iCov=None, iDur=None, iInsured=None):
    # POL-01. Direct CAPSIL read.
    return ctx.policy()['policyIssueDate']


@variable('value_as_of_date')
def value_as_of_date(ctx, iCov=None, iDur=None, iInsured=None):
    # POL-02. Direct CAPSIL read.
    return ctx.policy()['valueAsOfDate']


@variable('premiums_paid_to_date')
def premiums_paid_to_date(ctx, iCov=None, iDur=None, iInsured=None):
    # POL-03. Direct CAPSIL read.
    return ctx.policy()['premiumsPaidToDate']


@variable('total_premiums_paid')
def total_premiums_paid(ctx, iCov=None, iDur=None, iInsured=None):
    # POL-04. Direct CAPSIL read.
    return ctx.policy()['totalPremiumsPaid']


@variable('policy_cumulative_ncpi')
def policy_cumulative_ncpi(ctx, iCov=None, iDur=None, iInsured=None):
    # POL-05. Direct CAPSIL read.
    return ctx.policy()['policyCumulativeNcpi']


@variable('policy_acb')
def policy_acb(ctx, iCov=None, iDur=None, iInsured=None):
    # POL-06. Direct CAPSIL read.
    return ctx.policy()['policyAcb']


@variable('pmt_mode')
def pmt_mode(ctx, iCov=None, iDur=None, iInsured=None):
    # POL-13. Direct CAPSIL read: '01' Monthly, '12' Annual.
    return ctx.policy()['pmtMode']


# ---------------------------------------------------------------- computed
@variable('policy_duration_adjustment')
def policy_duration_adjustment(ctx, iCov=None, iDur=None, iInsured=None):
    # POL-11.
    voa = parse_date(ctx.get('value_as_of_date'))
    iss = parse_date(ctx.get('policy_issue_date'))
    if voa.month < iss.month:
        return 0
    if voa.month == iss.month and voa.day < iss.day:
        return 0
    return 1


@variable('policy_1st_duration')
def policy_1st_duration(ctx, iCov=None, iDur=None, iInsured=None):
    # POL-10.
    voa = parse_date(ctx.get('value_as_of_date'))
    iss = parse_date(ctx.get('policy_issue_date'))
    return voa.year - iss.year + ctx.get('policy_duration_adjustment')


@variable('policy_dec31_indicator')
def policy_dec31_indicator(ctx, iCov=None, iDur=None, iInsured=None):
    # POL-12. Same branch condition as policy_duration_adjustment, but
    # signals "NCPI already deducted from ACB" rather than a duration offset.
    voa = parse_date(ctx.get('value_as_of_date'))
    iss = parse_date(ctx.get('policy_issue_date'))
    if voa.month < iss.month:
        return 1
    if voa.month == iss.month and voa.day < iss.day:
        return 1
    return 0


@variable('year_next_policy_anniversary')
def year_next_policy_anniversary(ctx, iCov=None, iDur=None, iInsured=None):
    # POL-08.
    voa = parse_date(ctx.get('value_as_of_date'))
    iss = parse_date(ctx.get('policy_issue_date'))
    if iss.month < voa.month:
        return voa.year + 1
    if iss.month == voa.month and iss.day <= voa.day:
        return voa.year + 1
    return voa.year


@variable('next_policy_anniversary')
def next_policy_anniversary(ctx, iCov=None, iDur=None, iInsured=None):
    # POL-07.
    iss = parse_date(ctx.get('policy_issue_date'))
    y = ctx.get('year_next_policy_anniversary')
    return fmt_date(make_date(y, iss.month, iss.day))


@variable('nbr_premiums_until_next_policy_anniv')
def nbr_premiums_until_next_policy_anniv(ctx, iCov=None, iDur=None, iInsured=None):
    # POL-09. Day-count for the Annual branch assumes a 365-day year with
    # February always 28 days (see dates.days_between_365) -- the catalog
    # states this explicitly, it is not a real calendar day-count.
    mode = ctx.get('pmt_mode')
    nxt = parse_date(ctx.get('next_policy_anniversary'))
    paid = parse_date(ctx.get('premiums_paid_to_date'))
    if mode == '12':   # Annual
        return min(1, days_between_365(paid, nxt) / 365)
    # Monthly
    delta = nxt.month - paid.month
    if delta < 0:
        delta += 12
    return delta
