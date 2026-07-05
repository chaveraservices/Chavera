import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Building2, Search, X } from 'lucide-react';
import CustomSelect from '../components/CustomSelect';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';
import api from '../utils/api';

export default function CitiesPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Add Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalState, setModalState] = useState('');
  const [modalDistrict, setModalDistrict] = useState('');
  const [newCity, setNewCity] = useState('');
  const [addingCity, setAddingCity] = useState(false);
  const [cityError, setCityError] = useState('');

  // Delete / Alert Modals
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

  // Filter dropdown options based on location data
  const availableDistrictsForFilter = locations.find(l => l.state === selectedState)?.districts || [];
  
  // Flatten all cities for the default view
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

  // Apply filters to the flat list
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

  // Modal district dropdown options
  const modalAvailableDistricts = locations.find(l => l.state === modalState)?.districts || [];

  return (
    <div className="page-container" style={{ paddingTop: 32, maxWidth: 960 }}>
      {/* Header */}
      <div className="form-header-flex" style={{ marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-dark)' }}>Cities Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 4 }}>
            Manage villages and towns.
          </p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={16} /> Add City
        </button>
      </div>

      {/* Filters */}
      <div className="form-section" style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)' }}>Filter by State</label>
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
        
        <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)' }}>Filter by District</label>
          <CustomSelect 
            name="districtFilter"
            value={selectedDistrict} 
            onChange={e => setSelectedDistrict(e.target.value)}
            disabled={!selectedState}
            options={[
              { label: 'All Districts', value: '' },
              ...availableDistrictsForFilter.map(dist => ({ label: dist.name, value: dist.name }))
            ]}
            placeholder={selectedState ? "All Districts" : "Select a state first"}
          />
        </div>

        <div style={{ flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-dark)' }}>Search</label>
          <div className="search-bar" style={{ margin: 0, width: '100%', background: 'var(--bg-white)', border: '1px solid var(--border-color)' }}>
            <Search size={16} color="var(--text-muted)" />
            <input 
              placeholder="Search cities..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Cities List */}
      <div className="form-section">
        <div style={{ marginBottom: 16, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Showing {filteredCities.length} {filteredCities.length === 1 ? 'city' : 'cities'}
        </div>
        
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shimmer-block" style={{ height: '62px', borderRadius: '8px' }}></div>
            ))}
          </div>
        ) : filteredCities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)', background: 'var(--bg-main)', borderRadius: 12, border: '1px dashed var(--border-color)' }}>
            <Building2 size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
            <p style={{ fontWeight: 600 }}>No cities found</p>
            <p style={{ fontSize: '0.875rem', marginTop: 4 }}>Try adjusting your filters or add a new city.</p>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', 
            gap: 12,
            maxHeight: 500,
            overflowY: 'auto',
            paddingRight: 8
          }}>
            {filteredCities.map(item => (
              <div key={`${item.state}-${item.district}-${item.city}`} className="city-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflow: 'hidden' }}>
                  <Building2 size={16} color="var(--primary-accent)" style={{ flexShrink: 0 }} />
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ fontWeight: 600, textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }} title={item.city}>
                      {item.city}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                      {item.district}, {item.state}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => triggerDeleteCity(item.state, item.district, item.city)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#CBD5E1', display: 'flex', alignItems: 'center' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
                  onMouseLeave={e => e.currentTarget.style.color = '#CBD5E1'}
                  title="Delete City"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add City Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2>Add New City</h2>
              <button className="close-btn" onClick={() => setShowAddModal(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>State</label>
                <CustomSelect 
                  value={modalState} 
                  onChange={e => { setModalState(e.target.value); setModalDistrict(''); }}
                  options={[
                    { label: 'Select State', value: '' },
                    ...locations.map(loc => ({ label: loc.state, value: loc.state }))
                  ]}
                  placeholder="Select State"
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>District</label>
                <CustomSelect 
                  value={modalDistrict} 
                  onChange={e => setModalDistrict(e.target.value)}
                  disabled={!modalState}
                  options={[
                    { label: 'Select District', value: '' },
                    ...modalAvailableDistricts.map(dist => ({ label: dist.name, value: dist.name }))
                  ]}
                  placeholder={modalState ? "Select District" : "Select a state first"}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label>City / Village Name</label>
                <input
                  className="input-field"
                  placeholder="e.g. Anand, Nadiad…"
                  value={newCity}
                  onChange={e => { setNewCity(e.target.value); setCityError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleAddCity()}
                />
              </div>

              {cityError && (
                <div style={{ color: '#DC2626', fontSize: '0.85rem', marginBottom: 16 }}>
                  {cityError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
                <button className="btn" onClick={() => setShowAddModal(false)} style={{ border: '1px solid var(--border-color)', background: 'var(--bg-white)' }}>
                  Cancel
                </button>
                <button className="btn btn-primary" onClick={handleAddCity} disabled={addingCity || !newCity.trim() || !modalState || !modalDistrict}>
                  {addingCity ? 'Saving...' : 'Save City'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Delete City"
        message={`Delete city "${confirmDelete.city}"?`}
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
