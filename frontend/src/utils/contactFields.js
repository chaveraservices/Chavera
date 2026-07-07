// Single source of truth for the Excel <-> Contact mapping used by both
// the Import page (read) and the Directory export (write).
//
// - key:     the Contact field name in the database
// - label:   the canonical Excel column header
// - aliases: alternate headers accepted on import
// - numeric: value is coerced to string on import (phone numbers, etc.)
// - list:    value is an array of strings (stored/exported comma-separated)
// - date:    value is a date

// Products offered (client-provided list). "Other" is handled via free text.
export const PRODUCT_OPTIONS = [
  'Cot', 'Mattresses', 'Sofa set', 'Dining Set',
  'Office Chair', 'Office Table', 'Pillows', 'FibreChairs',
];

export const CUSTOMER_GRADES = ['Low Potential', 'Potential', 'High Potential'];
export const HOUSE_TYPES = ['Own', 'Rented'];
export const PURCHASE_TYPES = ['Finance', 'Cash'];

// Import mapping — one entry per DB field.
export const contactFields = [
  { key: 'honorific',      label: 'Honorific',      aliases: [] },
  { key: 'full_name',      label: 'Full Name',      aliases: ['Name'] },
  { key: 'relation',       label: 'Relation',       aliases: [] },
  { key: 'business_name',  label: 'Business Name',  aliases: [] },
  { key: 'age',            label: 'Age',            aliases: [] },
  { key: 'instagram_id',   label: 'Insta Id',       aliases: ['Insta id', 'Instagram', 'Instagram Id'] },
  { key: 'category',       label: 'Category',       aliases: [] },
  { key: 'customer_grade', label: 'Customer Grade', aliases: ['Type of Customer', 'Grade'] },
  { key: 'house_type',     label: 'Type of House',  aliases: ['House Type'] },
  { key: 'purchase_type',  label: 'Type of Purchase', aliases: ['Purchase Type'] },
  { key: 'products',       label: 'Products',       aliases: ['Product List', 'Product'], list: true },
  { key: 'contact_date',   label: 'Date',           aliases: [], date: true },
  { key: 'phone_1',        label: 'Phone 1',        aliases: ['Phone', 'Phone no', 'Phone No'], numeric: true },
  { key: 'phone_2',        label: 'Phone 2',        aliases: [], numeric: true },
  { key: 'door_flat_no',   label: 'Door Flat No',   aliases: [] },
  { key: 'street',         label: 'Street',         aliases: ['Address'] },
  { key: 'landmark',       label: 'Landmark',       aliases: [] },
  { key: 'village_town',   label: 'Village Town',   aliases: ['City', 'Town'] },
  { key: 'mandal',         label: 'Mandal',         aliases: [] },
  { key: 'district',       label: 'District',       aliases: [] },
  { key: 'state',          label: 'State',          aliases: [] },
  { key: 'pincode',        label: 'Pincode',        aliases: [] },
  { key: 'notes',          label: 'Notes',          aliases: [] },
];

// Look up a cell value from an Excel row by trying the label, the db key,
// and any aliases (each in original and lowercase form).
function pickCell(row, field) {
  const candidates = [field.label, field.key, ...field.aliases];
  for (const name of candidates) {
    if (row[name] != null && row[name] !== '') return row[name];
    const lower = name.toLowerCase();
    if (row[lower] != null && row[lower] !== '') return row[lower];
  }
  return null;
}

// Map a raw parsed Excel row to a Contact object.
export function rowToContact(row) {
  const contact = {};
  for (const field of contactFields) {
    const value = pickCell(row, field);
    if (field.list) {
      contact[field.key] = value != null
        ? String(value).split(/[,;\n]/).map(s => s.trim()).filter(Boolean)
        : [];
    } else if (field.date) {
      contact[field.key] = value != null && value !== '' ? new Date(value).toISOString() : null;
    } else if (field.numeric) {
      contact[field.key] = value != null ? value.toString() : '';
    } else {
      contact[field.key] = value != null ? value : null;
    }
  }
  return contact;
}

// dd/mm/yyyy for display/export; falls back to the auto createdAt date.
function formatDate(contact) {
  const d = contact.contact_date || contact.createdAt;
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt) ? '' : dt.toLocaleDateString('en-GB');
}

function composeAddress(c) {
  return [c.door_flat_no, c.street, c.landmark].filter(Boolean).join(', ');
}

// Export rows matching the client's requested data-sheet columns (in order).
export function contactsToExportRows(contacts) {
  return contacts.map((c, i) => ({
    'S.No': i + 1,
    'Date': formatDate(c),
    'Name': c.full_name || '',
    'Age': c.age || '',
    'Address': composeAddress(c),
    'Town': c.village_town || '',
    'State': c.state || '',
    'Phone no': c.phone_1 || '',
    'Phone 2': c.phone_2 || '',
    'Insta id': c.instagram_id || '',
    'Type of House': c.house_type || '',
    'Type of Purchase': c.purchase_type || '',
    'Type of Customer': c.customer_grade || '',
    'Category': c.category || '',
    'Products': Array.isArray(c.products) ? c.products.join(', ') : (c.products || ''),
    'Business Name': c.business_name || '',
    'District': c.district || '',
    'Pincode': c.pincode || '',
    'Notes': c.notes || '',
  }));
}
