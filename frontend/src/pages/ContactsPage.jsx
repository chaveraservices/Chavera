import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import api from '../utils/api';
import useDebounce from '../utils/useDebounce';
import { contactsToExportRows } from '../utils/contactFields';
import { useNavigate } from 'react-router-dom';
import { Search, User as UserIcon, Download, Trash2, X, Tags, SlidersHorizontal } from 'lucide-react';
import ColumnManager from '../components/ColumnManager';
import CustomSelect from '../components/CustomSelect';
import ColumnFilter from '../components/ColumnFilter';
import AlertModal from '../components/AlertModal';
import { CUSTOMER_GRADES, HOUSE_TYPES, PURCHASE_TYPES, PRODUCT_OPTIONS, CATEGORY_OPTIONS, RELATION_OPTIONS } from '../utils/contactFields';

// Master column order + which are hidden by default. Users can reorder/toggle
// these; ACTIONS is always pinned last and can't be hidden.
const DEFAULT_COLUMN_ORDER = ['name', 'relation', 'location', 'phone', 'type', 'grade', 'house', 'purchase', 'products', 'age', 'business', 'insta', 'state', 'district', 'city', 'pincode', 'date', 'phone2'];
const DEFAULT_HIDDEN = ['grade', 'house', 'purchase', 'products', 'age', 'business', 'insta', 'state', 'district', 'city', 'pincode', 'date', 'phone2'];

