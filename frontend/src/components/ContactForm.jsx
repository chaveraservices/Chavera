import { useState, useEffect, useRef } from 'react';
import { X, Plus, ChevronDown } from 'lucide-react';
import CustomSelect from './CustomSelect';
import ConfirmEntryModal from './ConfirmEntryModal';
import api from '../utils/api';
import { CUSTOMER_GRADES, HOUSE_TYPES, PURCHASE_TYPES, gradeSymbol, GRADE_LEGEND } from '../utils/contactFields';
import { entryCode } from '../utils/series';
import useDebounce from '../utils/useDebounce';

// Local YYYY-MM-DD (native date input format), never UTC-shifted.
const todayISO = () => {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};
const pad2 = (n) => String(n).padStart(2, '0');
const daysInMonth = (y, m) => new Date(y, m, 0).getDate(); // m is 1-12

// Step ONE segment of an ISO date (YYYY-MM-DD) with cascading rollover:
//  - day:   past the month's last day rolls into the next month (and year);
//  - month: past December rolls into January of the next year;
//  - year:  just moves the year, clamping the day (e.g. 29 Feb → 28 Feb).
const stepSegment = (iso, seg, delta) => {
  const base = iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso : todayISO();
  let [y, m, d] = base.split('-').map(Number);

  if (seg === 'd') {
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + delta);   // Date arithmetic cascades month + year
    return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
  }
  if (seg === 'm') {
    m += delta;
    while (m > 12) { m -= 12; y += 1; }
    while (m < 1) { m += 12; y -= 1; }
  } else {
    y += delta;
  }
  d = Math.min(d, daysInMonth(y, m));   // keep the day valid for the new month
  return `${y}-${pad2(m)}-${pad2(d)}`;
};

// Segmented DD / MM / YYYY field. Replaces the native date input so ↑/↓ can act
// on the focused segment with proper rollover (native arrows don't cascade).
function DateField({ value, onChange }) {
  const valid = value && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const [seg, setSeg] = useState(() => {
    if (valid) { const [y, m, d] = value.split('-'); return { d, m, y }; }
    return { d: '', m: '', y: '' };
  });
  const mRef = useRef(null);
  const yRef = useRef(null);

  // Reflect external changes (arrow step, "defaults to today", edit-load).
  useEffect(() => {
    if (valid) { const [y, m, d] = value.split('-'); setSeg({ d, m, y }); }
    else setSeg({ d: '', m: '', y: '' });
  }, [value, valid]);

  const emit = (next) => {
    const { d, m, y } = next;
    if (d && m && y && y.length === 4) {
      const yi = +y, mi = +m, di = +d;
      if (mi >= 1 && mi <= 12 && di >= 1) {
        onChange(`${yi}-${pad2(mi)}-${pad2(Math.min(di, daysInMonth(yi, mi)))}`);
      }
    }
  };

  const onType = (key, len, nextRef) => (e) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, len);
    const next = { ...seg, [key]: digits };
    setSeg(next);
    emit(next);
    if (digits.length === len && nextRef) nextRef.current?.focus();
  };

  const onArrow = (key) => (e) => {
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(stepSegment(value || todayISO(), key, e.key === 'ArrowUp' ? 1 : -1));
    }
  };

  return (
    <div className="date-field input-field">
      <input className="date-seg" placeholder="DD" inputMode="numeric" maxLength={2} aria-label="Day"
        value={seg.d} onChange={onType('d', 2, mRef)} onKeyDown={onArrow('d')} />
      <span className="date-sep">/</span>
      <input ref={mRef} className="date-seg" placeholder="MM" inputMode="numeric" maxLength={2} aria-label="Month"
        value={seg.m} onChange={onType('m', 2, yRef)} onKeyDown={onArrow('m')} />
      <span className="date-sep">/</span>
      <input ref={yRef} className="date-seg date-seg-year" placeholder="YYYY" inputMode="numeric" maxLength={4} aria-label="Year"
        value={seg.y} onChange={onType('y', 4, null)} onKeyDown={onArrow('y')} />
    </div>
  );
}
// Remembers the last date used, so a batch of entries for one day only needs the
// date set once. Cleared implicitly by defaulting to today on the first entry.
const LAST_DATE_KEY = 'chavera_last_entry_date';
import useProducts from '../utils/useProducts';
import { useAuth } from '../context/AuthContext';

