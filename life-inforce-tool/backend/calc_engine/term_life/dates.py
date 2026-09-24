"""Date helpers shared by every Term Life calc module.

Dates in the parsed extract are strings in DD-MMM-YYYY form (see
INFORCE_REFERENCE.md Sec 8 "Dates"), the same canonical format the browser
tool normalises everything to on import. Everything here works on Python
`date` objects internally; parse_date/fmt_date convert at the boundary.
"""
from datetime import date

MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']


def parse_date(s):
    """'21-JUN-2018' -> date(2018, 6, 21). A blank or malformed value (e.g. an
    empty CAPSIL date) raises with the value itself, not an unpacking error."""
    try:
        d, mon, y = s.split('-')
        return date(int(y), MONTHS.index(mon.upper()) + 1, int(d))
    except (AttributeError, ValueError):
        raise ValueError('expected a valid DD-MMM-YYYY date, got %r' % (s,)) from None


def fmt_date(d):
    """date(2018, 6, 21) -> '21-JUN-2018', the canonical display form."""
    return '%02d-%s-%d' % (d.day, MONTHS[d.month - 1], d.year)


def make_date(year, month, day):
    """DATE(year, month, day) as the spec's formulas use it. Raises on an
    invalid combination (e.g. day 31 of February) rather than silently
    rolling over into the next month, same as the frontend's buildDate."""
    return date(year, month, day)


# --- 365-day / Feb-always-28 day count --------------------------------
# POL-09 and COV-08 both specify this convention explicitly rather than a
# real calendar day-count: "we assume a 365-day year, with February
# considered to have 28 days." Leap years are deliberately not special-cased
# anywhere in this module.
_MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
_CUM_DAYS = [0]
for _n in _MONTH_DAYS:
    _CUM_DAYS.append(_CUM_DAYS[-1] + _n)


def _day_of_year_365(d):
    """1-based day-of-year under the 365-day/Feb-28 convention. A real leap
    day (Feb 29) collapses onto day 28, since that convention has no Feb 29."""
    day = min(d.day, _MONTH_DAYS[d.month - 1])
    return _CUM_DAYS[d.month - 1] + day


def days_between_365(d1, d2):
    """d2 - d1, in days, under the 365-day/Feb-28 convention (POL-09, COV-08).
    Positive when d2 is after d1."""
    return (d2.year - d1.year) * 365 + _day_of_year_365(d2) - _day_of_year_365(d1)
