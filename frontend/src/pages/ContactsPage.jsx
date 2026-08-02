import { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../utils/api';
import useDebounce from '../utils/useDebounce';
import { contactsToExportRows } from '../utils/contactFields';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Download, Upload, X, SlidersHorizontal } from 'lucide-react';
import CustomSelect from '../components/CustomSelect';
import AlertModal from '../components/AlertModal';
import EntryDetailModal from '../components/EntryDetailModal';
import EntryFormModal from '../components/EntryFormModal';
import { useAuth } from '../context/AuthContext';
import { CUSTOMER_GRADES, HOUSE_TYPES, PURCHASE_TYPES, CATEGORY_OPTIONS } from '../utils/contactFields';
import { entryCode } from '../utils/series';
import useProducts from '../utils/useProducts';

// "Cot ×3, Sofa set" — quantity shown only when it's more than one.
const productListWithQty = (products, qtys) =>
  (Array.isArray(products) ? products : [])
    .map(p => { const q = qtys && qtys[p]; return q && q > 1 ? `${p} ×${q}` : p; })
    .join(', ');

export default function ContactsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [contacts, setContacts] = useState([]); // current page only
  const [total, setTotal] = useState(0);        // matching count (server)
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [contactToDelete, setContactToDelete] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, title: '', message: '', type: 'error' });
  const [detailContact, setDetailContact] = useState(null); // row-click detail modal
  const [formState, setFormState] = useState({ open: false, contact: null }); // entry form modal
  const openNew = () => setFormState({ open: true, contact: null });
  const openEdit = (c) => setFormState({ open: true, contact: c });
  const closeForm = () => setFormState({ open: false, contact: null });

  // #4: press Space anywhere on the Entry screen to start a new entry — as long
  // as you're not typing in a field and nothing is already open on top.
  useEffect(() => {
    const onKey = (e) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      if (formState.open || detailContact) return;                 // already in a modal
      const el = document.activeElement;
      const tag = (el?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || el?.isContentEditable) return;
      if (el?.closest?.('[role="combobox"], [role="dialog"]')) return; // in a dropdown/modal
      e.preventDefault();
      openNew();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [formState.open, detailContact]);
  const filterPanelRef = useRef(null);
  const filterBtnRef = useRef(null);

  // Staff may create and edit entries but not delete, import, or export.
  const { user } = useAuth();
  const isAdmin = (user?.role || 'admin') === 'admin';
  const { products: productCatalogue } = useProducts();

  // Filter options (distinct values from the server)
  const [tuples, setTuples] = useState([]);        // [{state, district, city}]
  const [categories, setCategories] = useState([]);
  const [grades, setGrades] = useState([]);
  const [houseTypes, setHouseTypes] = useState([]);
  const [purchaseTypes, setPurchaseTypes] = useState([]);
  const [products, setProducts] = useState([]);
  const [years, setYears] = useState([]);          // [{ year, letter }] for the year filter

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedHouseType, setSelectedHouseType] = useState('');
  const [selectedPurchaseType, setSelectedPurchaseType] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedYear, setSelectedYear] = useState('');  // entry-series year (A, B, …)
  const [yearsAgo, setYearsAgo] = useState('');  // "bought N years ago" bucket
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Bumped to force a refetch (e.g. after deleting a contact)
  const [refreshTick, setRefreshTick] = useState(0);

  const filterParams = useMemo(() => ({
    search: debouncedSearch.trim(),
    state: selectedState,
    district: selectedDistrict,
    city: selectedCity,
    category: selectedCategory,
    customer_grade: selectedGrade,
    house_type: selectedHouseType,
    purchase_type: selectedPurchaseType,
    product: selectedProduct,
    year: selectedYear,
    years_ago: yearsAgo,
  }), [debouncedSearch, selectedState, selectedDistrict, selectedCity, selectedCategory,
    selectedGrade, selectedHouseType, selectedPurchaseType, selectedProduct, selectedYear, yearsAgo]);

  // Load distinct filter options once (and after mutations).
  useEffect(() => {
    api.post('/contact/filter-options')
      .then(res => {
        if (res.data.success) {
          const d = res.data.data;
          setTuples(d.tuples || []);
          setCategories(d.categories || []);
          setGrades(d.grades || []);
          setHouseTypes(d.houseTypes || []);
          setPurchaseTypes(d.purchaseTypes || []);
          setProducts(d.products || []);
          setYears(d.years || []);
        }
      })
      .catch(err => console.error(err));
  }, [refreshTick]);

  // Pre-apply filters passed in the URL (e.g. from the Dashboard drill-down).
  useEffect(() => {
    const setters = {
      product: setSelectedProduct,
      category: setSelectedCategory,
      customer_grade: setSelectedGrade,
      house_type: setSelectedHouseType,
      purchase_type: setSelectedPurchaseType,
      state: setSelectedState,
      district: setSelectedDistrict,
      city: setSelectedCity,
    };
    let applied = false;
    for (const [key, setter] of Object.entries(setters)) {
      const v = searchParams.get(key);
      if (v) { setter(v); applied = true; }
    }
    // Filters from a drill-down are applied, but the panel stays CLOSED —
    // arriving from the pie chart shouldn't dump you into an open filter panel.
    void applied;
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Floating filter panel: close on Esc or an outside click. Deliberately no
  // scrim overlay — a full-viewport catcher also swallows wheel events, which
  // stopped the page scrolling while the panel was open.
  useEffect(() => {
    if (!showMoreFilters) return;
    const onKey = (e) => { if (e.key === 'Escape') setShowMoreFilters(false); };
    const onDown = (e) => {
      if (filterPanelRef.current?.contains(e.target)) return;
      if (filterBtnRef.current?.contains(e.target)) return; // let the button toggle
      setShowMoreFilters(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [showMoreFilters]);

  // Reset to page 1 whenever filters or page size change.
  useEffect(() => {
    setPage(1);
  }, [filterParams, pageSize]);

  // Fetch the current page from the server.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api.post('/contact/list', { page, pageSize, ...filterParams })
      .then(res => {
        if (cancelled || !res.data.success) return;
        setContacts(res.data.data.items);
        setTotal(res.data.data.total);
      })
      .catch(err => { if (!cancelled) console.error(err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [page, pageSize, filterParams, refreshTick]);

  // Cascading filter dropdown options derived from the distinct tuples.
  const uniqueStates = useMemo(
    () => [...new Set(tuples.map(t => t.state).filter(Boolean))].sort(),
    [tuples]
  );
  const uniqueDistricts = useMemo(
    () => [...new Set(tuples
      .filter(t => !selectedState || t.state === selectedState)
      .map(t => t.district).filter(Boolean))].sort(),
    [tuples, selectedState]
  );
  const uniqueCities = useMemo(
    () => [...new Set(tuples
      .filter(t => (!selectedState || t.state === selectedState) && (!selectedDistrict || t.district === selectedDistrict))
      .map(t => t.city).filter(Boolean))].sort(),
    [tuples, selectedState, selectedDistrict]
  );

  // Fixed-vocabulary filters always offer their standard options (merged with any
  // extra values already present in the data), so they work even before data exists.
  const mergeOpts = (fixed, fromData) => [...new Set([...fixed, ...fromData])];
  const gradeOptions = mergeOpts(CUSTOMER_GRADES, grades);
  const houseOptions = mergeOpts(HOUSE_TYPES, houseTypes);
  const purchaseOptions = mergeOpts(PURCHASE_TYPES, purchaseTypes);
  const productOptions = mergeOpts(productCatalogue, products);
  const categoryOptions = mergeOpts(CATEGORY_OPTIONS, categories);

  // Pagination math (driven by server total)
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, total);

  const confirmDelete = async () => {
    if (!contactToDelete) return;
    setDeletingId(contactToDelete._id);
    try {
      await api.post('/contact/delete', { id: contactToDelete._id });
      if (contacts.length === 1 && page > 1) {
        setPage(p => p - 1);
      } else {
        setRefreshTick(t => t + 1);
      }
    } catch (err) {
      setAlertConfig({ isOpen: true, message: err.response?.data?.message || 'Failed to delete contact', type: 'error' });
    } finally {
      setDeletingId(null);
      setContactToDelete(null);
    }
  };

  // Cancel bill (or restore). Kept as a soft flag on the entry.
  const handleCancel = async (c, cancelled) => {
    try {
      await api.post('/contact/cancel', { id: c._id, cancelled });
      setDetailContact(null);
      setRefreshTick(t => t + 1);
    } catch (err) {
      setAlertConfig({ isOpen: true, message: err.response?.data?.message || 'Failed to update the entry', type: 'error' });
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      // Pull the full matching set (ignores pagination) for the export.
      const res = await api.post('/contact/list', { all: true, ...filterParams });
      const source = res.data?.data?.items || [];
      if (source.length === 0) { 
        setAlertConfig({ isOpen: true, title: 'Nothing to Export', message: 'No contacts match the current filters, so there is nothing to export.', type: 'info' });
        return; 
      }

      const data = contactsToExportRows(source);
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Contacts');
      XLSX.writeFile(workbook, 'Contacts_Export.xlsx');
    } catch (err) {
      setAlertConfig({ isOpen: true, message: err.response?.data?.message || 'Failed to export contacts', type: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedState('');
    setSelectedDistrict('');
    setSelectedCity('');
    setSelectedCategory('');
    setSelectedGrade('');
    setSelectedHouseType('');
    setSelectedPurchaseType('');
    setSelectedProduct('');
    setSelectedYear('');
    setYearsAgo('');
    // Drop any drill-down params left in the URL by the Dashboard, so the
    // address bar matches the (now empty) filter state.
    if (searchParams.toString()) setSearchParams({}, { replace: true });
  };

  const hasActiveFilters = searchQuery || selectedState || selectedDistrict || selectedCity ||
    selectedCategory || selectedGrade || selectedHouseType ||
    selectedPurchaseType || selectedProduct || selectedYear || yearsAgo;

  const activeFilterCount = [selectedState, selectedDistrict, selectedCity, selectedCategory,
    selectedGrade, selectedHouseType, selectedPurchaseType, selectedProduct, selectedYear, yearsAgo]
    .filter(Boolean).length + (searchQuery ? 1 : 0);

  // Fixed five-column registry. The client asked for a compact table — every
  // other field lives in the detail modal, opened by clicking a row.
  const columnDefs = {
    id: { label: '#', render: c => <span className="cell-id">{entryCode(c) || '—'}</span> },
    name: {
      label: 'NAME',
      render: c => (
        <>
          <div style={{ fontWeight: 600 }}>
            {c.honorific ? `${c.honorific} ` : ''}{c.full_name}
            {c.cancelled && <span className="badge is-cancelled" style={{ marginLeft: 8 }}>Cancelled</span>}
          </div>
          {c.business_name && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.business_name}</div>}
        </>
      ),
    },
    products: {
      label: 'PRODUCT',
      render: c => (Array.isArray(c.products) && c.products.length) ? productListWithQty(c.products, c.product_quantities) : '—',
    },
    location: {
      label: 'LOCATION',
      render: c => `${c.village_town || ''}${c.district ? `, ${c.district}` : ''}` || '—',
    },
    phone: {
      label: 'PHONE',
      render: c => c.phone_1 || '—',
    },
  };

  const visibleColumns = ['id', 'name', 'products', 'location', 'phone'];
  const colCount = visibleColumns.length;

  return (
    <>
      {/* Single toolbar row: title, search, then actions. */}
      <div className="entry-toolbar">
        <div className="entry-toolbar-title">
          <h1>Entry</h1>
          <p>Click any row to see the full entry</p>
        </div>

        <div className="search-bar entry-toolbar-search">
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search name, phone, business…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="entry-toolbar-actions">
          <button
            ref={filterBtnRef}
            className="btn"
            onClick={() => setShowMoreFilters(o => !o)}
            style={{
              border: '1px solid var(--border-color)',
              background: (showMoreFilters || hasActiveFilters) ? 'var(--highlight)' : 'var(--bg-white)',
              color: (showMoreFilters || hasActiveFilters) ? 'var(--accent-text)' : 'var(--text-dark)',
            }}
          >
            <SlidersHorizontal size={16} /> Filters
            {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
          </button>
          {hasActiveFilters && (
            <button
              className="btn-link"
              onClick={clearFilters}
              style={{ color: 'var(--danger)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
            >
              <X size={14} /> Clear all
            </button>
          )}
          {isAdmin && (
            <button className="btn" onClick={handleExport} disabled={exporting}
              style={{ border: '1px solid var(--border-color)', background: 'var(--bg-white)', color: 'var(--text-dark)' }}>
              <Download size={16} /> {exporting ? 'Exporting…' : `Export${hasActiveFilters ? ` (${total})` : ''}`}
            </button>
          )}
          {isAdmin && (
            <button className="btn" onClick={() => navigate('/import')}
              style={{ border: '1px solid var(--border-color)', background: 'var(--bg-white)', color: 'var(--text-dark)' }}>
              <Upload size={16} /> Import
            </button>
          )}
          <button className="btn btn-primary" onClick={openNew}>+ New Entry</button>
        </div>
      </div>

      {/* Filters float over the table rather than displacing it — pushing the
          content down on every toggle made the whole page jump. */}
      <div className="filter-host">
        {showMoreFilters && (
          <div className="filter-panel" ref={filterPanelRef}>
            <div className="filter-field">
              <label>Year (Series)</label>
              <CustomSelect value={selectedYear} onChange={e => setSelectedYear(e.target.value)}
                options={[{ label: 'All Years', value: '' },
                  ...years.map(y => ({ label: `${y.letter} · ${y.year}`, value: String(y.year) }))]}
                placeholder="All Years" />
            </div>
            <div className="filter-field">
              <label>State</label>
              <CustomSelect value={selectedState}
                onChange={e => { setSelectedState(e.target.value); setSelectedDistrict(''); setSelectedCity(''); }}
                options={[{ label: 'All States', value: '' }, ...uniqueStates.map(s => ({ label: s, value: s }))]}
                placeholder="All States" />
            </div>
            <div className="filter-field">
              <label>District</label>
              <CustomSelect value={selectedDistrict}
                onChange={e => { setSelectedDistrict(e.target.value); setSelectedCity(''); }}
                options={[{ label: 'All Districts', value: '' }, ...uniqueDistricts.map(d => ({ label: d, value: d }))]}
                placeholder="All Districts" />
            </div>
            <div className="filter-field">
              <label>City</label>
              <CustomSelect value={selectedCity} onChange={e => setSelectedCity(e.target.value)}
                options={[{ label: 'All Cities', value: '' }, ...uniqueCities.map(c => ({ label: c, value: c }))]}
                placeholder="All Cities" />
            </div>
            <div className="filter-field">
              <label>Category / Type</label>
              <CustomSelect value={selectedCategory} onChange={e => setSelectedCategory(e.target.value)}
                options={[{ label: 'All Types', value: '' }, ...categoryOptions.map(c => ({ label: c, value: c }))]}
                placeholder="All Types" />
            </div>
            <div className="filter-field">
              <label>Customer Grade</label>
              <CustomSelect value={selectedGrade} onChange={e => setSelectedGrade(e.target.value)}
                options={[{ label: 'All Grades', value: '' }, ...gradeOptions.map(g => ({ label: g, value: g }))]}
                placeholder="All Grades" />
            </div>
            <div className="filter-field">
              <label>Type of House</label>
              <CustomSelect value={selectedHouseType} onChange={e => setSelectedHouseType(e.target.value)}
                options={[{ label: 'All', value: '' }, ...houseOptions.map(h => ({ label: h, value: h }))]}
                placeholder="All" />
            </div>
            <div className="filter-field">
              <label>Type of Purchase</label>
              <CustomSelect value={selectedPurchaseType} onChange={e => setSelectedPurchaseType(e.target.value)}
                options={[{ label: 'All', value: '' }, ...purchaseOptions.map(p => ({ label: p, value: p }))]}
                placeholder="All" />
            </div>
            <div className="filter-field">
              <label>Products</label>
              <CustomSelect value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
                options={[{ label: 'All Products', value: '' }, ...productOptions.map(p => ({ label: p, value: p }))]}
                placeholder="All Products" />
            </div>
            <div className="filter-field">
              <label>Purchased</label>
              <CustomSelect value={yearsAgo} onChange={e => setYearsAgo(e.target.value)}
                options={[
                  { label: 'Any time', value: '' },
                  { label: '2 years ago', value: '2' },
                  { label: '3 years ago', value: '3' },
                  { label: '4 years ago', value: '4' },
                  { label: '5 years ago', value: '5' },
                  { label: '6 years ago', value: '6' },
                ]}
                placeholder="Any time" />
            </div>
          </div>
        )}
      </div>

      <div className="page-container">
        <div className="table-container" style={{ opacity: loading && contacts.length > 0 ? 0.55 : 1, transition: 'opacity 0.15s ease' }}>
          <table className="data-table">
            <thead>
              <tr>
                {visibleColumns.map((key) => {
                  const col = columnDefs[key];
                  return (
                    <th key={key} className={key === 'id' ? 'th-id' : undefined}>
                      <span>{col.label}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading && contacts.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: colCount }).map((__, j) => (
                      <td key={j}><div className="shimmer-block" style={{ height: '20px', width: '75%' }}></div></td>
                    ))}
                  </tr>
                ))
              ) : total === 0 ? (
                <tr>
                  <td colSpan={colCount} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    {hasActiveFilters ? 'No contacts match your filters.' : 'No contacts found.'}
                  </td>
                </tr>
              ) : (
                contacts.map(contact => (
                  <tr
                    key={contact._id}
                    className={`row-clickable ${contact.cancelled ? 'row-cancelled' : ''}`}
                    onClick={() => setDetailContact(contact)}
                    tabIndex={0}
                    role="button"
                    aria-label={`Open entry ${entryCode(contact) ?? ''} ${contact.full_name}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailContact(contact); }
                    }}
                  >
                    {visibleColumns.map(key => (
                      <td key={key} className={key === 'id' ? 'td-id' : undefined}>{columnDefs[key].render(contact)}</td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="pagination">
            <div className="pagination-info">
              Showing <strong>{rangeStart}</strong>–<strong>{rangeEnd}</strong> of <strong>{total}</strong>
            </div>

            <div className="pagination-controls">
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Rows:</span>
              <div style={{ width: 90 }}>
                <CustomSelect
                  value={String(pageSize)}
                  onChange={e => setPageSize(Number(e.target.value))}
                  options={[
                    { label: '10', value: '10' },
                    { label: '25', value: '25' },
                    { label: '50', value: '50' },
                    { label: '100', value: '100' },
                  ]}
                />
              </div>

              <button
                className="page-btn"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
              >
                Prev
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-dark)', minWidth: 90, textAlign: 'center' }}>
                Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
              </span>
              <button
                className="page-btn"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Custom Delete Confirmation Modal */}
      {contactToDelete && (
        <div className="modal-overlay" onClick={() => setContactToDelete(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <div className="modal-header">
              <h2>Confirm Deletion</h2>
              <button className="close-btn" onClick={() => setContactToDelete(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-dark)', marginBottom: 20 }}>
                Are you sure you want to delete "<strong>{contactToDelete.full_name}</strong>"? This action cannot be undone.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                <button 
                  className="btn" 
                  onClick={() => setContactToDelete(null)} 
                  style={{ border: '1px solid var(--border-color)', background: 'var(--bg-white)' }}
                  disabled={deletingId}
                >
                  Cancel
                </button>
                <button 
                  className="btn btn-primary" 
                  onClick={confirmDelete} 
                  style={{ background: 'var(--danger)' }}
                  disabled={deletingId}
                >
                  {deletingId ? 'Deleting...' : 'Delete Contact'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <EntryFormModal
        open={formState.open}
        contact={formState.contact}
        onClose={closeForm}
        onSaved={() => { closeForm(); setRefreshTick(t => t + 1); }}
        onCancelBill={isAdmin ? (c, cancelled) => { closeForm(); handleCancel(c, cancelled); } : undefined}
      />

      <EntryDetailModal
        contact={detailContact}
        onClose={() => setDetailContact(null)}
        onEdit={(c) => { setDetailContact(null); openEdit(c); }}
        onDelete={isAdmin ? (c) => { setDetailContact(null); setContactToDelete(c); } : undefined}
        onCancel={isAdmin ? handleCancel : undefined}
        onNotify={(msg) => setAlertConfig({ isOpen: true, message: msg, type: 'error' })}
      />

      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.title || (alertConfig.type === 'error' ? 'Error' : 'Success')}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ isOpen: false, title: '', message: '', type: 'error' })}
      />
    </>
  );
}