// ---------- validation rules ----------
const RULES = {
  full_name: (v) => {
    if (!v.trim()) return 'Full Name is required.';
    if (v.trim().length < 2) return 'Full Name must be at least 2 characters.';
    if (v.trim().length > 120) return 'Full Name cannot exceed 120 characters.';
    return '';
  },
  village_town: (v) => {
    if (!v.trim()) return 'Village / Town is required.';
    if (v.trim().length > 100) return 'Village / Town cannot exceed 100 characters.';
    return '';
  },
  phone_1: (v) => {
    if (!v) return 'Phone 1 is required.';
    if (!/^\d{10}$/.test(v)) return 'Phone 1 must be exactly 10 digits.';
    return '';
  },
  pincode: (v) => {
    if (!v) return ''; // optional
    if (!/^\d{6}$/.test(v)) return 'Pincode must be exactly 6 digits.';
    return '';
  },
  business_name: (v) => {
    if (v.length > 150) return 'Business name cannot exceed 150 characters.';
    return '';
  },
  notes: (v) => {
    if (v.length > 500) return 'Notes cannot exceed 500 characters.';
    return '';
  },
};

function validate(name, value, allValues) {
  const rule = RULES[name];
  return rule ? rule(value, allValues) : '';
}

function validateAll(data) {
  const errs = {};
  Object.keys(RULES).forEach((field) => {
    const msg = validate(field, data[field] || '', data);
    if (msg) errs[field] = msg;
  });
  return errs;
}

