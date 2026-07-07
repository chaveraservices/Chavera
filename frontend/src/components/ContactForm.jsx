import { useState, useEffect } from 'react';
import CustomSelect from './CustomSelect';
import api from '../utils/api';
import { PRODUCT_OPTIONS, CUSTOMER_GRADES, HOUSE_TYPES, PURCHASE_TYPES } from '../utils/contactFields';

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
  phone_2: (v, all) => {
    if (!v) return ''; // optional
    if (!/^\d{10}$/.test(v)) return 'Phone 2 must be exactly 10 digits.';
    if (v === all.phone_1) return 'Phone 2 must be different from Phone 1.';
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
export default function ContactForm({ contact, onCancel, onSave }) {
  const [formData, setFormData] = useState({
    honorific: contact?.honorific || '',
    full_name: contact?.full_name || '',
    relation: contact?.relation || '',
    business_name: contact?.business_name || '',
    age: contact?.age || '',
    ppr: contact?.ppr || '',
    toq: contact?.toq || '',
    instagram_id: contact?.instagram_id || '',
    product_name: contact?.product_name || '',
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
    phone_2: contact?.phone_2 || '',
    category: contact?.category || '',
    customer_grade: contact?.customer_grade || '',
    house_type: contact?.house_type || '',
    purchase_type: contact?.purchase_type || '',
    products: Array.isArray(contact?.products) ? contact.products : [],
    contact_date: contact?.contact_date ? String(contact.contact_date).slice(0, 10) : '',
    notes: contact?.notes || ''
  });

  // Tracks which fields the user has interacted with (blur / change)
  const [touched, setTouched] = useState({});
  // Inline field errors
  const [fieldErrors, setFieldErrors] = useState({});
  // Server-level error banner
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  // Locations
  const [locations, setLocations] = useState([]);
  const [locLoading, setLocLoading] = useState(true);

  useEffect(() => {
    api.post('/location/list')
      .then(res => { if (res.data.success) setLocations(res.data.data); })
      .catch(() => {})
      .finally(() => setLocLoading(false));
  }, []);

  // Cascading lists
  const availableDistricts = locations.find(l => l.state === formData.state)?.districts || [];
  const availableCities = availableDistricts.find(d => d.name === formData.district)?.cities || [];

  // Re-validate phone_2 whenever phone_1 changes (uniqueness check)
  useEffect(() => {
    if (touched.phone_2) {
      setFieldErrors(prev => ({
        ...prev,
        phone_2: validate('phone_2', formData.phone_2, formData),
      }));
    }
  }, [formData.phone_1]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    let next;
    if (name === 'state') {
      next = { ...formData, state: value, district: '', village_town: '' };
    } else if (name === 'district') {
      next = { ...formData, district: value, village_town: '' };
    } else if (['phone_1', 'phone_2', 'pincode'].includes(name)) {
      next = { ...formData, [name]: value.replace(/\D/g, '') };
    } else {
      next = { ...formData, [name]: value };
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

  // CustomSelect doesn't fire blur events — mark as touched on change
  const handleSelectChange = (e) => {
    const { name } = e.target;
    handleChange(e);
    setTouched(prev => ({ ...prev, [name]: true }));
  };

  // Toggle a product in the multi-select list
  const toggleProduct = (product) => {
    setFormData(prev => ({
      ...prev,
      products: prev.products.includes(product)
        ? prev.products.filter(p => p !== product)
        : [...prev.products, product],
    }));
  };

  // Field status for styling
  const fieldState = (name) => {
    if (!touched[name]) return '';
    if (fieldErrors[name]) return 'error';
    if (RULES[name]) return 'success';
    return '';
  };

  const inputStyle = (name) => {
    const s = fieldState(name);
    return {
      borderColor: s === 'error' ? '#DC2626' : s === 'success' ? '#16A34A' : undefined,
      boxShadow: s === 'error'
        ? '0 0 0 2px rgba(220,38,38,0.15)'
        : s === 'success'
        ? '0 0 0 2px rgba(22,163,74,0.12)'
        : undefined,
    };
  };

  const FieldError = ({ name }) =>
    touched[name] && fieldErrors[name] ? (
      <span style={{ color: '#DC2626', fontSize: '0.78rem', marginTop: 4, display: 'block' }}>
        ⚠ {fieldErrors[name]}
      </span>
    ) : null;

  const FieldHint = ({ children }) => (
    <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 4, display: 'block' }}>
      {children}
    </span>
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    // Mark all validated fields as touched
    const allTouched = Object.keys(RULES).reduce((acc, k) => ({ ...acc, [k]: true }), {});
    setTouched(prev => ({ ...prev, ...allTouched }));

    // Full client-side validation sweep
    const errors = validateAll(formData);
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) {
      setServerError('Please fix the errors highlighted below before saving.');
      // Scroll to first error
      setTimeout(() => {
        const el = document.querySelector('.input-error-field');
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }

    setLoading(true);

    const payload = {
      ...formData,
      full_name: formData.full_name.trim(),
      village_town: formData.village_town.trim(),
      business_name: formData.business_name.trim(),
    };

    try {
      if (contact && contact._id) {
        await api.post('/contact/update', { id: contact._id, ...payload });
      } else {
        await api.post('/contact/insert', payload);
      }
      onSave();
    } catch (err) {
      setServerError(err.response?.data?.message || 'An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Character count helpers
  const notesLeft = 500 - (formData.notes?.length || 0);
  const businessLeft = 150 - (formData.business_name?.length || 0);

  return (
    <div className="page-container" style={{ paddingTop: '32px' }}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="form-header-flex">
          <h1>{contact ? 'Edit Contact' : 'Add Contact'}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button type="button" className="btn-link" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
        </div>

        {serverError && (
          <div style={{ padding: '12px 16px', background: '#FEE2E2', color: '#DC2626', borderRadius: '8px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '1.1rem' }}>⚠</span>
            {serverError}
          </div>
        )}

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
              />
            </div>

            <div className="form-group">
              <label>Full Name <span style={{ color: '#DC2626' }}>*</span></label>
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
              <label>Relation</label>
              <CustomSelect
                name="relation"
                value={formData.relation}
                onChange={handleSelectChange}
                options={[
                  { label: 'None', value: '' },
                  { label: 'S/O (Son of)', value: 'S/O' },
                  { label: 'D/O (Daughter of)', value: 'D/O' },
                  { label: 'W/O (Wife of)', value: 'W/O' },
                  { label: 'H/O (Husband of)', value: 'H/O' },
                ]}
                placeholder="Select relation"
              />
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
                className={`input-field ${fieldState('business_name') === 'error' ? 'input-error-field' : ''}`}
                placeholder="Enter business name"
                maxLength={150}
                style={inputStyle('business_name')}
              />
              <FieldError name="business_name" />
            </div>

            <div className="form-group">
              <label>Age</label>
              <input
                name="age"
                value={formData.age}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`input-field ${fieldState('age') === 'error' ? 'input-error-field' : ''}`}
                placeholder="Enter Age"
                style={inputStyle('age')}
              />
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
              <label>Product Name</label>
              <input
                name="product_name"
                value={formData.product_name}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`input-field ${fieldState('product_name') === 'error' ? 'input-error-field' : ''}`}
                placeholder="Enter Product Name"
                style={inputStyle('product_name')}
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
                    ...availableDistricts.map(d => ({ label: d.name, value: d.name }))
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
                Village / Town <span style={{ color: '#DC2626' }}>*</span>
              </label>
              {locLoading ? (
                <input className="input-field" disabled placeholder="Loading…" />
              ) : !formData.district ? (
                <input
                  name="village_town"
                  value={formData.village_town}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`input-field ${fieldState('village_town') === 'error' ? 'input-error-field' : ''}`}
                  placeholder="Enter village or town"
                  style={inputStyle('village_town')}
                />
              ) : availableCities.length === 0 ? (
                <input
                  name="village_town"
                  value={formData.village_town}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  className={`input-field ${fieldState('village_town') === 'error' ? 'input-error-field' : ''}`}
                  placeholder="Type village or town"
                  style={inputStyle('village_town')}
                />
              ) : (
                <CustomSelect
                  name="village_town"
                  value={formData.village_town}
                  onChange={handleSelectChange}
                  options={[
                    { label: 'Select Village/Town', value: '' },
                    ...availableCities.map(c => ({ label: c, value: c }))
                  ]}
                  placeholder="Select Village/Town"
                />
              )}
              {formData.district && availableCities.length === 0 && (
                <FieldHint>No cities configured — type manually</FieldHint>
              )}
              <FieldError name="village_town" />
            </div>

            <div className="form-group">
              <label>Pincode</label>
              <input
                name="pincode"
                value={formData.pincode}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`input-field ${fieldState('pincode') === 'error' ? 'input-error-field' : ''}`}
                placeholder="6-digit pincode"
                maxLength={6}
                inputMode="numeric"
                style={inputStyle('pincode')}
              />
              <FieldError name="pincode" />
              {!fieldErrors.pincode && !formData.pincode && (
                <FieldHint>Optional — 6 digits</FieldHint>
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
              <input
                type="date"
                name="contact_date"
                value={formData.contact_date}
                onChange={handleChange}
                className="input-field"
              />
              <FieldHint>Optional — defaults to created date</FieldHint>
            </div>

            <div className="form-group">
              <label>Type of Customer (Grade)</label>
              <CustomSelect
                name="customer_grade"
                value={formData.customer_grade}
                onChange={handleSelectChange}
                options={[
                  { label: 'None', value: '' },
                  ...CUSTOMER_GRADES.map(g => ({ label: g, value: g })),
                ]}
                placeholder="Select grade"
              />
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
                {PRODUCT_OPTIONS.map(p => {
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
              </div>
            </div>
          </div>
        </div>

        {/* CONTACT */}
        <div className="form-section">
          <div className="form-section-title">CONTACT</div>
          <div className="form-grid">
            <div className="form-group">
              <label>Phone 1 <span style={{ color: '#DC2626' }}>*</span></label>
              <input
                name="phone_1"
                value={formData.phone_1}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`input-field ${fieldState('phone_1') === 'error' ? 'input-error-field' : ''}`}
                placeholder="10-digit mobile number"
                maxLength={10}
                inputMode="numeric"
                style={inputStyle('phone_1')}
              />
              <FieldError name="phone_1" />
              {!fieldErrors.phone_1 && formData.phone_1.length > 0 && formData.phone_1.length < 10 && touched.phone_1 && (
                <FieldHint>{10 - formData.phone_1.length} more digits needed</FieldHint>
              )}
              {!touched.phone_1 && <FieldHint>Required — 10 digits, no spaces</FieldHint>}
            </div>

            <div className="form-group">
              <label>Phone 2 <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <input
                name="phone_2"
                value={formData.phone_2}
                onChange={handleChange}
                onBlur={handleBlur}
                className={`input-field ${fieldState('phone_2') === 'error' ? 'input-error-field' : ''}`}
                placeholder="Alternate number (optional)"
                maxLength={10}
                inputMode="numeric"
                style={inputStyle('phone_2')}
              />
              <FieldError name="phone_2" />
              {!fieldErrors.phone_2 && formData.phone_2 && formData.phone_2.length > 0 && formData.phone_2.length < 10 && touched.phone_2 && (
                <FieldHint>{10 - formData.phone_2.length} more digits needed</FieldHint>
              )}
            </div>

            <div className="form-group">
              <label>Category</label>
              <CustomSelect
                name="category"
                value={formData.category}
                onChange={handleSelectChange}
                options={[
                  { label: 'None', value: '' },
                  { label: 'DEALER', value: 'DEALER' },
                  { label: 'CUSTOMER', value: 'CUSTOMER' },
                ]}
                placeholder="Select category"
              />
            </div>

            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label>
                Notes
                {formData.notes.length > 0 && (
                  <span style={{ float: 'right', fontSize: '0.75rem', color: notesLeft < 50 ? '#DC2626' : 'var(--text-muted)', fontWeight: 400 }}>
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
      </form>
    </div>
  );
}
