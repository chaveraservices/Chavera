import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import api from '../utils/api';
import useDebounce from '../utils/useDebounce';
import { contactsToExportRows } from '../utils/contactFields';
import { Search, Bell, User as UserIcon, Download, Trash2, X, Printer } from 'lucide-react';
import CustomSelect from '../components/CustomSelect';
import AlertModal from '../components/AlertModal';

export default function ContactsPage({ onAdd, onEdit }) {
  const [contacts, setContacts] = useState([]); // current page only
  const [total, setTotal] = useState(0);        // matching count (server)
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [contactToDelete, setContactToDelete] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', type: 'error' });

  // Filter options (distinct values from the server)
  const [tuples, setTuples] = useState([]);        // [{state, district, city}]
  const [categories, setCategories] = useState([]);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

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
  }), [debouncedSearch, selectedState, selectedDistrict, selectedCity, selectedCategory]);

  // Load distinct filter options once (and after mutations).
  useEffect(() => {
    api.post('/contact/filter-options')
      .then(res => {
        if (res.data.success) {
          setTuples(res.data.data.tuples || []);
          setCategories(res.data.data.categories || []);
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

  // Pagination math (driven by server total)
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const rangeStart = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const rangeEnd = Math.min(currentPage * pageSize, total);

  const handleDeleteClick = (contact) => {
    setContactToDelete(contact);
  };

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

  const handlePrint = async () => {
    setPrinting(true);
    try {
      // Pull the full matching set (ignores pagination) for the print.
      const res = await api.post('/contact/list', { all: true, ...filterParams });
      const source = res.data?.data?.items || [];
      if (source.length === 0) { 
        setAlertConfig({ isOpen: true, message: 'No contacts to print', type: 'error' });
        return; 
      }

      // Create an iframe to print
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      const htmlContent = `
        <html>
          <head>
            <title>Print Contacts</title>
            <style>
              body { font-family: sans-serif; padding: 20px; color: #333; }
              table { width: 100%; border-collapse: collapse; margin-top: 20px; }
              th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
              th { background-color: #f8fafc; font-weight: 600; }
              h1 { text-align: center; color: #1a365d; }
              @media print {
                @page { margin: 20px; }
              }
            </style>
          </head>
          <body>
            <h1>Contact Directory</h1>
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Address</th>
                </tr>
              </thead>
              <tbody>
                ${source.map(contact => {
                  const name = contact.full_name + (contact.business_name ? " (" + contact.business_name + ")" : "");
                  const address = [contact.door_flat_no, contact.street, contact.village_town, contact.district, contact.state, contact.pincode].filter(Boolean).join(', ');
                  return "<tr><td>" + name + "</td><td>" + address + "</td></tr>";
                }).join('')}
              </tbody>
            </table>
          </body>
        </html>
      `;

      iframe.contentDocument.open();
      iframe.contentDocument.write(htmlContent);
      iframe.contentDocument.close();

      // Wait for iframe content to render before printing
      setTimeout(() => {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
        setTimeout(() => {
          document.body.removeChild(iframe);
        }, 1000);
      }, 500);

    } catch (err) {
      setAlertConfig({ isOpen: true, message: err.response?.data?.message || 'Failed to prepare print', type: 'error' });
    } finally {
      setPrinting(false);
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
  };

  const hasActiveFilters = searchQuery || selectedState || selectedDistrict || selectedCity || selectedCategory;

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
          <div style={{ cursor: 'pointer', color: 'var(--text-muted)' }}><Bell size={20} /></div>
          <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#CBD5E1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserIcon size={18} color="white" />
          </div>
        </div>
      </div>

      <div style={{ padding: '20px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16, borderBottom: '1px solid var(--border-color)' }}>
        <div className="filters-group" style={{ flex: 1 }}>
          <CustomSelect
            className="select-input"
            value={selectedState}
            onChange={e => { setSelectedState(e.target.value); setSelectedDistrict(''); setSelectedCity(''); }}
            options={[
              { label: 'All States', value: '' },
              ...uniqueStates.map(s => ({ label: s, value: s }))
            ]}
            placeholder="All States"
          />

          <CustomSelect
            className="select-input"
            value={selectedDistrict}
            onChange={e => { setSelectedDistrict(e.target.value); setSelectedCity(''); }}
            options={[
              { label: 'All Districts', value: '' },
              ...uniqueDistricts.map(d => ({ label: d, value: d }))
            ]}
            placeholder="All Districts"
          />

          <CustomSelect
            className="select-input"
            value={selectedCity}
            onChange={e => setSelectedCity(e.target.value)}
            options={[
              { label: 'All Cities', value: '' },
              ...uniqueCities.map(c => ({ label: c, value: c }))
            ]}
            placeholder="All Cities"
          />

          <CustomSelect
            className="select-input"
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            options={[
              { label: 'All Categories', value: '' },
              ...categories.map(cat => ({ label: cat, value: cat }))
            ]}
            placeholder="All Categories"
          />

          {hasActiveFilters && (
            <button
              className="btn-link"
              onClick={clearFilters}
              style={{ color: '#EF4444', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px' }}
            >
              <X size={14} /> Clear
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            className="btn"
            onClick={handlePrint}
            disabled={printing}
            style={{ border: '1px solid var(--border-color)', background: 'var(--bg-white)', color: 'var(--text-dark)' }}
          >
            <Printer size={16} /> {printing ? 'Preparing…' : 'Print'}
          </button>
          <button
            className="btn"
            onClick={handleExport}
            disabled={exporting}
            style={{ border: '1px solid var(--border-color)', background: 'var(--bg-white)', color: 'var(--text-dark)' }}
          >
            <Download size={16} /> {exporting ? 'Exporting…' : `Export${hasActiveFilters ? ` (${total})` : ''}`}
          </button>
          <button className="btn btn-primary" onClick={onAdd}>+ Add Contact</button>
        </div>
      </div>

      {/* Results summary */}
      {hasActiveFilters && !loading && (
        <div style={{ padding: '0 32px 8px 32px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Found <strong>{total}</strong> matching {total === 1 ? 'contact' : 'contacts'}
        </div>
      )}

      <div className="page-container">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>NAME</th>
                <th>RELATION</th>
                <th>LOCATION</th>
                <th>PHONE</th>
                <th>TYPE</th>
                <th>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td><div className="shimmer-block" style={{ height: '20px', width: '80%' }}></div></td>
                    <td><div className="shimmer-block" style={{ height: '20px', width: '60%' }}></div></td>
                    <td><div className="shimmer-block" style={{ height: '20px', width: '90%' }}></div></td>
                    <td><div className="shimmer-block" style={{ height: '20px', width: '70%' }}></div></td>
                    <td><div className="shimmer-block" style={{ height: '24px', width: '80px', borderRadius: '12px' }}></div></td>
                    <td><div className="shimmer-block" style={{ height: '24px', width: '50px' }}></div></td>
                  </tr>
                ))
              ) : total === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    {hasActiveFilters ? 'No contacts match your filters.' : 'No contacts found.'}
                  </td>
                </tr>
              ) : (
                contacts.map(contact => (
                  <tr key={contact._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{contact.honorific ? `${contact.honorific} ` : ''}{contact.full_name}</div>
                      {contact.business_name && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{contact.business_name}</div>}
                    </td>
                    <td>{contact.relation || '-'}</td>
                    <td>{contact.village_town}{contact.district ? `, ${contact.district}` : ''}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {contact.phone_1}
                      </div>
                    </td>
                    <td>
                      {contact.category && (
                        <span className={`badge ${contact.category.toLowerCase() === 'dealer' ? 'dealer' : 'customer'}`}>
                          {contact.category}
                        </span>
                      )}
                    </td>
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