// ---------- component ----------
export default function ContactForm({ contact, onCancel, onSave, onClose, onCancelBill }) {
  const { products: productCatalogue, addProduct } = useProducts();
  const { user } = useAuth();
  const canAddProduct = (user?.role || 'admin') === 'admin';

  // Inline "add a product" state, so a new product can be created without
  // leaving the form. Creation is admin-only (the API enforces it).
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [addProductErr, setAddProductErr] = useState('');
  const [addingProduct, setAddingProduct] = useState(false);
  // Quantity editors collapse behind a toggle once more than two products are
  // picked, so the section never grows unwieldy.
  const [showQtys, setShowQtys] = useState(false);

  // The read-only entry code (e.g. "2026-1"). It is DATE-DERIVED — the entry's
  // rank within its year — so it previews live as the Date (and Name, for
  // same-day ties) change, and is finalised on save.
  const [previewCode, setPreviewCode] = useState(entryCode(contact));

  const submitNewProduct = async () => {
    setAddingProduct(true);
    setAddProductErr('');
    const res = await addProduct(newProductName);
    setAddingProduct(false);
    if (!res.ok) { setAddProductErr(res.error); return; }
    // Auto-select the product just added, and reset the inline input.
    if (!formData.products.includes(res.name)) {
      setFormData(prev => ({ ...prev, products: [...prev.products, res.name] }));
    }
    setNewProductName('');
    setShowAddProduct(false);
  };
  const [formData, setFormData] = useState({
    series_code: contact?.series_code || '',
    honorific: contact?.honorific || '',
    full_name: contact?.full_name || '',
    business_name: contact?.business_name || '',
    ppr: contact?.ppr || '',
    toq: contact?.toq || '',
    instagram_id: contact?.instagram_id || '',
    customer_occupation: contact?.customer_occupation || '',
    door_flat_no: contact?.door_flat_no || '',
    street: contact?.street || '',
    landmark: contact?.landmark || '',
    village_town: contact?.village_town || '',
    mandal: contact?.mandal || '',
    district: contact?.district || '',
    state: contact?.state || '',
    pincode: contact?.pincode || '',
    phone_1: contact?.phone_1 || '',
    phones: Array.isArray(contact?.phones) && contact.phones.length
      ? contact.phones.map(String)
      : (contact?.phone_2 ? [String(contact.phone_2)] : []),
    category: contact?.category || '',
    customer_grade: contact?.customer_grade || '',
    house_type: contact?.house_type || '',
    purchase_type: contact?.purchase_type || '',
    products: Array.isArray(contact?.products) ? contact.products : [],
    // Per-product quantity, keyed by product name. Absent key = quantity 1.
    product_quantities: contact?.product_quantities ? { ...contact.product_quantities } : {},
    // #1/#2: a new entry defaults to the last date used (or today for the very
    // first). Editing an existing entry keeps that entry's own date.
    contact_date: contact?.contact_date
      ? String(contact.contact_date).slice(0, 10)
      : (contact ? '' : (localStorage.getItem(LAST_DATE_KEY) || todayISO())),
    notes: contact?.notes || ''
  });

  // Tracks which fields the user has interacted with (blur / change)
  const [touched, setTouched] = useState({});
  // Inline field errors
  const [fieldErrors, setFieldErrors] = useState({});
  // Server-level error banner
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false); // review step before save

  // Locations — states + district NAMES only (cities are lazy-loaded per district
  // so the form never ships the full 150k-city dataset).
  const [locations, setLocations] = useState([]); // [{ state, districts: [name] }]
  const [locLoading, setLocLoading] = useState(true);

  useEffect(() => {
    api.post('/location/states-districts')
      .then(res => { if (res.data.success) setLocations(res.data.data); })
      .catch(() => {})
      .finally(() => setLocLoading(false));
  }, []);

  // Live preview of the date-derived entry code. Debounced on the Date + Name
  // (Name only matters as a same-day tie-break), and excludes this entry itself
  // when editing so it doesn't count against its own rank.
  const previewKey = useDebounce(
    `${formData.contact_date || ''}|${(formData.full_name || '').trim().toLowerCase()}`,
    400
  );
  useEffect(() => {
    let cancelled = false;
    api.post('/contact/entry-no-preview', {
      contact_date: formData.contact_date || undefined,
      full_name: formData.full_name || '',
      id: contact?._id,
    })
      .then(res => { if (!cancelled && res.data.success) setPreviewCode(res.data.data.code); })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, contact]);

  // Cascading lists (districts are plain name strings now)
  const availableDistricts = locations.find(l => l.state === formData.state)?.districts || [];

  // True once the user has typed a business name of their own, which stops it
  // mirroring the full name. Seeded true when editing a contact whose business
  // name already differs, so opening an old record never rewrites it.
  const businessTouchedRef = useRef(
    !!(contact?.business_name && contact.business_name !== contact.full_name)
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    let next;
    if (name === 'state') {
      next = { ...formData, state: value, district: '', village_town: '' };
    } else if (name === 'district') {
      next = { ...formData, district: value, village_town: '' };
    } else if (['phone_1', 'pincode'].includes(name)) {
      next = { ...formData, [name]: value.replace(/\D/g, '') };
    } else if (name === 'full_name') {
      // #9: business name follows the full name by default. Once the user
      // types their own business name it stops mirroring, so a deliberate
      // value is never overwritten by later edits to the name.
      next = { ...formData, full_name: value };
      if (!businessTouchedRef.current) next.business_name = value;
    } else {
      next = { ...formData, [name]: value };
      // Typing in Business Name breaks the mirror for good.
      if (name === 'business_name') businessTouchedRef.current = true;
    }

    setFormData(next);

    // Validate on change (only for touched fields)
    if (touched[name]) {
      setFieldErrors(prev => ({
        ...prev,
        [name]: validate(name, next[name], next),
      }));
    }
  };

  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched(prev => ({ ...prev, [name]: true }));
    setFieldErrors(prev => ({
      ...prev,
      [name]: validate(name, formData[name] || '', formData),
    }));
  };

  const [phonesError, setPhonesError] = useState('');
  const [pincodeAutofilled, setPincodeAutofilled] = useState(false);
  const [pincodeLoading, setPincodeLoading] = useState(false);

  // #7: auto-fill pincode from the location. The server checks the India Post
  // directory first, then falls back to pincodes previously entered here for
  // the same village. Only fills when pincode is empty, so a manual value is
  // never overwritten.
  const lookupPincode = async () => {
    const town = (formData.village_town || '').trim();
    if (!town || formData.pincode) return;
    setPincodeLoading(true);
    try {
      const res = await api.post('/contact/pincode-suggestion', {
        village_town: town, district: formData.district, state: formData.state,
      });
      const pin = res.data?.data?.pincode;
      if (pin) {
        // Re-check pincode is still empty (user may have typed meanwhile).
        setFormData(prev => (prev.pincode ? prev : { ...prev, pincode: pin }));
        setPincodeAutofilled(true);
      }
    } catch { /* silent — pincode stays manual */ }
    finally { setPincodeLoading(false); }
  };
  const addPhone = () => setFormData(prev => ({ ...prev, phones: [...prev.phones, ''] }));
  const updatePhone = (idx, val) => setFormData(prev => {
    const phones = [...prev.phones];
    phones[idx] = val.replace(/\D/g, '').slice(0, 10);
    return { ...prev, phones };
  });
  const removePhone = (idx) => setFormData(prev => ({ ...prev, phones: prev.phones.filter((_, i) => i !== idx) }));

  // CustomSelect doesn't fire blur events — mark as touched on change
  const handleSelectChange = (e) => {
    const { name } = e.target;
    handleChange(e);
    setTouched(prev => ({ ...prev, [name]: true }));
  };

  // Toggle a product in the multi-select list. Dropping a product also drops
  // any quantity it carried, so stale quantities never get saved.
  const toggleProduct = (product) => {
    setFormData(prev => {
      const has = prev.products.includes(product);
      const nextQty = { ...prev.product_quantities };
      if (has) delete nextQty[product];
      return {
        ...prev,
        products: has ? prev.products.filter(p => p !== product) : [...prev.products, product],
        product_quantities: nextQty,
      };
    });
  };

  // Set a product's quantity. No upper limit — the client wanted to enter very
  // large counts. Quantity 1 (or blank) is the default, so it isn't stored.
  const setQty = (product, raw) => {
    const digits = String(raw).replace(/\D/g, '').slice(0, 9);
    setFormData(prev => {
      const next = { ...prev.product_quantities };
      const n = parseInt(digits, 10);
      if (!Number.isFinite(n) || n <= 1) delete next[product];
      else next[product] = n;
      return { ...prev, product_quantities: next };
    });
  };

  // Field status for styling
  const fieldState = (name) => {
    if (!touched[name]) return '';
    if (fieldErrors[name]) return 'error';
    // Only call a field "valid" once it actually holds something. Without this
    // an empty optional field turns green the moment Save marks everything
    // touched — and Business Name lit up green while still showing its
    // placeholder, purely because Full Name had been mirrored into it.
    const v = formData[name];
    const filled = Array.isArray(v) ? v.length > 0 : String(v ?? '').trim() !== '';
    if (RULES[name] && filled) return 'success';
    return '';
  };

  const inputStyle = (name) => {
    const s = fieldState(name);
    return {
      borderColor: s === 'error' ? 'var(--danger)' : s === 'success' ? '#16A34A' : undefined,
      boxShadow: s === 'error'
        ? '0 0 0 2px rgba(220,38,38,0.15)'
        : s === 'success'
        ? '0 0 0 2px rgba(22,163,74,0.12)'
        : undefined,
    };
  };

  const FieldError = ({ name }) =>
    touched[name] && fieldErrors[name] ? (
      <span style={{ color: 'var(--danger)', fontSize: '0.78rem', marginTop: 4, display: 'block' }}>
        ⚠ {fieldErrors[name]}
      </span>
    ) : null;

  const FieldHint = ({ children }) => (
    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4, display: 'block' }}>
      {children}
    </span>
  );

  // #13 Save is a two-step commit: validate, show the user exactly what will
  // be written, then persist only after they confirm.
  const handleSubmit = (e) => {
    e.preventDefault();
    setServerError('');

    // Mark all validated fields as touched
    const allTouched = Object.keys(RULES).reduce((acc, k) => ({ ...acc, [k]: true }), {});
    setTouched(prev => ({ ...prev, ...allTouched }));

    // Full client-side validation sweep
    const errors = validateAll(formData);
    setFieldErrors(errors);

    // Additional numbers: each non-blank one must be 10 digits.
    const badPhone = formData.phones.some(p => p && !/^\d{10}$/.test(p));
    if (badPhone) { setPhonesError('Each additional number must be exactly 10 digits.'); }

    if (Object.keys(errors).length > 0 || badPhone) {
      setServerError('Please fix the errors highlighted below before saving.');
      setTimeout(() => {
        const el = document.querySelector('.input-error-field');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }

    setConfirming(true);
  };

  // Runs after the user confirms in the review modal.
  const handleConfirmedSave = async () => {
    setLoading(true);
    // Drop blank additional numbers; keep phone_2 populated from the first
    // extra so existing label / export / detail code (which reads phone_2)
    // keeps showing a second number.
    const phones = formData.phones.map(p => p.trim()).filter(Boolean);
    // Only keep quantities (>1) for products that are actually selected.
    const product_quantities = {};
    for (const p of formData.products) {
      const q = parseInt(formData.product_quantities[p], 10);
      if (Number.isFinite(q) && q > 1) product_quantities[p] = q;
    }
    const payload = {
      ...formData,
      full_name: formData.full_name.trim(),
      village_town: formData.village_town.trim(),
      business_name: (formData.business_name || '').trim(),
      phones,
      phone_2: phones[0] || '',
      product_quantities,
    };

    try {
      if (contact && contact._id) {
        await api.post('/contact/update', { id: contact._id, ...payload });
      } else {
        await api.post('/contact/insert', payload);
      }
      // Remember the date so the next new entry defaults to it (#2).
      if (payload.contact_date) localStorage.setItem(LAST_DATE_KEY, payload.contact_date);
      onSave();
    } catch (err) {
      // Drop back to the form so the error is visible next to the fields.
      setConfirming(false);
      setServerError(err.response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // #12 Keyboard-first: Enter moves to the next field instead of submitting,
  // so a whole entry can be typed without touching the mouse. Enter only
  // submits from the last control; Ctrl/Cmd+Enter submits from anywhere.
  // Textareas keep Enter for newlines.
  const handleFormKeyDown = (e) => {
    if (e.key !== 'Enter') return;
    const el = e.target;
    const tag = (el.tagName || '').toLowerCase();

    if ((e.ctrlKey || e.metaKey)) { e.preventDefault(); handleSubmit(e); return; }
    if (tag === 'textarea' || el.type === 'submit' || el.type === 'button') return;
    // On a product checkbox, Enter toggles it (and stays put) so you can pick
    // several by keyboard — instead of jumping to the next field.
    if (el.type === 'checkbox') { e.preventDefault(); el.click(); return; }

    const focusables = Array.from(
      e.currentTarget.querySelectorAll('input, select, textarea, [data-kbd-focusable]')
    ).filter(n => !n.disabled && n.tabIndex !== -1 && n.offsetParent !== null);

    const i = focusables.indexOf(el);
    if (i === -1) return;
    e.preventDefault();
    if (i < focusables.length - 1) focusables[i + 1].focus();
    else handleSubmit(e);   // last field: Enter saves
  };

  // Character count helpers
  const notesLeft = 500 - (formData.notes?.length || 0);
  const businessLeft = 150 - (formData.business_name?.length || 0);

  return (
    <div className="entry-form-inner">
      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} noValidate>
        <div className="form-header-flex entry-form-head">
          <h1>{contact ? 'Edit Entry' : 'New Entry'}</h1>
          {onClose && (
            <button type="button" className="entry-icon-btn" onClick={onClose} title="Close">
              <X size={20} />
            </button>
          )}
        </div>

        {serverError && (
          <div style={{ padding: '12px 16px', background: '#3B1A1A', color: 'var(--danger)', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.1rem' }}>⚠</span>
            {serverError}
          </div>
        )}

        {/* ENTRY — the auto code: a letter for the year (A, B, C…) + the entry's
            rank within that year, by date. e.g. "A-1". */}
        <div className="form-section">
          <div className="form-section-title">ENTRY</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Entry No</label>
              <div className="input-field is-readonly">{previewCode || '—'}</div>
              <FieldHint>
                {contact
                  ? 'Auto: year letter + the entry’s position in that year, by date.'
                  : 'Auto by date — year letter + rank; resets each year. Confirmed on save.'}
              </FieldHint>
            </div>
          </div>
        </div>

        {/* NAME */}
        <div className="form-section">
          <div className="form-section-title">NAME</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Honorific</label>
              <CustomSelect
                name="honorific"
                value={formData.honorific}
                onChange={handleSelectChange}
                options={[
                  { label: 'None', value: '' },
                  { label: 'Mr.', value: 'Mr.' },
                  { label: 'Ms.', value: 'Ms.' },
                  { label: 'Mrs.', value: 'Mrs.' },
                  { label: 'Dr.', value: 'Dr.' },
                  { label: 'Prof.', value: 'Prof.' },
                ]}
                placeholder="Select"
                autoOpen={!contact}
              />
            </div>

            <div className="form-group">
              <label>Full Name <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`input-field ${fieldState('full_name') === 'error' ? 'input-error-field' : ''}`}
                placeholder="Enter full name"
                maxLength={120}
                style={inputStyle('full_name')}
              />
              <FieldError name="full_name" />
              {!fieldErrors.full_name && touched.full_name && formData.full_name.trim() && (
                <FieldHint>{120 - formData.full_name.length} chars remaining</FieldHint>
              )}
            </div>


            <div className="form-group">
              <label>
                Business Name
                {touched.business_name && !fieldErrors.business_name && formData.business_name && (
                  <span style={{ float: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                    {businessLeft} left
                  </span>
                )}
              </label>
              <input
                name="business_name"
                value={formData.business_name}
                onChange={handleChange}
                onBlur={handleBlur}
                // #3: select all on focus. Business name mirrors the full name,
                // so selecting it lets one Backspace clear it before typing the
                // real business name — or Tab straight past to keep it.
                onFocus={(e) => e.target.select()}
                className={`input-field ${fieldState('business_name') === 'error' ? 'input-error-field' : ''}`}
                placeholder="Enter business name"
                maxLength={150}
                style={inputStyle('business_name')}
              />
              <FieldError name="business_name" />
            </div>

            <div className="form-group">
              <label>PPR</label>
              <CustomSelect
                name="ppr"
                value={formData.ppr}
                onChange={handleSelectChange}
                options={[
                  { label: 'None', value: '' },
                  { label: 'PPR 1', value: 'PPR 1' },
                  { label: 'PPR 2', value: 'PPR 2' },
                ]}
                placeholder="Select PPR..."
              />
            </div>

            <div className="form-group">
              <label>TOQ</label>
              <CustomSelect
                name="toq"
                value={formData.toq}
                onChange={handleSelectChange}
                options={[
                  { label: 'None', value: '' },
                  { label: 'TOQ 1', value: 'TOQ 1' },
                  { label: 'TOQ 2', value: 'TOQ 2' },
                ]}
                placeholder="Select TOQ..."
              />
            </div>

            <div className="form-group">
              <label>Instagram ID</label>
              <input
                name="instagram_id"
                value={formData.instagram_id}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`input-field ${fieldState('instagram_id') === 'error' ? 'input-error-field' : ''}`}
                placeholder="Enter Instagram ID"
                style={inputStyle('instagram_id')}
              />
            </div>


            <div className="form-group">
              <label>Customer Occupation</label>
              <input
                name="customer_occupation"
                value={formData.customer_occupation}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`input-field ${fieldState('customer_occupation') === 'error' ? 'input-error-field' : ''}`}
                placeholder="Enter Occupation"
                style={inputStyle('customer_occupation')}
              />
            </div>
          </div>
        </div>

        {/* ADDRESS */}
        <div className="form-section">
          <div className="form-section-title">ADDRESS</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Door / Flat No.</label>
              <input name="door_flat_no" value={formData.door_flat_no} onChange={handleChange} className="input-field" placeholder="e.g. 12B, Flat 301" />
            </div>
            <div className="form-group">
              <label>Street</label>
              <input name="street" value={formData.street} onChange={handleChange} className="input-field" placeholder="Enter street / area" />
            </div>
            <div className="form-group">
              <label>Landmark</label>
              <input name="landmark" value={formData.landmark} onChange={handleChange} className="input-field" placeholder="Near school, temple…" />
            </div>

            {/* STATE */}
            <div className="form-group">
              <label>State</label>
              {locLoading ? (
                <input className="input-field" disabled placeholder="Loading states…" />
              ) : (
                <CustomSelect
                  name="state"
                  value={formData.state}
                  onChange={handleSelectChange}
                  options={[
                    { label: 'Select State', value: '' },
                    ...locations.map(l => ({ label: l.state, value: l.state }))
                  ]}
                  placeholder="Select State"
                />
              )}
            </div>

            {/* DISTRICT */}
            <div className="form-group">
              <label>District</label>
              {locLoading ? (
                <input className="input-field" disabled placeholder="Loading…" />
              ) : !formData.state ? (
                <CustomSelect disabled placeholder="Select a state first" options={[]} />
              ) : availableDistricts.length === 0 ? (
                <>
                  <input
                    name="district"
                    value={formData.district}
                    onChange={handleChange}
                    className="input-field"
                    placeholder="Type district name"
                  />
                  <FieldHint>No districts configured — type manually</FieldHint>
                </>
              ) : (
                <CustomSelect
                  name="district"
                  value={formData.district}
                  onChange={handleSelectChange}
                  options={[
                    { label: 'Select District', value: '' },
                    ...availableDistricts.map(d => ({ label: d, value: d }))
                  ]}
                  placeholder="Select District"
                />
              )}
            </div>

            <div className="form-group">
              <label>Mandal</label>
              <input name="mandal" value={formData.mandal} onChange={handleChange} className="input-field" placeholder="Enter mandal" />
            </div>

            {/* VILLAGE / TOWN */}
            <div className="form-group">
              <label>
                Village / Town <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              {/* Plain text input (no dropdown) per client request — the client
                  works in tiny villages that aren't in any list anyway. */}
              <input
                name="village_town"
                value={formData.village_town}
                onChange={handleChange}
                onBlur={(e) => { handleBlur(e); lookupPincode(); }}
                placeholder="Type any village / town…"
                required
                className={`input-field ${fieldState('village_town') === 'error' ? 'input-error-field' : ''}`}
                style={inputStyle('village_town')}
              />
              <FieldError name="village_town" />
            </div>

            <div className="form-group">
              <label>Pincode</label>
              <input
                name="pincode"
                value={formData.pincode}
                onChange={(e) => { handleChange(e); setPincodeAutofilled(false); }}
                onBlur={handleBlur}
                className={`input-field ${fieldState('pincode') === 'error' ? 'input-error-field' : ''}`}
                placeholder="6-digit pincode"
                maxLength={6}
                inputMode="numeric"
                style={inputStyle('pincode')}
              />
              <FieldError name="pincode" />
              {pincodeLoading && <FieldHint>Looking up pincode…</FieldHint>}
              {!pincodeLoading && pincodeAutofilled && formData.pincode && (
                <FieldHint>Auto-filled from the location — edit if needed.</FieldHint>
              )}
              {!pincodeLoading && !fieldErrors.pincode && !formData.pincode && !pincodeAutofilled && (
                <FieldHint>Fills in automatically from the state / district / village.</FieldHint>
              )}
            </div>
          </div>
        </div>

        {/* CLASSIFICATION & PRODUCTS */}
        <div className="form-section">
          <div className="form-section-title">CLASSIFICATION &amp; PRODUCTS</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Date</label>
              <DateField
                value={formData.contact_date}
                onChange={(iso) => setFormData(prev => ({ ...prev, contact_date: iso }))}
              />
              <FieldHint>Defaults to today. On any segment use ↑ / ↓ — day rolls into the next month, month past December bumps the year, and the year steps on its own.</FieldHint>
            </div>

            <div className="form-group">
              <label>Type of Customer (Grade)</label>
              <CustomSelect
                name="customer_grade"
                value={formData.customer_grade}
                onChange={handleSelectChange}
                options={[
                  { label: 'None', value: '' },
                  ...CUSTOMER_GRADES.map(g => ({ label: gradeSymbol(g), value: g })),
                ]}
                placeholder="Select grade"
              />
              <FieldHint>{GRADE_LEGEND}</FieldHint>
            </div>

            <div className="form-group">
              <label>Type of House</label>
              <CustomSelect
                name="house_type"
                value={formData.house_type}
                onChange={handleSelectChange}
                options={[
                  { label: 'None', value: '' },
                  ...HOUSE_TYPES.map(h => ({ label: h, value: h })),
                ]}
                placeholder="Own / Rented"
              />
            </div>

            <div className="form-group">
              <label>Type of Purchase</label>
              <CustomSelect
                name="purchase_type"
                value={formData.purchase_type}
                onChange={handleSelectChange}
                options={[
                  { label: 'None', value: '' },
                  ...PURCHASE_TYPES.map(p => ({ label: p, value: p })),
                ]}
                placeholder="Finance / Cash"
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Products <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>(select all that apply)</span></label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                {productCatalogue.map(p => {
                  const checked = formData.products.includes(p);
                  return (
                    <label
                      key={p}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 12px', borderRadius: 999, cursor: 'pointer',
                        fontSize: '0.85rem',
                        border: `1px solid ${checked ? 'var(--primary-accent)' : 'var(--border-color)'}`,
                        background: checked ? 'var(--highlight)' : 'var(--bg-white)',
                        color: checked ? 'var(--primary-accent)' : 'var(--text-dark)',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleProduct(p)}
                        style={{ accentColor: 'var(--primary-accent)' }}
                      />
                      {p}
                    </label>
                  );
                })}

                {/* Inline add — admins can create a product without opening
                    Settings. Shows as a "+ Add" pill until clicked. */}
                {canAddProduct && !showAddProduct && (
                  <button
                    type="button"
                    onClick={() => { setShowAddProduct(true); setAddProductErr(''); }}
                    className="product-add-pill"
                    title="Add a new product"
                  >
                    <Plus size={14} /> Add
                  </button>
                )}
                {canAddProduct && showAddProduct && (
                  <span className="product-add-inline">
                    <input
                      autoFocus
                      value={newProductName}
                      maxLength={60}
                      placeholder="New product"
                      onChange={(e) => setNewProductName(e.target.value)}
                      onKeyDown={(e) => {
                        // Enter adds; Esc cancels. stopPropagation so the form's
                        // Enter-advances-field handler doesn't also fire.
                        if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); submitNewProduct(); }
                        if (e.key === 'Escape') { e.preventDefault(); setShowAddProduct(false); setNewProductName(''); setAddProductErr(''); }
                      }}
                    />
                    <button type="button" className="entry-icon-btn" onClick={submitNewProduct} disabled={addingProduct || !newProductName.trim()} title="Add">
                      <Plus size={16} />
                    </button>
                    <button type="button" className="entry-icon-btn" onClick={() => { setShowAddProduct(false); setNewProductName(''); setAddProductErr(''); }} title="Cancel">
                      <X size={16} />
                    </button>
                  </span>
                )}
              </div>
              {addProductErr && (
                <div style={{ color: 'var(--danger)', fontSize: '0.78rem', marginTop: 6 }}>{addProductErr}</div>
              )}

              {/* Quantity per selected product. Inline for 1–2 products; once
                  more than two are chosen it collapses behind a toggle. */}
              {formData.products.length > 0 && (() => {
                const qtyRows = (
                  <div className="qty-list">
                    {formData.products.map(p => (
                      <div className="qty-row" key={p}>
                        <span className="qty-name" title={p}>{p}</span>
                        <input
                          className="qty-input"
                          inputMode="numeric"
                          placeholder="1"
                          value={formData.product_quantities[p] ?? ''}
                          onChange={(e) => setQty(p, e.target.value)}
                          aria-label={`Quantity for ${p}`}
                        />
                      </div>
                    ))}
                  </div>
                );
                return (
                  <div className="qty-editor">
                    {formData.products.length > 2 ? (
                      <>
                        <button type="button" className="qty-toggle" onClick={() => setShowQtys(v => !v)} aria-expanded={showQtys}>
                          <span>Quantities · {formData.products.length} products</span>
                          <ChevronDown size={16} className={`chevron ${showQtys ? 'open' : ''}`} />
                        </button>
                        {showQtys && qtyRows}
                      </>
                    ) : qtyRows}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {/* CONTACT */}
        <div className="form-section">
          <div className="form-section-title">CONTACT</div>
          <div className="form-grid">
            {/* Phone 1 and its additional numbers are one group so the extra
                numbers stack directly below it, not in the next column. */}
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>Phone Numbers <span style={{ color: 'var(--danger)' }}>*</span></label>
              <div className={`phone-input phone-row ${fieldState('phone_1') === 'error' ? 'is-error' : ''}`}>
                <span className="phone-prefix">+91</span>
                <input
                  name="phone_1"
                  value={formData.phone_1}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Phone 1 — 10-digit mobile number"
                  maxLength={10}
                  inputMode="numeric"
                />
                {/* + to add another number, stacked below. */}
                <button type="button" className="add-mini-btn" onClick={addPhone} title="Add another number" aria-label="Add another number" style={{ marginRight: 6 }}>
                  <Plus size={15} />
                </button>
              </div>
              <FieldError name="phone_1" />
              {!fieldErrors.phone_1 && formData.phone_1.length > 0 && formData.phone_1.length < 10 && touched.phone_1 && (
                <FieldHint>{10 - formData.phone_1.length} more digits needed</FieldHint>
              )}
              {!touched.phone_1 && !formData.phone_1 && <FieldHint>Required — 10 digits. Tap + to add more numbers.</FieldHint>}

              {formData.phones.map((num, i) => (
                <div key={i} className="phone-input phone-row" style={{ marginTop: 8 }}>
                  <span className="phone-prefix">+91</span>
                  <input
                    value={num}
                    onChange={(e) => { updatePhone(i, e.target.value); setPhonesError(''); }}
                    placeholder={`Phone ${i + 2} — 10-digit number`}
                    maxLength={10}
                    inputMode="numeric"
                  />
                  <button type="button" className="entry-icon-btn" onClick={() => removePhone(i)} title="Remove number">
                    <X size={16} />
                  </button>
                </div>
              ))}
              {phonesError && <div style={{ color: 'var(--danger)', fontSize: '0.78rem', marginTop: 6 }}>{phonesError}</div>}
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>
                Notes
                {formData.notes.length > 0 && (
                  <span style={{ float: 'right', fontSize: '0.75rem', color: notesLeft < 50 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 400 }}>
                    {notesLeft} / 500 remaining
                  </span>
                )}
              </label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`input-field ${fieldState('notes') === 'error' ? 'input-error-field' : ''}`}
                placeholder="Any additional notes…"
                maxLength={500}
                style={{ minHeight: '80px', resize: 'vertical', ...inputStyle('notes') }}
              />
              <FieldError name="notes" />
            </div>
          </div>
        </div>

        {/* Bottom action bar — so users don't scroll back up to save */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16, marginTop: 8, marginBottom: 8 }}>
          {/* Cancel Bill only on an existing entry, and pushed to the left. */}
          {contact && contact._id && onCancelBill && (
            <button
              type="button"
              className="btn-link"
              style={{ marginRight: 'auto', color: contact.cancelled ? 'var(--accent-text)' : 'var(--danger)' }}
              onClick={() => onCancelBill(contact, !contact.cancelled)}
            >
              {contact.cancelled ? 'Restore Bill' : 'Cancel Bill'}
            </button>
          )}
          <button type="button" className="btn-link" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Saving…' : 'Save Entry'}
          </button>
        </div>
      </form>

      <ConfirmEntryModal
        isOpen={confirming}
        data={formData}
        isEdit={!!(contact && contact._id)}
        saving={loading}
        onConfirm={handleConfirmedSave}
        onEdit={() => setConfirming(false)}
      />
    </div>
  );
}
