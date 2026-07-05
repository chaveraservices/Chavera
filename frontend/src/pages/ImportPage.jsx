import { useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../utils/api';
import { contactFields, rowToContact } from '../utils/contactFields';
import { UploadCloud, Download } from 'lucide-react';

export default function ImportPage({ onComplete }) {
  const [file, setFile] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [previewData, setPreviewData] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Validates a single row to assign a status
  const validateRow = (row, index, allRows) => {
    let status = 'Valid';
    let errors = {};

    // Check for missing required fields
    if (!row.full_name || !row.phone_1 || !row.village_town) {
      status = 'Missing';
      if (!row.full_name) errors.full_name = true;
      if (!row.phone_1) errors.phone_1 = true;
      if (!row.village_town) errors.village_town = true;
    }

    // Check for invalid phone length (if it's not missing)
    if (row.phone_1 && !/^\d{10}$/.test(String(row.phone_1).trim())) {
      status = 'Invalid';
      errors.phone_1 = true;
    }

    // Check for duplicates within the uploaded dataset
    if (row.phone_1 && status !== 'Missing' && status !== 'Invalid') {
      const isDuplicate = allRows.findIndex((r, idx) => idx !== index && r.phone_1 === row.phone_1) !== -1;
      if (isDuplicate) {
        status = 'Duplicate';
        errors.phone_1 = true;
      }
    }

    return { ...row, _status: status, _errors: errors };
  };

  const handleFileUpload = async (e) => {
    const selected = e.target.files[0];
    if (selected) {
      setFile(selected);
      setError('');
      setSuccess('');
      
      try {
        const data = await selected.arrayBuffer();
        let workbook;
        try {
          workbook = XLSX.read(data);
        } catch {
          throw new Error('Could not read the file. Please ensure it is a valid .csv, .xlsx, or .xls file and not corrupted.');
        }
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawData = XLSX.utils.sheet_to_json(worksheet);

        if (rawData.length === 0) {
          throw new Error('The selected file is empty.');
        }

        const contacts = rawData.map(rowToContact);
        const validated = contacts.map((c, i, arr) => validateRow(c, i, arr));
        setPreviewData(validated);
      } catch (err) {
        setError(err.message || 'Error parsing file.');
        setPreviewData([]);
      }
      
      // Reset input so it can be re-selected if needed
      e.target.value = null;
    }
  };

  const handleParseText = () => {
    if (!pastedText.trim()) {
      setError('Please paste some text first.');
      return;
    }
    setError('');
    setSuccess('');
    
    // Attempt basic CSV parsing (split by newline, then comma)
    const lines = pastedText.split('\n').map(l => l.trim()).filter(l => l);
    
    let parsedContacts = [];
    
    const isHeader = lines[0].toLowerCase().includes('name') || lines[0].toLowerCase().includes('phone');
    const dataLines = isHeader ? lines.slice(1) : lines;
    
    dataLines.forEach(line => {
      const parts = line.split(',').map(p => p.trim());
      // basic mapping: Name, Phone, Town, District... (this could be brittle but fits the mockup)
      const contact = {
        full_name: parts[0] || '',
        phone_1: parts[1] || '',
        village_town: parts[2] || '',
        district: parts[3] || '',
        business_name: parts[4] || '',
        category: parts[5] || ''
      };
      parsedContacts.push(contact);
    });

    if (parsedContacts.length === 0) {
      setError('Could not parse any records.');
      return;
    }

    const validated = parsedContacts.map((c, i, arr) => validateRow(c, i, arr));
    setPreviewData(validated);
  };

  const handleCancel = () => {
    setPreviewData([]);
    setFile(null);
    setPastedText('');
    setError('');
    setSuccess('');
  };

  const handleApprove = async () => {
    const validContacts = previewData.filter(c => c._status === 'Valid' || c._status === 'Duplicate'); 
    
    if (validContacts.length === 0) {
      setError('No valid contacts to import.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    const payload = validContacts.map(({ _status, _errors, ...rest }) => rest);

    try {
      const res = await api.post('/contact/bulk-insert', { contacts: payload });
      
      if (res.data.success) {
        setSuccess(`Successfully imported ${res.data.data.count} contacts! Skipped ${res.data.data.skipped} entries.`);
        setTimeout(() => {
          onComplete();
        }, 2500);
      }
    } catch (err) {
      setError(err.message || err.response?.data?.message || 'Error uploading file.');
    } finally {
      setLoading(false);
    }
  };

  const downloadTemplate = () => {
    const headers = contactFields.map(f => `"${f.label}"`).join(',');
    const exampleRow = contactFields.map(f => {
        if (f.key === 'full_name') return '"John Doe"';
        if (f.key === 'phone_1') return '"9876543210"';
        if (f.key === 'village_town') return '"Sample Village"';
        return '""';
    }).join(',');
    
    const csvContent = `${headers}\n${exampleRow}`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Chavera_Contacts_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="page-container" style={{ paddingTop: '32px' }}>
      <div className="form-header-flex">
        <h1>Import Contacts</h1>
      </div>

      {error && <div style={{ padding: '12px', background: '#FEE2E2', color: '#DC2626', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}
      {success && <div style={{ padding: '12px', background: '#D1FAE5', color: '#059669', borderRadius: '8px', marginBottom: '1rem' }}>{success}</div>}

      {previewData.length === 0 ? (
        <div className="import-grid">
          {/* Card 1: File Upload */}
          <div className="import-card">
            <UploadCloud size={48} color="var(--primary-accent)" style={{ marginBottom: '1rem' }} />
            <h3 className="import-card-title">Drag & drop your Excel or CSV file here</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '0.9rem' }}>
              Supports .xlsx and .csv
            </p>
            <div style={{ display: 'flex', gap: '16px' }}>
              <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                Browse File
                <input 
                  type="file" 
                  accept=".csv, .xlsx, .xls" 
                  onChange={handleFileUpload} 
                  style={{ display: 'none' }}
                />
              </label>
              <button className="btn btn-secondary" onClick={downloadTemplate} style={{ display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-white)', color: 'var(--text-dark)', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer' }}>
                <Download size={18} />
                CSV Template
              </button>
            </div>
          </div>

          {/* Card 2: Paste Records */}
          <div className="import-card paste-card">
            <h3 className="import-card-title">Paste Records</h3>
            <textarea
              className="paste-textarea"
              placeholder="Name, Phone, Town, District...&#10;Rajesh Kumar, 9876543210, Mumbai, Maharashtra"
              value={pastedText}
              onChange={e => setPastedText(e.target.value)}
            />
            <div style={{ alignSelf: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleParseText} style={{ background: '#EFF6FF', color: '#3B82F6', border: '1px solid #BFDBFE' }}>
                Parse Text
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Preview Section */
        <div className="form-section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="import-card-title" style={{ margin: 0 }}>Review Imported Data</h3>
            <div style={{ display: 'flex', gap: '16px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              <span style={{ display: 'flex', alignItems: 'center' }}><span className="legend-dot dot-invalid"></span> Invalid</span>
              <span style={{ display: 'flex', alignItems: 'center' }}><span className="legend-dot dot-duplicate"></span> Duplicate</span>
              <span style={{ display: 'flex', alignItems: 'center' }}><span className="legend-dot dot-missing"></span> Missing</span>
            </div>
          </div>

          <div className="table-container" style={{ marginBottom: '24px', overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>NAME</th>
                  <th>BUSINESS</th>
                  <th>PHONE</th>
                  <th>TOWN</th>
                  <th>DISTRICT</th>
                  <th>TYPE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td className={row._errors?.full_name ? (row._status === 'Missing' ? 'cell-missing' : 'cell-invalid') : ''}>
                      {row.full_name || '—'}
                    </td>
                    <td>{row.business_name || '—'}</td>
                    <td className={row._errors?.phone_1 ? `cell-${row._status.toLowerCase()}` : ''}>
                      {row.phone_1 || '—'}
                    </td>
                    <td className={row._errors?.village_town ? (row._status === 'Missing' ? 'cell-missing' : 'cell-invalid') : ''}>
                      {row.village_town || '—'}
                    </td>
                    <td>{row.district || '—'}</td>
                    <td>{row.category || '—'}</td>
                    <td>
                      <span className={`badge badge-${row._status.toLowerCase()}`}>
                        {row._status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px' }}>
            <button className="btn btn-link" onClick={handleCancel}>Cancel Import</button>
            <button className="btn btn-primary" onClick={handleApprove} disabled={loading}>
              {loading ? 'Processing...' : 'Approve & Add to Directory'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
