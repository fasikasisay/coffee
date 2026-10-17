const ErrorResponse = require('./errorResponse');

const YMD = /^\d{4}-\d{2}-\d{2}$/;
const MAX_RANGE_DAYS = 366;

/** Validate a YYYY-MM-DD string and return its [y, m, d], or null. */
function parseYmd(value) {
  if (typeof value !== 'string' || !YMD.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return [y, m, d];
}

/**
 * Convert ?from=YYYY-MM-DD&to=YYYY-MM-DD&tz=<minutes> into an inclusive-day,
 * half-open UTC range: created_at >= fromUtc AND created_at < toUtc.
 *
 * `tz` is the browser's Date#getTimezoneOffset() (UTC minus local, in minutes;
 * Ethiopia = -180). Days are therefore the *admin's local* days even though
 * the database stores UTC.
 */
function parseRange(query = {}, { required = false } = {}) {
  const tzRaw = query.tz === undefined ? 0 : Number(query.tz);
  if (!Number.isInteger(tzRaw) || tzRaw < -840 || tzRaw > 840) {
    throw new ErrorResponse('tz must be an integer number of minutes between -840 and 840', 400);
  }
  const tz = tzRaw;

  const hasFrom = query.from !== undefined && query.from !== '';
  const hasTo   = query.to   !== undefined && query.to   !== '';

  if (required && !hasFrom && !hasTo) {
    throw new ErrorResponse('from and to dates are required', 400);
  }

  const localMidnightUtc = ([y, m, d]) => new Date(Date.UTC(y, m - 1, d) + tz * 60000);

  let fromUtc = null;
  let toUtc   = null;
  let fromYmd = null;
  let toYmd   = null;

  if (hasFrom) {
    fromYmd = parseYmd(String(query.from));
    if (!fromYmd) throw new ErrorResponse('from must be a valid date (YYYY-MM-DD)', 400);
    fromUtc = localMidnightUtc(fromYmd);
  }
  if (hasTo) {
    toYmd = parseYmd(String(query.to));
    if (!toYmd) throw new ErrorResponse('to must be a valid date (YYYY-MM-DD)', 400);
    toUtc = new Date(localMidnightUtc(toYmd).getTime() + 24 * 3600 * 1000); // end of that day
  }

  if (fromUtc && toUtc) {
    if (fromUtc >= toUtc) throw new ErrorResponse('from date must not be after to date', 400);
    const days = Math.round((toUtc - fromUtc) / (24 * 3600 * 1000));
    if (days > MAX_RANGE_DAYS) {
      throw new ErrorResponse(`Date range cannot exceed ${MAX_RANGE_DAYS} days`, 400);
    }
  }

  return { fromUtc, toUtc, tz };
}

/** Parse page / limit query params into safe integers. */
function parsePaging(query = {}, { defaultLimit = 25, maxLimit = 100 } = {}) {
  let page  = parseInt(query.page, 10);
  let limit = parseInt(query.limit, 10);
  if (!Number.isInteger(page)  || page  < 1) page  = 1;
  if (!Number.isInteger(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;
  return { page, limit, offset: (page - 1) * limit };
}

module.exports = { parseRange, parsePaging, parseYmd };
