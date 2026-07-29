// Shared 75mm x 50mm mailing-label printing, used by both the bulk "Labels"
// button on the Entry list and the single-entry button in the detail modal.
// Kept in one place so a fix to the label layout can never apply to one and
// not the other.

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const labelHtml = (contacts) => {
  const labels = contacts.map(c => {
    const name = (c.honorific ? c.honorific + ' ' : '') + (c.full_name || '');
    const address = [c.door_flat_no, c.street, c.village_town, c.district, c.state, c.pincode].filter(Boolean).join(', ');
    // All numbers: phone_1 + the phones[] array (falling back to phone_2), each +91.
    const nums = [c.phone_1, ...(Array.isArray(c.phones) && c.phones.length ? c.phones : (c.phone_2 ? [c.phone_2] : []))]
      .filter(Boolean).map(n => `+91 ${n}`);
    const phone = nums.join(' / ');
    return `<div class="label">
      <div class="lname">${esc(name)}</div>
      <div class="laddr">${esc(address)}</div>
      <div class="lphone">${esc(phone)}</div>
    </div>`;
  }).join('');

  return `<html><head><title>Mailing Labels</title><style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; }
    /* One 75x50mm label per page — for a roll / label printer */
    @page { size: 75mm 50mm; margin: 0; }
    .label {
      width: 75mm; height: 50mm; padding: 4mm 5mm; overflow: hidden;
      display: flex; flex-direction: column; justify-content: center;
      page-break-after: always; break-after: page;
    }
    .label:last-child { page-break-after: auto; break-after: auto; }
    .lname { font-weight: bold; font-size: 12pt; line-height: 1.2; }
    .laddr { font-size: 10pt; line-height: 1.3; margin-top: 2mm; }
    .lphone { font-size: 10pt; margin-top: 2mm; }
  </style></head><body>${labels}</body></html>`;
};

/**
 * Opens a print window for the given contacts.
 * Returns null on success, or an error message for the caller to surface.
 *
 * A real window, not an iframe: Chrome ignores an iframe's @page size and
 * falls back to A4, which is what broke the roll-printer output before.
 */
export const printLabels = (contacts) => {
  if (!contacts || contacts.length === 0) return 'No entries to print labels for.';

  const win = window.open('', '_blank', 'width=420,height=600');
  if (!win) return 'Please allow pop-ups for this site to print labels.';

  win.document.open();
  win.document.write(labelHtml(contacts));
  win.document.close();
  win.focus();
  win.onafterprint = () => win.close();
  setTimeout(() => win.print(), 350);
  return null;
};
