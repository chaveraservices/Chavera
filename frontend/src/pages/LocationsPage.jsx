import { useState, useEffect } from 'react';
import { Plus, Trash2, MapPin, X } from 'lucide-react';
import api from '../utils/api';
import ConfirmModal from '../components/ConfirmModal';
import AlertModal from '../components/AlertModal';

export default function LocationsPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State for Add State input
  const [newState, setNewState] = useState('');
  const [addingState, setAddingState] = useState(false);
  const [stateError, setStateError] = useState('');

  // State for the Modal
  const [selectedState, setSelectedState] = useState(null); // The full location object

  // Custom Modals
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, stateName: '' });
  const [alertConfig, setAlertConfig] = useState({ isOpen: false, message: '', type: 'error' });

  const fetchLocations = async () => {
    try {
      const res = await api.post('/location/list');
      if (res.data.success) setLocations(res.data.data);
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLocations(); }, []);

  const handleAddState = async () => {
    if (!newState.trim()) return;
    setAddingState(true);
    setStateError('');
    try {
      const res = await api.post('/location/add-state', { state: newState.trim() });
      if (res.data.success) {
        setLocations(prev => [...prev, res.data.data].sort((a, b) => a.state.localeCompare(b.state)));
        setNewState('');
        setSelectedState(res.data.data); // Open modal automatically
      }
    } catch (err) {
      setStateError(err.response?.data?.message || 'Failed to add state');
    } finally { setAddingState(false); }
  };

  const handleDeleteState = async () => {
    const state = confirmDelete.stateName;
    setConfirmDelete({ isOpen: false, stateName: '' });
    try {
      await api.post('/location/delete-state', { state });
      setLocations(prev => prev.filter(l => l.state !== state));
      if (selectedState?.state === state) setSelectedState(null);
    } catch (err) {
      setAlertConfig({ isOpen: true, message: err.response?.data?.message || 'Failed to delete state', type: 'error' });
    }
  };

  // Keep modal in sync with locations. Uses the functional updater so the
  // effect only depends on `locations` without capturing a stale selectedState.
  useEffect(() => {
    setSelectedState(prev => (prev ? locations.find(l => l.state === prev.state) || prev : prev));
  }, [locations]);

  return (
    <div className="page-container" style={{ paddingTop: 32, maxWidth: 860 }}>
      {/* Header */}
      <div className="form-header-flex" style={{ marginBottom: 8 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-dark)' }}>States &amp; Districts</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 4 }}>
            Manage the states and districts available in the contact form dropdowns.
          </p>
        </div>
      </div>

      {/* Add State */}
      <div className="form-section" style={{ marginBottom: 20 }}>
        <div className="form-section-title">ADD NEW STATE</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            className="input-field"
            style={{ maxWidth: 280 }}
            placeholder="e.g. Maharashtra, Karnataka…"
            value={newState}
            onChange={e => { setNewState(e.target.value); setStateError(''); }}
            onKeyDown={e => e.key === 'Enter' && handleAddState()}
          />
          <button
            className="btn btn-primary"
            onClick={handleAddState}
            disabled={addingState || !newState.trim()}
          >
            <Plus size={16} /> {addingState ? 'Adding…' : 'Add State'}
          </button>
        </div>
        {stateError && (
          <p style={{ color: '#DC2626', fontSize: '0.85rem', marginTop: 10 }}>{stateError}</p>
        )}
      </div>

      {/* States list (Grid view) */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="shimmer-block" style={{ height: '70px', borderRadius: '12px' }}></div>
          ))}
        </div>
      ) : locations.length === 0 ? (
        <div className="form-section" style={{ textAlign: 'center', padding: '3rem 2rem', color: 'var(--text-muted)' }}>
          <MapPin size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p style={{ fontWeight: 600 }}>No states yet</p>
          <p style={{ fontSize: '0.875rem', marginTop: 4 }}>Add your first state above to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16 }}>
          {locations.map(loc => {
            const locDistricts = loc.districts || [];
            const totalCities = locDistricts.reduce((sum, d) => sum + (d.cities?.length || 0), 0);
            return (
              <div
                key={loc.state}
                className="loc-card"
                onClick={() => setSelectedState(loc)}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <MapPin size={20} color="var(--primary-accent)" />
                    <span style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '1.1rem' }}>{loc.state}</span>
                  </div>
                  <button
                    className="btn-link"
                    onClick={e => { e.stopPropagation(); setConfirmDelete({ isOpen: true, stateName: loc.state }); }}
                    style={{ color: '#DC2626', padding: '4px', lineHeight: 1 }}
                    title="Delete State"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                
                <div style={{ display: 'flex', gap: 12, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  <div className="stat-pill">
                    <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{locDistricts.length}</span> District{locDistricts.length !== 1 ? 's' : ''}
                  </div>
                  <div className="stat-pill">
                    <span style={{ fontWeight: 600, color: 'var(--text-dark)' }}>{totalCities}</span> Cit{totalCities !== 1 ? 'ies' : 'y'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* State Details Modal */}
      {selectedState && (
        <StateModal 
          location={selectedState} 
          onClose={() => setSelectedState(null)} 
          setLocations={setLocations}
          setAlertConfig={setAlertConfig}
        />
      )}

      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Delete State"
        message={`Delete state "${confirmDelete.stateName}" and all its districts and cities?`}
        onConfirm={handleDeleteState}
        onCancel={() => setConfirmDelete({ isOpen: false, stateName: '' })}
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

function StateModal({ location, onClose, setLocations, setAlertConfig }) {
  const [newDistrict, setNewDistrict] = useState('');
  const [addingDistrict, setAddingDistrict] = useState(false);
  const [districtError, setDistrictError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, districtName: '' });

  const handleAddDistrict = async () => {
    if (!newDistrict.trim()) return;
    setAddingDistrict(true);
    setDistrictError('');
    try {
      const res = await api.post('/location/add-district', { state: location.state, district: newDistrict.trim() });
      if (res.data.success) {
        setLocations(prev => prev.map(l => l.state === location.state ? res.data.data : l));
        setNewDistrict('');
      }
    } catch (err) {
      setDistrictError(err.response?.data?.message || 'Failed to add district');
    } finally { setAddingDistrict(false); }
  };

  const handleDeleteDistrict = async () => {
    const districtName = confirmDelete.districtName;
    setConfirmDelete({ isOpen: false, districtName: '' });
    try {
      const res = await api.post('/location/delete-district', { state: location.state, district: districtName });
      if (res.data.success) {
        setLocations(prev => prev.map(l => l.state === location.state ? res.data.data : l));
      }
    } catch (err) {
      setAlertConfig({ isOpen: true, message: err.response?.data?.message || 'Failed to delete district', type: 'error' });
    }
  };

  return (
    <>
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
          
          <div className="modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <MapPin size={24} color="var(--primary-accent)" />
              <h2 style={{ margin: 0 }}>{location.state}</h2>
              <span style={{ background: '#E2E8F0', padding: '4px 12px', borderRadius: 999, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {(location.districts || []).length} Districts
              </span>
            </div>
            <button className="close-btn" onClick={onClose}><X size={24} /></button>
          </div>

          <div className="modal-body" style={{ background: '#F8FAFC' }}>
            
            {/* Add District */}
            <div style={{ background: 'white', padding: 20, borderRadius: 12, border: '1px solid var(--border-color)', marginBottom: 20 }}>
              <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-dark)', marginBottom: 12 }}>Add District</h3>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <input
                  className="input-field"
                  style={{ flex: 1 }}
                  placeholder="New district name…"
                  value={newDistrict}
                  onChange={e => { setNewDistrict(e.target.value); setDistrictError(''); }}
                  onKeyDown={e => e.key === 'Enter' && handleAddDistrict()}
                />
                <button className="btn btn-primary" onClick={handleAddDistrict} disabled={addingDistrict || !newDistrict.trim()}>
                  <Plus size={16} /> Add District
                </button>
              </div>
              {districtError && <p style={{ color: '#DC2626', fontSize: '0.85rem', marginTop: 10 }}>{districtError}</p>}
            </div>

            {/* Districts List */}
            {(location.districts || []).length === 0 ? (
              <p style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No districts added to {location.state} yet.</p>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                {(location.districts || []).map(dist => (
                  <div key={dist.name} className="district-chip">
                    <span style={{ fontWeight: 500 }}>{dist.name}</span>
                    <button
                      className="icon-delete-btn"
                      onClick={() => setConfirmDelete({ isOpen: true, districtName: dist.name })}
                      style={{ padding: '0 0 0 4px' }}
                      title={`Delete ${dist.name}`}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Rendered OUTSIDE the overlay so its backdrop doesn't bubble to close StateModal */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title="Delete District"
        message={`Delete district "${confirmDelete.districtName}" and all its cities?`}
        onConfirm={handleDeleteDistrict}
        onCancel={() => setConfirmDelete({ isOpen: false, districtName: '' })}
      />
    </>
  );
}
