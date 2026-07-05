// Single source of truth for the Excel <-> Contact mapping used by both
// the Import page (read) and the Directory export (write).
//
// - key:     the Contact field name in the database
// - label:   the canonical Excel column header (used when exporting)
// - aliases: alternate headers accepted on import
// - numeric: value is coerced to string on import (phone numbers, etc.)

export const contactFields = [
  { key: 'honorific',     label: 'Honorific',     aliases: [] },
  { key: 'full_name',     label: 'Full Name',     aliases: ['Name'] },
  { key: 'relation',      label: 'Relation',      aliases: [] },
  { key: 'business_name', label: 'Business Name', aliases: [] },
  { key: 'category',      label: 'Category',      aliases: [] },
  { key: 'phone_1',       label: 'Phone 1',       aliases: ['Phone'], numeric: true },
  { key: 'phone_2',       label: 'Phone 2',       aliases: [],        numeric: true },
  { key: 'door_flat_no',  label: 'Door Flat No',  aliases: [] },
  { key: 'street',        label: 'Street',        aliases: [] },
  { key: 'landmark',      label: 'Landmark',      aliases: [] },
  { key: 'village_town',  label: 'Village Town',  aliases: ['City'] },
  { key: 'mandal',        label: 'Mandal',        aliases: [] },
  { key: 'district',      label: 'District',      aliases: [] },
  { key: 'state',         label: 'State',         aliases: [] },
  { key: 'pincode',       label: 'Pincode',       aliases: [] },
  { key: 'notes',         label: 'Notes',         aliases: [] },
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
    if (field.numeric) {
      contact[field.key] = value != null ? value.toString() : '';
    } else {
      contact[field.key] = value != null ? value : null;
    }
  }
  return contact;
}

// Map Contact records to export rows keyed by their canonical Excel labels.
export function contactsToExportRows(contacts) {
  return contacts.map(c =>
    Object.fromEntries(contactFields.map(f => [f.label, c[f.key] || '']))
  );
}
