// Series numbering: entries are grouped into blocks of 100 by their entry_no.
// entry_no 1–100 → series 1, 101–200 → series 2, and so on. So within a series
// the entry number keeps climbing (102, 103, …) while the series stays 2 until
// 200 is passed.
export const SERIES_SIZE = 100;

export const seriesOf = (entryNo) => {
  const n = Number(entryNo);
  return Number.isFinite(n) && n > 0 ? Math.floor((n - 1) / SERIES_SIZE) + 1 : null;
};

// The entry_no window a series covers, e.g. series 2 → { from: 101, to: 200 }.
export const seriesRange = (series) => {
  const s = Number(series);
  if (!Number.isFinite(s) || s < 1) return null;
  return { from: (s - 1) * SERIES_SIZE + 1, to: s * SERIES_SIZE };
};
