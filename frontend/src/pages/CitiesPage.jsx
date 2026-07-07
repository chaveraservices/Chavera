import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Building2, Search, X, MapPin, ChevronDown } from 'lucide-react';
import CustomSelect from '../components/CustomSelect';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';
import api from '../utils/api';

export default function CitiesPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [modalState, setModalState] = useState('');
  const [modalDistrict, setModalDistrict] = useState('');
  const [newCity, setNewCity] = useState('');
  const [addingCity, setAddingCity] = useState(false);
  const [cityError, setCityError] = useState('');

  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, state: '', district: '', city: '' });
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', type: 'error' });

  const fetchLocations = async () => {
    try {
      const res = await api.post('/location/list');
      if (res.data.success) setLocations(res.data.data);
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLocations(); }, []);

  const availableDistrictsForFilter = locations.find(l => l.state === selectedState)?.districts || [];

  const allCities = useMemo(() => {
    const list = [];
    locations.forEach(loc => {
      (loc.districts || []).forEach(dist => {
        (dist.cities || []).forEach(city => {
          list.push({ state: loc.state, district: dist.name, city });
        });
      });
    });
    return list.sort((a, b) => a.city.localeCompare(b.city));
  }, [locations]);

  const filteredCities = useMemo(() => {
    return allCities.filter(c => {
      if (selectedState && c.state !== selectedState) return false;
      if (selectedDistrict && c.district !== selectedDistrict) return false;
      if (searchQuery && !c.city.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [allCities, selectedState, selectedDistrict, searchQuery]);

  const handleStateChange = (e) => {
    setSelectedState(e.target.value);
    setSelectedDistrict('');
  };

  const openAddModal = () => {
    setModalState(selectedState);
    setModalDistrict(selectedDistrict);
    setNewCity('');
    setCityError('');
    setShowAddModal(true);
  };

  const handleAddCity = async () => {
    if (!newCity.trim() || !modalState || !modalDistrict) {
      setCityError('Please fill out all fields.');
      return;
    }
    setAddingCity(true);
    setCityError('');
    try {
      const res = await api.post('/location/add-city', {
        state: modalState,
        district: modalDistrict,
        city: newCity.trim()
      });
      if (res.data.success) {
        setLocations(prev => prev.map(l => l.state === modalState ? res.data.data : l));
        setShowAddModal(false);
      }
    } catch (err) {
      setCityError(err.response?.data?.message || 'Failed to add city');
    } finally { setAddingCity(false); }
  };

  const triggerDeleteCity = (state, district, cityName) => {
    setConfirmDelete({ isOpen: true, state, district, city: cityName });
  };

  const handleDeleteCity = async () => {
    const { state, district, city: cityName } = confirmDelete;
    setConfirmDelete({ isOpen: false, state: '', district: '', city: '' });
    try {
      const res = await api.post('/location/delete-city', { state, district, city: cityName });
      if (res.data.success) {
        setLocations(prev => prev.map(l => l.state === state ? res.data.data : l));
      }
    } catch (err) {
      setAlertConfig({ isOpen: true, message: err.response?.data?.message || 'Failed to delete city', type: 'error' });
    }
  };

  const modalAvailableDistricts = locations.find(l => l.state === modalState)?.districts || [];
  const isFiltered = selectedState || selectedDistrict || searchQuery;

  return (
    <div className="page-container" style={{ paddingTop: 32, maxWidth: 1000 }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-dark)' }}>Cities &amp; Villages</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 4 }}>
            Browse, search, and manage all cities and villages across districts.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={16} /> Add City
        </button>
      </div>

      {/* ── Filters Bar ── */}
      <div style={{
        background: 'var(--bg-white)', border: '1px solid var(--border-color)',
        borderRadius: 12, padding: '16px 20px',
        display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap',
        marginBottom: 20,
      }}>
        {/* State */}
        <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            State
          </label>
          <CustomSelect
            name="stateFilter"
            value={selectedState}
            onChange={handleStateChange}
            options={[
              { label: 'All States', value: '' },
              ...locations.map(loc => ({ label: loc.state, value: loc.state }))
            ]}
            placeholder="All States"
          />
        </div>

        {/* District */}
        <div style={{ flex: '1 1 180px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            District
          </label>
          <CustomSelect
            name="districtFilter"
            value={selectedDistrict}
            onChange={e => setSelectedDistrict(e.target.value)}
            disabled={!selectedState}
            options={[
              { label: 'All Districts', value: '' },
              ...availableDistrictsForFilter.map(d => ({ label: d.name, value: d.name }))
            ]}
            placeholder={selectedState ? 'All Districts' : 'Select state first'}
          />
        </div>

        {/* Search */}
        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Search
          </label>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg-main)', border: '1px solid var(--border-color)',
            borderRadius: 8, padding: '8px 12px', transition: 'border-color 0.2s',
          }}
            onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--primary-accent)'}
            onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
          >
            <Search size={15} color="var(--text-muted)" style={{ flexShrink: 0 }} />
            <input
              style={{
                border: 'none', outline: 'none', background: 'transparent',
                width: '100%', fontFamily: 'inherit', fontSize: '0.9rem', color: 'var(--text-dark)',
              }}
              placeholder="Search cities…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)', display: 'flex' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Clear filters */}
        {isFiltered && (
          <button
            onClick={() => { setSelectedState(''); setSelectedDistrict(''); setSearchQuery(''); }}
            style={{
              background: 'none', border: '1px solid var(--border-color)', borderRadius: 8,
              padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit',
              fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s',
              alignSelf: 'flex-end',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <X size={13} /> Clear
          </button>
        )}
      </div>

      {/* ── Result count + grid ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 14,
      }}>
        <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', fontWeight: 500 }}>
          {loading ? 'Loading…' : (
            <>
              Showing <strong style={{ color: 'var(--text-dark)' }}>{filteredCities.length}</strong> {filteredCities.length === 1 ? 'city' : 'cities'}
              {allCities.length !== filteredCities.length && ` of ${allCities.length} total`}
            </>
          )}
        </p>
      </div>

      {/* ── City Cards ── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="shimmer-block" style={{ height: 70, borderRadius: 10 }} />
          ))}
        </div>
      ) : filteredCities.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '4rem 2rem',
          background: 'var(--bg-white)', border: '1px dashed var(--border-color)',
          borderRadius: 16, color: 'var(--text-muted)',
        }}>
          <Building2 size={44} style={{ marginBottom: 14, opacity: 0.25 }} />
          <p style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 6 }}>No cities found</p>
          <p style={{ fontSize: '0.875rem' }}>
            {isFiltered ? 'Try adjusting your filters.' : 'Add your first city using the button above.'}
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
          gap: 10,
        }}>
          {filteredCities.map(item => (
            <div
              key={`${item.state}-${item.district}-${item.city}`}
              style={{
                background: 'var(--bg-white)',
                border: '1px solid var(--border-color)',
                borderRadius: 10,
                padding: '12px 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 10, transition: 'border-color 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#CBD5E1'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 7,
                  background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Building2 size={14} color="#16A34A" />
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{
                    fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-dark)',
                    whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden',
                  }} title={item.city}>
                    {item.city}
                  </div>
                  <div style={{
                    fontSize: '0.74rem', color: 'var(--text-muted)',
                    whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden',
                    marginTop: 1,
                  }}>
                    {item.district} · {item.state}
                  </div>
                </div>
              </div>
              <button
                onClick={() => triggerDeleteCity(item.state, item.district, item.city)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 4, color: '#CBD5E1', display: 'flex', alignItems: 'center',
                  flexShrink: 0, transition: 'color 0.15s', borderRadius: 6,
                }}
                onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
                onMouseLeave={e => e.currentTarget.style.color = '#CBD5E1'}
                title="Delete City"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Add City Modal ── */}
      {showAddModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowAddModal(false)}
          style={{ backdropFilter: 'blur(3px)' }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 440, borderRadius: 16 }}
          >
            {/* Modal header */}
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '18px 24px', borderBottom: '1px solid var(--border-color)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8,
                  background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Building2 size={18} color="#16A34A" />
                </div>
                <div>
                  <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-dark)', margin: 0 }}>Add City / Village</h2>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Select location then enter name</p>
                </div>
              </div>
              <button
                className="close-btn"
                onClick={() => setShowAddModal(false)}
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)' }}>
                  State <span style={{ color: 'var(--primary-accent)' }}>*</span>
                </label>
                <CustomSelect
                  value={modalState}
                  onChange={e => { setModalState(e.target.value); setModalDistrict(''); }}
                  options={[
                    { label: 'Select a state', value: '' },
                    ...locations.map(loc => ({ label: loc.state, value: loc.state }))
                  ]}
                  placeholder="Select a state"
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)' }}>
                  District <span style={{ color: 'var(--primary-accent)' }}>*</span>
                </label>
                <CustomSelect
                  value={modalDistrict}
                  onChange={e => setModalDistrict(e.target.value)}
                  disabled={!modalState}
                  options={[
                    { label: 'Select a district', value: '' },
                    ...modalAvailableDistricts.map(d => ({ label: d.name, value: d.name }))
                  ]}
                  placeholder={modalState ? 'Select a district' : 'Select state first'}
                />
              </div>

              <div className="form-group">
                <label style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-dark)' }}>
                  City / Village Name <span style={{ color: 'var(--primary-accent)' }}>*</span>
                </label>
                <input
                  className="input-field"
                  placeholder="e.g. Anand, Nadiad, Rajkot…"
                  value={newCity}
                  onChange={e => { setNewCity(e.target.value); setCityError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleAddCity()}
                  autoFocus
                />
              </div>

              {cityError && (
                <div style={{
                  padding: '10px 14px', background: '#FEF2F2',
                  border: '1px solid #FECACA', borderRadius: 8,
                  color: '#DC2626', fontSize: '0.84rem', fontWeight: 500,
                }}>
                  {cityError}
                </div>
              )}

              {/* Footer */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{
                    background: 'none', border: '1px solid var(--border-color)',
                    borderRadius: 8, padding: '9px 18px', cursor: 'pointer',
                    fontFamily: 'inherit', fontWeight: 600, fontSize: '0.88rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleAddCity}
                  disabled={addingCity || !newCity.trim() || !modalState || !modalDistrict}
                >
                  {addingCity ? 'Saving…' : 'Save City'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Delete City"
        message={`Delete "${confirmDelete.city}" from ${confirmDelete.district}?`}
        onConfirm={handleDeleteCity}
        onCancel={() => setConfirmDelete({ isOpen: false, state: '', district: '', city: '' })}
      />
      <AlertModal
        isOpen={alertConfig.isOpen}
        title={alertConfig.type === 'error' ? 'Error' : 'Success'}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={() => setAlertConfig({ isOpen: false, message: '', type: 'error' })}
      />
    </div>
  );
}
