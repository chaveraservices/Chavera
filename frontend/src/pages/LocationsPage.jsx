import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin, Trash2, Edit2, Search, Zap, X, Check,
  Building2, LayoutGrid, Plus, MoreVertical, GripVertical, CirclePlus
} from 'lucide-react';
import api from '../utils/api';
import ConfirmModal from '../components/ConfirmModal';

export default function LocationsPage() {
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedState, setSelectedState] = useState(null);
  const [newState, setNewState] = useState('');
  const [addingState, setAddingState] = useState(false);

  const [newDistrict, setNewDistrict] = useState('');
  const [addingDistrict, setAddingDistrict] = useState(false);

  const [globalSearch, setGlobalSearch] = useState('');
  const [districtSearch, setDistrictSearch] = useState('');

  // Inline rename
  const [renamingState, setRenamingState] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [editingDistrict, setEditingDistrict] = useState('');
  const [editDistrictValue, setEditDistrictValue] = useState('');

  // Toast
  const [toast, setToast] = useState(null); // { message, undo? }

  // Confirm delete
  const [confirmDelete, setConfirmDelete] = useState({ isOpen: false, type: '', name: '' });

  const stateInputRef = useRef(null);
  const districtInputRef = useRef(null);
  const searchRef = useRef(null);
  const fabRef = useRef(null);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchLocations = async () => {
    try {
      const res = await api.post('/location/list');
      if (res.data.success) {
        setLocations(res.data.data);
        if (!selectedState && res.data.data.length > 0) setSelectedState(res.data.data[0]);
      }
    } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLocations(); }, []);

  // Keep selected state fresh when locations update
  useEffect(() => {
    if (selectedState) {
      const fresh = locations.find(l => l.state === selectedState.state);
      if (fresh) setSelectedState(fresh);
    }
  }, [locations]);

  // ── Toast helper ─────────────────────────────────────────────────────────
  const showToast = (message, undoFn = null) => {
    setToast({ message, undoFn });
    setTimeout(() => setToast(null), 4000);
  };

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      // / → focus global search
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      // Esc → clear search, close inline edits
      if (e.key === 'Escape') {
        setGlobalSearch('');
        setRenamingState('');
        setEditingDistrict('');
      }
      // Arrow up/down → navigate state list
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && document.activeElement.tagName !== 'INPUT') {
        const idx = filteredLocations.findIndex(l => l.state === selectedState?.state);
        if (e.key === 'ArrowUp' && idx > 0) setSelectedState(filteredLocations[idx - 1]);
        if (e.key === 'ArrowDown' && idx < filteredLocations.length - 1) setSelectedState(filteredLocations[idx + 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedState, locations, globalSearch]);

  // ── Derived data ─────────────────────────────────────────────────────────
  const filteredLocations = locations.filter(l =>
    !globalSearch || l.state.toLowerCase().includes(globalSearch.toLowerCase()) ||
    l.districts?.some(d => d.name.toLowerCase().includes(globalSearch.toLowerCase()))
  );

  const selectedDistricts = (selectedState
    ? locations.find(l => l.state === selectedState.state)?.districts || []
    : []
  ).filter(d => !districtSearch || d.name.toLowerCase().includes(districtSearch.toLowerCase()));

  const totalDistricts = locations.reduce((s, l) => s + (l.districts?.length || 0), 0);
  const totalCities = locations.reduce((s, l) => s + (l.districts?.reduce((ds, d) => ds + (d.cities?.length || 0), 0) || 0), 0);

  // ── State actions ────────────────────────────────────────────────────────
  const handleAddState = async () => {
    if (!newState.trim() || addingState) return;
    setAddingState(true);
    try {
      const res = await api.post('/location/add-state', { state: newState.trim() });
      if (res.data.success) {
        const updated = [...locations, res.data.data].sort((a, b) => a.state.localeCompare(b.state));
        setLocations(updated);
        setSelectedState(res.data.data);
        showToast(`State "${newState.trim()}" added successfully`);
        setNewState('');
        setTimeout(() => districtInputRef.current?.focus(), 100);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to add state');
    } finally { setAddingState(false); }
  };

  const handleDeleteState = async () => {
    const stateName = confirmDelete.name;
    setConfirmDelete({ isOpen: false, type: '', name: '' });
    try {
      await api.post('/location/delete-state', { state: stateName });
      const updated = locations.filter(l => l.state !== stateName);
      setLocations(updated);
      if (selectedState?.state === stateName) setSelectedState(updated[0] || null);
      showToast(`State "${stateName}" deleted`);
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete state');
    }
  };

  const handleRenameStateSubmit = async () => {
    if (!renameValue.trim() || renameValue === renamingState) { setRenamingState(''); return; }
    // Note: Backend may not support rename — show graceful message
    showToast('Rename is not yet supported by the backend API.');
    setRenamingState('');
  };

  // ── District actions ─────────────────────────────────────────────────────
  const handleAddDistrict = async () => {
    if (!newDistrict.trim() || !selectedState || addingDistrict) return;
    // Support multi-line paste: split by newlines
    const lines = newDistrict.split('\n').map(l => l.trim()).filter(Boolean);
    setAddingDistrict(true);
    let lastData = null;
    for (const line of lines) {
      try {
        const res = await api.post('/location/add-district', { state: selectedState.state, district: line });
        if (res.data.success) lastData = res.data.data;
      } catch (_) {}
    }
    if (lastData) {
      setLocations(prev => prev.map(l => l.state === selectedState.state ? lastData : l));
      showToast(lines.length > 1 ? `${lines.length} districts added` : `District "${lines[0]}" added successfully`);
    }
    setNewDistrict('');
    setAddingDistrict(false);
    districtInputRef.current?.focus();
  };

  const handleDeleteDistrict = async () => {
    const districtName = confirmDelete.name;
    setConfirmDelete({ isOpen: false, type: '', name: '' });
    try {
      const res = await api.post('/location/delete-district', { state: selectedState.state, district: districtName });
      if (res.data.success) {
        setLocations(prev => prev.map(l => l.state === selectedState.state ? res.data.data : l));
        showToast(`District "${districtName}" deleted`);
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to delete district');
    }
  };

  const handleRenameDistrictSubmit = async () => {
    if (!editDistrictValue.trim() || editDistrictValue === editingDistrict) { setEditingDistrict(''); return; }
    showToast('District rename is not yet supported by the backend API.');
    setEditingDistrict('');
  };

  const onConfirm = () => {
    if (confirmDelete.type === 'state') handleDeleteState();
    else handleDeleteDistrict();
  };

  const currentLocObj = locations.find(l => l.state === selectedState?.state);

  return (
    <div className="page-full-bleed" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#F8FAFC' }}>

      {/* ══ Top Bar ══════════════════════════════════════════════════════════ */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 28px', background: '#fff',
        borderBottom: '1px solid #E2E8F0', gap: 20, flexWrap: 'wrap',
        flexShrink: 0,
      }}>
        {/* Title */}
        <div>
          <h1 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1A365D', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <MapPin size={20} color="var(--primary-accent)" /> States &amp; Districts
          </h1>
          <p style={{ fontSize: '0.78rem', color: '#94A3B8', margin: '2px 0 0' }}>
            Manage all your states, districts &amp; cities in one place
          </p>
        </div>

        {/* Global search */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: '#F8FAFC', border: '1px solid #E2E8F0',
          borderRadius: 8, padding: '8px 14px', flex: '0 1 340px',
        }}
          onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--primary-accent)'}
          onBlurCapture={e => e.currentTarget.style.borderColor = '#E2E8F0'}
        >
          <Search size={15} color="#94A3B8" style={{ flexShrink: 0 }} />
          <input
            ref={searchRef}
            style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontFamily: 'inherit', fontSize: '0.88rem', color: '#1A365D' }}
            placeholder="Search states, districts or cities..."
            value={globalSearch}
            onChange={e => setGlobalSearch(e.target.value)}
          />
          <span style={{ fontSize: '0.72rem', color: '#94A3B8', background: '#E2E8F0', borderRadius: 4, padding: '2px 6px', flexShrink: 0 }}>Ctrl K</span>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 20 }}>
          {[
            { icon: <MapPin size={16} color="var(--primary-accent)" />, value: locations.length, label: 'States' },
            { icon: <LayoutGrid size={16} color="#3B82F6" />, value: totalDistricts, label: 'Districts' },
            { icon: <Building2 size={16} color="#059669" />, value: totalCities, label: 'Cities' },
          ].map(({ icon, value, label }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center' }}>
                {icon}
                <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#1A365D' }}>{value}</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: '#94A3B8', marginTop: 1 }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ Body (sidebar + main) ═════════════════════════════════════════════ */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Left Sidebar ────────────────────────────────────────────────── */}
        <div style={{
          width: 268, flexShrink: 0,
          background: '#fff', borderRight: '1px solid #E2E8F0',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>

          {/* Add state input */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #F1F5F9' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#FFF7F5', border: '1px solid #FDDCCC',
              borderRadius: 8, padding: '8px 12px',
              transition: 'border-color 0.2s',
            }}
              onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--primary-accent)'}
              onBlurCapture={e => e.currentTarget.style.borderColor = '#FDDCCC'}
            >
              <MapPin size={14} color="var(--primary-accent)" style={{ flexShrink: 0 }} />
              <input
                ref={stateInputRef}
                style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, fontFamily: 'inherit', fontSize: '0.85rem', color: '#1A365D' }}
                placeholder="Add new state..."
                value={newState}
                onChange={e => setNewState(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddState()}
              />
              <span style={{ fontSize: '0.68rem', color: 'var(--primary-accent)', fontWeight: 600, flexShrink: 0, opacity: newState ? 1 : 0.5 }}>
                Press Enter
              </span>
            </div>
          </div>

          {/* State list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="shimmer-block" style={{ height: 40, borderRadius: 8 }} />
                ))}
              </div>
            ) : filteredLocations.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: '#94A3B8' }}>
                <MapPin size={28} style={{ opacity: 0.2, marginBottom: 8 }} />
                <p style={{ fontWeight: 600, fontSize: '0.85rem' }}>No states yet</p>
              </div>
            ) : (
              filteredLocations.map(loc => {
                const dCount = loc.districts?.length || 0;
                const isActive = selectedState?.state === loc.state;
                return (
                  <div
                    key={loc.state}
                    onClick={() => { setSelectedState(loc); setDistrictSearch(''); }}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', cursor: 'pointer',
                      background: isActive ? '#FFF7F5' : 'transparent',
                      borderLeft: `3px solid ${isActive ? 'var(--primary-accent)' : 'transparent'}`,
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = '#F8FAFC'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, flex: 1, minWidth: 0 }}>
                      <MapPin size={14} color={isActive ? 'var(--primary-accent)' : '#CBD5E1'} style={{ flexShrink: 0 }} />
                      <span style={{
                        fontWeight: isActive ? 700 : 500, fontSize: '0.88rem',
                        color: isActive ? 'var(--primary-accent)' : '#1A365D',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {loc.state}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      <span style={{
                        fontWeight: 700, fontSize: '0.82rem',
                        color: isActive ? 'var(--primary-accent)' : '#94A3B8',
                        minWidth: 16, textAlign: 'right',
                      }}>
                        {dCount}
                      </span>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          setConfirmDelete({ isOpen: true, type: 'state', name: loc.state });
                        }}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                          color: '#CBD5E1', display: 'flex', alignItems: 'center', borderRadius: 4,
                          transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = '#DC2626'}
                        onMouseLeave={e => e.currentTarget.style.color = '#CBD5E1'}
                        title="Delete state"
                      >
                        <MoreVertical size={14} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right Panel ──────────────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          {!selectedState ? (
            <div style={{ textAlign: 'center', padding: '80px 32px', color: '#94A3B8' }}>
              <MapPin size={48} style={{ opacity: 0.15, marginBottom: 16 }} />
              <p style={{ fontWeight: 700, fontSize: '1rem' }}>Select a state from the list</p>
              <p style={{ fontSize: '0.85rem', marginTop: 6 }}>Or add a new state using the field on the left.</p>
            </div>
          ) : (
            <>
              {/* State header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <MapPin size={20} color="var(--primary-accent)" />
                  {renamingState === selectedState.state ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={e => setRenameValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameStateSubmit();
                          if (e.key === 'Escape') setRenamingState('');
                        }}
                        style={{
                          fontSize: '1.2rem', fontWeight: 800, color: '#1A365D',
                          border: 'none', borderBottom: '2px solid var(--primary-accent)',
                          outline: 'none', background: 'transparent', fontFamily: 'inherit',
                        }}
                      />
                      <button onClick={handleRenameStateSubmit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16A34A', display: 'flex' }}><Check size={18} /></button>
                      <button onClick={() => setRenamingState('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}><X size={18} /></button>
                    </div>
                  ) : (
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#1A365D', margin: 0 }}>{selectedState.state}</h2>
                  )}
                  <span style={{
                    background: '#FFF7F5', color: 'var(--primary-accent)', border: '1px solid #FDDCCC',
                    borderRadius: 999, padding: '3px 12px', fontSize: '0.75rem', fontWeight: 700,
                  }}>
                    {currentLocObj?.districts?.length || 0} Districts
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button
                    onClick={() => { setRenamingState(selectedState.state); setRenameValue(selectedState.state); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: 'none', border: '1px solid #E2E8F0', borderRadius: 8,
                      padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: '0.83rem', fontWeight: 600, color: '#64748B', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#94A3B8'; e.currentTarget.style.color = '#1A365D'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.color = '#64748B'; }}
                  >
                    <Edit2 size={14} /> Rename
                  </button>
                  <button
                    onClick={() => setConfirmDelete({ isOpen: true, type: 'state', name: selectedState.state })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
                      padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: '0.83rem', fontWeight: 600, color: '#DC2626', transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = '#FEE2E2'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = '#FEF2F2'; }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </div>

              {/* Add district input */}
              <div style={{ marginBottom: 16 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  border: '1.5px solid var(--primary-accent)', borderRadius: '8px',
                  padding: '10px 16px', background: '#fff',
                }}>
                  <input
                    ref={districtInputRef}
                    style={{
                      flex: 1, border: 'none', outline: 'none', background: 'transparent',
                      fontFamily: 'inherit', fontSize: '0.9rem', color: '#1A365D',
                      resize: 'none',
                    }}
                    placeholder={`Add district to ${selectedState.state}… (paste multiple separated by newlines)`}
                    value={newDistrict}
                    onChange={e => setNewDistrict(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAddDistrict()}
                    autoFocus
                  />
                  <span style={{ fontSize: '0.72rem', color: 'var(--primary-accent)', fontWeight: 600, flexShrink: 0 }}>
                    Press Enter to add
                  </span>
                </div>
              </div>

              {/* Districts header + search */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ fontWeight: 700, fontSize: '0.95rem', color: '#1A365D', margin: 0 }}>
                  Districts ({selectedDistricts.length}{districtSearch ? ` of ${currentLocObj?.districts?.length || 0}` : ''})
                </h3>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  background: '#F8FAFC', border: '1px solid #E2E8F0',
                  borderRadius: 8, padding: '6px 12px',
                }}
                  onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--primary-accent)'}
                  onBlurCapture={e => e.currentTarget.style.borderColor = '#E2E8F0'}
                >
                  <Search size={13} color="#94A3B8" />
                  <input
                    style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: '0.82rem', color: '#1A365D', width: 130 }}
                    placeholder="Search districts..."
                    value={districtSearch}
                    onChange={e => setDistrictSearch(e.target.value)}
                  />
                  {districtSearch && (
                    <button onClick={() => setDistrictSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: '#94A3B8' }}>
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Districts list */}
              <div style={{
                background: '#fff', border: '1px solid #E2E8F0',
                borderRadius: 12, overflow: 'hidden',
              }}>
                {selectedDistricts.length === 0 ? (
                  <div style={{ padding: '32px 20px', textAlign: 'center', color: '#94A3B8' }}>
                    <LayoutGrid size={28} style={{ opacity: 0.2, marginBottom: 8 }} />
                    <p style={{ fontWeight: 600, fontSize: '0.88rem', marginBottom: 4 }}>No districts yet</p>
                    <p style={{ fontSize: '0.8rem' }}>Type a name above and press <kbd style={{ background: '#F1F5F9', borderRadius: 4, padding: '1px 5px', fontSize: '0.75rem' }}>Enter</kbd></p>
                  </div>
                ) : (
                  <>
                    {selectedDistricts.map((dist, idx) => (
                      <div
                        key={dist.name}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '13px 18px',
                          borderBottom: idx < selectedDistricts.length - 1 ? '1px solid #F1F5F9' : 'none',
                          transition: 'background 0.1s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#FAFBFC'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                          <GripVertical size={15} color="#CBD5E1" style={{ flexShrink: 0, cursor: 'grab' }} />
                          {editingDistrict === dist.name ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                              <input
                                autoFocus
                                value={editDistrictValue}
                                onChange={e => setEditDistrictValue(e.target.value)}
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleRenameDistrictSubmit();
                                  if (e.key === 'Escape') setEditingDistrict('');
                                }}
                                style={{
                                  flex: 1, fontFamily: 'inherit', fontSize: '0.9rem',
                                  fontWeight: 500, color: '#1A365D',
                                  border: 'none', borderBottom: '2px solid var(--primary-accent)',
                                  outline: 'none', background: 'transparent',
                                }}
                              />
                              <button onClick={handleRenameDistrictSubmit} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#16A34A', display: 'flex' }}><Check size={15} /></button>
                              <button onClick={() => setEditingDistrict('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex' }}><X size={15} /></button>
                            </div>
                          ) : (
                            <span style={{ fontWeight: 500, fontSize: '0.92rem', color: '#1A365D' }}>{dist.name}</span>
                          )}
                        </div>
                        {editingDistrict !== dist.name && (
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <button
                              onClick={() => { setEditingDistrict(dist.name); setEditDistrictValue(dist.name); }}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer', padding: '5px 7px',
                                color: '#CBD5E1', display: 'flex', alignItems: 'center', borderRadius: 6,
                                transition: 'color 0.15s, background 0.15s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#3B82F6'; e.currentTarget.style.background = '#EFF6FF'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = '#CBD5E1'; e.currentTarget.style.background = 'none'; }}
                              title="Edit district"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={() => setConfirmDelete({ isOpen: true, type: 'district', name: dist.name })}
                              style={{
                                background: 'none', border: 'none', cursor: 'pointer', padding: '5px 7px',
                                color: '#CBD5E1', display: 'flex', alignItems: 'center', borderRadius: 6,
                                transition: 'color 0.15s, background 0.15s',
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.background = '#FEF2F2'; }}
                              onMouseLeave={e => { e.currentTarget.style.color = '#CBD5E1'; e.currentTarget.style.background = 'none'; }}
                              title="Delete district"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add district footer row */}
                    <div
                      onClick={() => districtInputRef.current?.focus()}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: 8, padding: '14px', cursor: 'pointer',
                        borderTop: '1px solid #F1F5F9', color: '#94A3B8',
                        transition: 'background 0.15s, color 0.15s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = '#F8FAFC'; e.currentTarget.style.color = '#64748B'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#94A3B8'; }}
                    >
                      <CirclePlus size={16} />
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>Add District</div>
                        <div style={{ fontSize: '0.72rem' }}>or press Enter</div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ══ Toast ════════════════════════════════════════════════════════════ */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          background: '#1A365D', color: '#fff', borderRadius: 10,
          padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 8px 24px rgba(0,0,0,0.18)', zIndex: 200,
          animation: 'fadeUp 0.25s ease-out',
          fontSize: '0.88rem', fontWeight: 500,
        }}>
          <span style={{ color: '#4ADE80', display: 'flex' }}>✓</span>
          {toast.message}
          {toast.undoFn && (
            <button onClick={toast.undoFn} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary-accent)', fontWeight: 700, fontSize: '0.85rem', padding: 0, fontFamily: 'inherit' }}>
              Undo
            </button>
          )}
          <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', padding: 0 }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ══ Confirm Modal ════════════════════════════════════════════════════ */}
      <ConfirmModal
        isOpen={confirmDelete.isOpen}
        title={confirmDelete.type === 'state' ? 'Delete State' : 'Delete District'}
        message={
          confirmDelete.type === 'state'
            ? `Delete state "${confirmDelete.name}" and all its districts and cities?`
            : `Delete district "${confirmDelete.name}" and all its cities?`
        }
        onConfirm={onConfirm}
        onCancel={() => setConfirmDelete({ isOpen: false, type: '', name: '' })}
      />

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
