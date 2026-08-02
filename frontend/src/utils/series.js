// Yearly entry numbering: an entry's number resets each calendar year, and the
// year itself is shown as a letter — the EARLIEST year with data is "A", the
// next "B", and so on. The full code reads `${letter}-${seq}` (e.g. "A-1").
// The letter depends on the global earliest year, which can shift, so the server
// computes the final code and sends it as `entry_code`; this just reads it.
export const entryCode = (contact) => contact?.entry_code || null;
