const pad = (n) => String(n).padStart(2, '0');
const lastDayOf = (y, m) => new Date(y, m, 0).getDate();   // m is 1-based

/**
 * Parses what someone would actually type into a date box, at whatever
 * precision they have in mind. `end` decides how a partial value is widened:
 * "2022" means 1 Jan 2022 in the From box and 31 Dec 2022 in the To box, so
 * typing 2022 → 2026 covers those five years end to end.
 *
 * Accepted:
 *   2022              year
 *   03/2022  3-2022   month + year
 *   2022-03           year + month
 *   15/03/2022        day/month/year (the format shown elsewhere in the app)
 *   2022-03-15        ISO
 *
 * Returns 'YYYY-MM-DD', or null when it can't be read as a date.
 */
export const parseDateInput = (raw, end = false) => {
  const v = String(raw ?? '').trim();
  if (!v) return null;

  const clamp = (y, m, d) => {
    if (y < 1900 || y > 2999 || m < 1 || m > 12) return null;
    const maxD = lastDayOf(y, m);
    if (d < 1 || d > maxD) return null;
    return `${y}-${pad(m)}-${pad(d)}`;
  };

  let m;
  // Year only
  if ((m = v.match(/^(\d{4})$/))) {
    const y = +m[1];
    return end ? clamp(y, 12, 31) : clamp(y, 1, 1);
  }
  // MM/YYYY or MM-YYYY
  if ((m = v.match(/^(\d{1,2})[/\-.](\d{4})$/))) {
    const mo = +m[1], y = +m[2];
    if (mo < 1 || mo > 12) return null;
    return end ? clamp(y, mo, lastDayOf(y, mo)) : clamp(y, mo, 1);
  }
  // YYYY-MM
  if ((m = v.match(/^(\d{4})[/\-.](\d{1,2})$/))) {
    const y = +m[1], mo = +m[2];
    if (mo < 1 || mo > 12) return null;
    return end ? clamp(y, mo, lastDayOf(y, mo)) : clamp(y, mo, 1);
  }
  // DD/MM/YYYY — day first, matching how dates are displayed in this app
  if ((m = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/))) {
    return clamp(+m[3], +m[2], +m[1]);
  }
  // YYYY-MM-DD
  if ((m = v.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/))) {
    return clamp(+m[1], +m[2], +m[3]);
  }
  return null;
};