export default function ContactsPage({ onAdd, onEdit }) {
  const navigate = useNavigate();
  const [contacts, setContacts] = useState([]); // current page only
  const [total, setTotal] = useState(0);        // matching count (server)
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [contactToDelete, setContactToDelete] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [printingLabels, setPrintingLabels] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', type: 'error' });

  // Filter options (distinct values from the server)
  const [tuples, setTuples] = useState([]);        // [{state, district, city}]
  const [categories, setCategories] = useState([]);
  const [relations, setRelations] = useState([]);
  const [grades, setGrades] = useState([]);
  const [houseTypes, setHouseTypes] = useState([]);
  const [purchaseTypes, setPurchaseTypes] = useState([]);
  const [products, setProducts] = useState([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedRelation, setSelectedRelation] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedHouseType, setSelectedHouseType] = useState('');
  const [selectedPurchaseType, setSelectedPurchaseType] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  // Column visibility + order (persisted). Reconciled against the known columns
  // so stale localStorage never breaks the table.
  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('chavera_col_order'));
      if (Array.isArray(s)) {
        const valid = s.filter(k => DEFAULT_COLUMN_ORDER.includes(k));
        return [...valid, ...DEFAULT_COLUMN_ORDER.filter(k => !valid.includes(k))];
      }
    } catch { /* ignore */ }
    return DEFAULT_COLUMN_ORDER;
  });
  const [hiddenCols, setHiddenCols] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem('chavera_col_hidden'));
      if (Array.isArray(s)) return s.filter(k => DEFAULT_COLUMN_ORDER.includes(k));
    } catch { /* ignore */ }
    return DEFAULT_HIDDEN;
  });
  useEffect(() => { localStorage.setItem('chavera_col_order', JSON.stringify(columnOrder)); }, [columnOrder]);
  useEffect(() => { localStorage.setItem('chavera_col_hidden', JSON.stringify(hiddenCols)); }, [hiddenCols]);

  // Move the dragged column to the target column's position.
  const reorderColumns = (dragKey, targetKey) => {
    setColumnOrder(prev => {
      const next = [...prev];
      const from = next.indexOf(dragKey);
      const to = next.indexOf(targetKey);
      if (from < 0 || to < 0) return prev;
      next.splice(from, 1);
      next.splice(to, 0, dragKey);
      return next;
    });
  };
  const toggleColumn = (key) => {
    setHiddenCols(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

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
    relation: selectedRelation,
    customer_grade: selectedGrade,
    house_type: selectedHouseType,
    purchase_type: selectedPurchaseType,
    product: selectedProduct,
  }), [debouncedSearch, selectedState, selectedDistrict, selectedCity, selectedCategory,
    selectedRelation, selectedGrade, selectedHouseType, selectedPurchaseType, selectedProduct]);

  // Load distinct filter options once (and after mutations).
  useEffect(() => {
    api.post('/contact/filter-options')
      .then(res => {
        if (res.data.success) {
          const d = res.data.data;
          setTuples(d.tuples || []);
          setCategories(d.categories || []);
          setRelations(d.relations || []);
          setGrades(d.grades || []);
          setHouseTypes(d.houseTypes || []);
          setPurchaseTypes(d.purchaseTypes || []);
          setProducts(d.products || []);
        }
      })
      .catch(err => console.error(err));
  }, [refreshTick]);

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
  const productOptions = mergeOpts(PRODUCT_OPTIONS, products);
  const relationOptions = mergeOpts(RELATION_OPTIONS, relations);
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

  // Print the filtered contacts as 50mm x 30mm mailing labels (Name + address + phone).
  const handleLabels = async () => {
    setPrintingLabels(true);
    try {
      const res = await api.post('/contact/list', { all: true, ...filterParams });
      const source = res.data?.data?.items || [];
      if (source.length === 0) {
        setAlertConfig({ isOpen: true, message: 'No contacts to print labels for', type: 'error' });
        return;
      }

      const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const labels = source.map(c => {
        const name = (c.honorific ? c.honorific + ' ' : '') + (c.full_name || '');
        const address = [c.door_flat_no, c.street, c.village_town, c.district, c.state, c.pincode].filter(Boolean).join(', ');
        const phone = [c.phone_1, c.phone_2].filter(Boolean).join(' / ');
        return `<div class="label">
          <div class="lname">${esc(name)}</div>
          <div class="laddr">${esc(address)}</div>
          <div class="lphone">${esc(phone)}</div>
        </div>`;
      }).join('');

      const html = `<html><head><title>Mailing Labels</title><style>
        * { box-sizing: border-box; }
        body { margin: 0; font-family: Arial, Helvetica, sans-serif; }
        .sheet { display: flex; flex-wrap: wrap; }
        .label {
          width: 50mm; height: 30mm; padding: 2mm 3mm; overflow: hidden;
          border: 0.2mm solid #e5e5e5;
          display: flex; flex-direction: column; justify-content: center;
        }
        .lname { font-weight: bold; font-size: 9pt; line-height: 1.15; }
        .laddr { font-size: 7.5pt; line-height: 1.2; margin-top: 1mm; }
        .lphone { font-size: 7.5pt; margin-top: 1mm; }
        @page { margin: 5mm; }
        @media print { .label { break-inside: avoid; } }
      </style></head><body><div class="sheet">${labels}</div></body></html>`;

      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);
      iframe.contentDocument.open();
      iframe.contentDocument.write(html);
      iframe.contentDocument.close();
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => document.body.removeChild(iframe), 1000);
      }, 400);
    } catch (err) {
      setAlertConfig({ isOpen: true, message: err.response?.data?.message || 'Failed to prepare labels', type: 'error' });
    } finally {
      setPrintingLabels(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      // Pull the full matching set (ignores pagination) for the export.
      const res = await api.post('/contact/list', { all: true, ...filterParams });
      const source = res.data?.data?.items || [];
      if (source.length === 0) { 
        setAlertConfig({ isOpen: true, message: 'No contacts to export', type: 'error' });
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
    setSelectedRelation('');
    setSelectedGrade('');
    setSelectedHouseType('');
    setSelectedPurchaseType('');
    setSelectedProduct('');
  };

  const hasActiveFilters = searchQuery || selectedState || selectedDistrict || selectedCity ||
    selectedCategory || selectedRelation || selectedGrade || selectedHouseType ||
    selectedPurchaseType || selectedProduct;

  const activeFilterCount = [selectedState, selectedDistrict, selectedCity, selectedCategory,
    selectedGrade, selectedHouseType, selectedPurchaseType, selectedProduct, selectedRelation]
    .filter(Boolean).length + (searchQuery ? 1 : 0);

  // Column registry: label, optional header filter, and cell renderer.
  const columnDefs = {
    name: {
      label: 'NAME',
      filter: { mode: 'search', value: searchQuery, onChange: setSearchQuery, placeholder: 'Search name / phone / business…' },
      render: c => (
        <>
          <div style={{ fontWeight: 600 }}>{c.honorific ? `${c.honorific} ` : ''}{c.full_name}</div>
          {c.business_name && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.business_name}</div>}
        </>
      ),
    },
    relation: { label: 'RELATION', filter: { mode: 'select', options: relationOptions, value: selectedRelation, onChange: setSelectedRelation }, render: c => c.relation || '-' },
    location: { label: 'LOCATION', filter: { mode: 'select', options: uniqueCities, value: selectedCity, onChange: setSelectedCity }, render: c => `${c.village_town || ''}${c.district ? `, ${c.district}` : ''}` || '-' },
    phone: { label: 'PHONE', filter: { mode: 'search', value: searchQuery, onChange: setSearchQuery, placeholder: 'Search phone…' }, render: c => c.phone_1 || '-' },
    type: {
      label: 'TYPE',
      filter: { mode: 'select', options: categoryOptions, value: selectedCategory, onChange: setSelectedCategory },
      render: c => c.category ? <span className={`badge ${c.category.toLowerCase() === 'dealer' ? 'dealer' : 'customer'}`}>{c.category}</span> : '-',
    },
    grade: { label: 'GRADE', filter: { mode: 'select', options: gradeOptions, value: selectedGrade, onChange: setSelectedGrade }, render: c => c.customer_grade || '-' },
    house: { label: 'HOUSE', filter: { mode: 'select', options: houseOptions, value: selectedHouseType, onChange: setSelectedHouseType }, render: c => c.house_type || '-' },
    purchase: { label: 'PURCHASE', filter: { mode: 'select', options: purchaseOptions, value: selectedPurchaseType, onChange: setSelectedPurchaseType }, render: c => c.purchase_type || '-' },
    products: { label: 'PRODUCTS', filter: { mode: 'select', options: productOptions, value: selectedProduct, onChange: setSelectedProduct }, render: c => (Array.isArray(c.products) && c.products.length) ? c.products.join(', ') : '-' },
    age: { label: 'AGE', render: c => c.age || '-' },
    business: { label: 'BUSINESS', render: c => c.business_name || '-' },
    insta: { label: 'INSTAGRAM', render: c => c.instagram_id || '-' },
    state: { label: 'STATE', filter: { mode: 'select', options: uniqueStates, value: selectedState, onChange: v => { setSelectedState(v); setSelectedDistrict(''); setSelectedCity(''); } }, render: c => c.state || '-' },
    district: { label: 'DISTRICT', filter: { mode: 'select', options: uniqueDistricts, value: selectedDistrict, onChange: v => { setSelectedDistrict(v); setSelectedCity(''); } }, render: c => c.district || '-' },
    city: { label: 'VILLAGE / TOWN', filter: { mode: 'select', options: uniqueCities, value: selectedCity, onChange: setSelectedCity }, render: c => c.village_town || '-' },
    pincode: { label: 'PINCODE', render: c => c.pincode || '-' },
    date: { label: 'DATE', render: c => { const d = c.contact_date || c.createdAt; return d ? new Date(d).toLocaleDateString('en-GB') : '-'; } },
    phone2: { label: 'PHONE 2', render: c => c.phone_2 || '-' },
  };

  const visibleColumns = columnOrder.filter(k => columnDefs[k] && !hiddenCols.includes(k));
  const colCount = visibleColumns.length + 1; // + ACTIONS
  const columnLabels = Object.fromEntries(columnOrder.map(k => [k, columnDefs[k]?.label || k]));

  return (
    <>
      <div style={{ padding: '24px 32px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-dark)' }}>Directory</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 4 }}>Manage and filter all your enterprise contacts</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div className="search-bar" style={{ margin: 0, width: '280px', background: 'white' }}>
            <Search size={16} color="var(--text-muted)" />
            <input
              type="text"
              placeholder="Search name, phone, business…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div
            onClick={() => navigate('/settings')}
            title="Settings"
            style={{ width: 32, height: 32, borderRadius: '50%', background: '#CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
          >
            <UserIcon size={18} color="white" />
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 32px', borderBottom: '1px solid var(--border-color)' }}>
        {/* Controls row: Filters toggle (left) + actions (right) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              className="btn"
              onClick={() => setShowMoreFilters(o => !o)}
              style={{
                border: '1px solid var(--border-color)',
                background: (showMoreFilters || hasActiveFilters) ? 'var(--highlight)' : 'var(--bg-white)',
                color: (showMoreFilters || hasActiveFilters) ? 'var(--primary-accent)' : 'var(--text-dark)',
              }}
            >
              <SlidersHorizontal size={16} /> Filters
              {activeFilterCount > 0 && <span className="filter-badge">{activeFilterCount}</span>}
            </button>
            {hasActiveFilters && (
              <button
                className="btn-link"
                onClick={clearFilters}
                style={{ color: '#EF4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
              >
                <X size={14} /> Clear all
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button className="btn" onClick={handleLabels} disabled={printingLabels}
              title="Print 50mm x 30mm mailing labels for the filtered contacts"
              style={{ border: '1px solid var(--border-color)', background: 'var(--bg-white)', color: 'var(--text-dark)' }}>
              <Tags size={16} /> {printingLabels ? 'Preparing…' : `Labels${hasActiveFilters ? ` (${total})` : ''}`}
            </button>
            <button className="btn" onClick={handleExport} disabled={exporting}
              style={{ border: '1px solid var(--border-color)', background: 'var(--bg-white)', color: 'var(--text-dark)' }}>
              <Download size={16} /> {exporting ? 'Exporting…' : `Export${hasActiveFilters ? ` (${total})` : ''}`}
            </button>
            <button className="btn btn-primary" onClick={onAdd}>+ Add Contact</button>
          </div>
        </div>

        {/* Filter panel — labeled fields in an even grid */}
        {showMoreFilters && (
          <div className="filter-panel">
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
              <label>Relation</label>
              <CustomSelect value={selectedRelation} onChange={e => setSelectedRelation(e.target.value)}
                options={[{ label: 'All Relations', value: '' }, ...relationOptions.map(r => ({ label: r, value: r }))]}
                placeholder="All Relations" />
            </div>
          </div>
        )}

      </div>

      <div className="page-container">
        <div className="table-container" style={{ opacity: loading && contacts.length > 0 ? 0.55 : 1, transition: 'opacity 0.15s ease' }}>
          <table className="data-table">
            <thead>
              <tr>
                {visibleColumns.map((key, i) => {
                  const col = columnDefs[key];
                  const alignRight = i === visibleColumns.length - 1;
                  return (
                    <th key={key}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {i === 0 && (
                          <ColumnManager
                            order={columnOrder}
                            hidden={hiddenCols}
                            labels={columnLabels}
                            onToggle={toggleColumn}
                            onReorder={reorderColumns}
                          />
                        )}
                        {col.filter
                          ? <ColumnFilter label={col.label} alignRight={alignRight} {...col.filter} />
                          : <span>{col.label}</span>}
                      </div>
                    </th>
                  );
                })}
                <th>ACTIONS</th>
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
                  <tr key={contact._id}>
                    {visibleColumns.map(key => (
                      <td key={key}>{columnDefs[key].render(contact)}</td>
                    ))}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <button
                          className="btn-link"
                          onClick={() => onEdit(contact)}
                          style={{ fontWeight: 600, color: 'var(--primary-accent)', padding: 0 }}
                        >
                          Edit
                        </button>
                        <button
                          className="btn-link"
                          onClick={() => setContactToDelete(contact)}
                          disabled={deletingId === contact._id}
                          style={{ padding: 0, color: deletingId === contact._id ? '#CBD5E1' : '#DC2626', display: 'flex', alignItems: 'center', gap: 4 }}
                        >
                          <Trash2 size={15} />
                          {deletingId === contact._id ? '…' : 'Delete'}
                        </button>
                      </div>
                    </td>
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
                  style={{ background: '#DC2626' }}
                  disabled={deletingId}
                >
                  {deletingId ? 'Deleting...' : 'Delete Contact'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.type === 'error' ? 'Error' : 'Success'}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ isOpen: false, message: '', type: 'error' })}
      />
    </>
  );
}
