import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import api from '../utils/api';
import { contactFields, rowToContact } from '../utils/contactFields';
import { UploadCloud, Download, FileSpreadsheet, CheckCircle2, XCircle, AlertTriangle, Copy, ArrowRight, RefreshCw } from 'lucide-react';

export default function ImportPage({ onComplete }) {
  const [file, setFile] = useState(null);
  const [previewData, setPreviewData] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  // Validates a single row to assign a status
  const validateRow = (row, index, allRows) => {
    let status = 'Valid';
    let errors = {};

    if (!row.full_name || !row.phone_1 || !row.village_town) {
      status = 'Missing';
      if (!row.full_name) errors.full_name = true;
      if (!row.phone_1) errors.phone_1 = true;
      if (!row.village_town) errors.village_town = true;
    }

    if (row.phone_1 && !/^\d{10}$/.test(String(row.phone_1).trim())) {
      status = 'Invalid';
      errors.phone_1 = true;
    }

    if (row.phone_1 && status !== 'Missing' && status !== 'Invalid') {
      const isDuplicate = allRows.findIndex((r, idx) => idx !== index && r.phone_1 === row.phone_1) !== -1;
      if (isDuplicate) {
        status = 'Duplicate';
        errors.phone_1 = true;
      }
    }

    return { ...row, _status: status, _errors: errors };
  };

  const processFile = async (selected) => {
    setFile(selected);
    setError('');
    setSuccess('');
    try {
      const data = await selected.arrayBuffer();
      let workbook;
      try {
        workbook = XLSX.read(data);
      } catch {
        throw new Error('Could not read the file. Please ensure it is a valid .csv, .xlsx, or .xls file.');
      }
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawData = XLSX.utils.sheet_to_json(worksheet);
      if (rawData.length === 0) throw new Error('The selected file is empty.');
      const contacts = rawData.map(rowToContact);
      const validated = contacts.map((c, i, arr) => validateRow(c, i, arr));
      setPreviewData(validated);
    } catch (err) {
      setError(err.message || 'Error parsing file.');
      setPreviewData([]);
      setFile(null);
    }
  };

  const handleFileUpload = async (e) => {
    const selected = e.target.files[0];
    if (selected) await processFile(selected);
    e.target.value = null;
  };

  const handleDragOver = (e) => { e.preventDefault(); setIsDragOver(true); };
  const handleDragLeave = () => setIsDragOver(false);
  const handleDrop = async (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) await processFile(dropped);
  };

  const handleCancel = () => {
    setPreviewData([]);
    setFile(null);
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
        setTimeout(() => onComplete(), 2500);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Error uploading contacts.');
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

  // Stats derived from preview data
  const stats = previewData.reduce((acc, r) => {
    acc[r._status] = (acc[r._status] || 0) + 1;
    return acc;
  }, {});
  const validCount = (stats.Valid || 0) + (stats.Duplicate || 0);
  const skippedCount = (stats.Missing || 0) + (stats.Invalid || 0);

  return (
    <div className="page-container" style={{ paddingTop: '32px', maxWidth: '1100px' }}>

      {/* ── Page Header ── */}
      <div className="form-header-flex">
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-dark)' }}>
            Import Contacts
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '4px', fontSize: '0.9rem' }}>
            Upload an Excel or CSV file to bulk-add contacts to the directory.
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            border: '1px solid var(--border-color)',
            background: 'var(--bg-white)', color: 'var(--text-dark)',
            padding: '10px 18px', borderRadius: '8px', cursor: 'pointer',
            fontFamily: 'inherit', fontWeight: 600, fontSize: '0.88rem',
            transition: 'border-color 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary-accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
        >
          <Download size={16} />
          Download Template
        </button>
      </div>

      {/* ── Notification Banners ── */}
      {error && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '14px 18px', background: '#FEF2F2',
          border: '1px solid #FECACA', color: 'var(--danger)',
          borderRadius: '10px', marginBottom: '20px', fontSize: '0.9rem', fontWeight: 500,
        }}>
          <XCircle size={18} style={{ flexShrink: 0 }} />
          {error}
        </div>
      )}
      {success && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '14px 18px', background: '#F0FDF4',
          border: '1px solid #BBF7D0', color: '#15803D',
          borderRadius: '10px', marginBottom: '20px', fontSize: '0.9rem', fontWeight: 500,
        }}>
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          {success}
        </div>
      )}

      {previewData.length === 0 ? (
        <>
          {/* ── How it works ── */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '16px', marginBottom: '28px',
          }}>
            {[
              { step: '1', icon: <Download size={20} color="var(--primary-accent)" />, title: 'Download Template', desc: 'Get the CSV template with all required column headers.' },
              { step: '2', icon: <FileSpreadsheet size={20} color="var(--primary-accent)" />, title: 'Fill Your Data', desc: 'Populate the file with your contacts. Required: Name, Phone, Town.' },
              { step: '3', icon: <UploadCloud size={20} color="var(--primary-accent)" />, title: 'Upload & Review', desc: 'Upload the file, review the parsed data, then confirm import.' },
            ].map(({ step, icon, title, desc }) => (
              <div key={step} style={{
                background: 'var(--bg-white)', border: '1px solid var(--border-color)',
                borderRadius: '12px', padding: '20px 22px',
                display: 'flex', alignItems: 'flex-start', gap: '14px',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'var(--highlight)', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {icon}
                </div>
                <div>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary-accent)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                    Step {step}
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '0.92rem', marginBottom: '4px' }}>{title}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.83rem', lineHeight: 1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Drop Zone ── */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            style={{
              background: isDragOver ? 'var(--highlight)' : 'var(--bg-white)',
              border: `2px dashed ${isDragOver ? 'var(--primary-accent)' : 'var(--border-color)'}`,
              borderRadius: '16px',
              padding: '60px 40px',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              textAlign: 'center', cursor: 'pointer',
              transition: 'all 0.25s ease',
              transform: isDragOver ? 'scale(1.01)' : 'scale(1)',
              boxShadow: isDragOver ? '0 0 0 4px rgba(226,92,36,0.1)' : 'none',
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv, .xlsx, .xls"
              onChange={handleFileUpload}
              style={{ display: 'none' }}
            />
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: isDragOver ? 'rgba(226,92,36,0.15)' : '#232322',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '20px', transition: 'background 0.25s',
            }}>
              <UploadCloud size={32} color={isDragOver ? 'var(--primary-accent)' : 'var(--text-muted)'} />
            </div>
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '8px' }}>
              {isDragOver ? 'Release to upload' : 'Drag & drop your file here'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '24px' }}>
              or click anywhere in this area to browse
            </p>
            <div style={{
              display: 'flex', gap: '10px', alignItems: 'center',
            }}>
              {['.xlsx', '.xls', '.csv'].map(ext => (
                <span key={ext} style={{
                  padding: '4px 12px', background: '#232322',
                  borderRadius: '999px', fontSize: '0.8rem',
                  color: 'var(--text-muted)', fontWeight: 600,
                }}>
                  {ext}
                </span>
              ))}
            </div>
          </div>

          {/* ── Required fields note ── */}
          <div style={{
            marginTop: '16px', padding: '12px 18px',
            background: '#332A12', border: '1px solid #FDE68A',
            borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px',
            fontSize: '0.85rem', color: '#92400E',
          }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span><strong>Required columns:</strong> Full Name, Phone 1, Village Town. All other fields are optional.</span>
          </div>
        </>
      ) : (
        /* ── Preview / Review Section ── */
        <div>
          {/* File info bar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px',
            background: 'var(--bg-white)', border: '1px solid var(--border-color)',
            borderRadius: '10px', marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px', height: '40px', borderRadius: '8px',
                background: '#F0FDF4', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <FileSpreadsheet size={20} color="#16A34A" />
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-dark)' }}>
                  {file?.name || 'Imported File'}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {previewData.length} rows detected
                </div>
              </div>
            </div>
            <button
              onClick={handleCancel}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                background: 'none', border: '1px solid var(--border-color)',
                borderRadius: '8px', padding: '7px 14px', cursor: 'pointer',
                color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600,
                fontFamily: 'inherit', transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--danger)'; e.currentTarget.style.color = 'var(--danger)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <RefreshCw size={14} /> Choose Different File
            </button>
          </div>

          {/* Stats summary bar */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '14px', marginBottom: '20px',
          }}>
            {[
              { label: 'Total Rows', value: previewData.length, color: 'var(--text-dark)', bg: '#1B1F33', icon: <Copy size={16} color="#4338CA" /> },
              { label: 'Will Import', value: validCount, color: '#15803D', bg: '#F0FDF4', icon: <CheckCircle2 size={16} color="#16A34A" /> },
              { label: 'Invalid / Missing', value: skippedCount, color: 'var(--danger)', bg: '#FEF2F2', icon: <XCircle size={16} color="var(--danger)" /> },
              { label: 'Duplicates', value: stats.Duplicate || 0, color: '#1D4ED8', bg: '#EFF6FF', icon: <AlertTriangle size={16} color="#3B82F6" /> },
            ].map(({ label, value, color, bg, icon }) => (
              <div key={label} style={{
                background: bg, borderRadius: '10px',
                padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: '12px',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  {icon}
                </div>
                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
                  <div style={{ fontSize: '0.78rem', color, opacity: 0.75, marginTop: '3px', fontWeight: 600 }}>{label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{
            display: 'flex', gap: '20px', alignItems: 'center',
            padding: '10px 16px', background: 'var(--bg-white)',
            border: '1px solid var(--border-color)', borderRadius: '8px',
            marginBottom: '12px', flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '4px' }}>ROW COLOURS:</span>
            {[
              { cls: 'dot-invalid', label: 'Invalid phone', color: 'var(--danger)' },
              { cls: 'dot-duplicate', label: 'Duplicate phone', color: '#2563EB' },
              { cls: 'dot-missing', label: 'Missing required field', color: 'var(--text-muted)' },
            ].map(({ cls, label, color }) => (
              <span key={cls} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                <span className={`legend-dot ${cls}`} />
                {label}
              </span>
            ))}
          </div>

          {/* Table */}
          <div className="table-container" style={{ marginBottom: '20px', overflowX: 'auto', borderRadius: '12px' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '48px' }}>#</th>
                  <th>NAME</th>
                  <th>BUSINESS</th>
                  <th>PHONE</th>
                  <th>TOWN</th>
                  <th>DISTRICT</th>
                  <th>CATEGORY</th>
                  <th style={{ width: '110px' }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {previewData.map((row, idx) => (
                  <tr key={idx} style={{ transition: 'background 0.1s' }}>
                    <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem', fontWeight: 600 }}>{idx + 1}</td>
                    <td className={row._errors?.full_name ? (row._status === 'Missing' ? 'cell-missing' : 'cell-invalid') : ''}>
                      {row.full_name || '—'}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{row.business_name || '—'}</td>
                    <td className={row._errors?.phone_1 ? `cell-${row._status.toLowerCase()}` : ''}>
                      {row.phone_1 || '—'}
                    </td>
                    <td className={row._errors?.village_town ? (row._status === 'Missing' ? 'cell-missing' : 'cell-invalid') : ''}>
                      {row.village_town || '—'}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{row.district || '—'}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{row.category || '—'}</td>
                    <td>
                      <span className={`badge badge-${row._status.toLowerCase()}`}
                        style={{ padding: '4px 10px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em' }}>
                        {row._status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Action footer */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '16px 20px',
            background: 'var(--bg-white)', border: '1px solid var(--border-color)',
            borderRadius: '10px',
          }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {skippedCount > 0
                ? <><strong style={{ color: 'var(--danger)' }}>{skippedCount} rows</strong> will be skipped. Only <strong>{validCount} valid rows</strong> will be imported.</>
                : <><strong style={{ color: '#15803D' }}>All {validCount} rows</strong> are valid and ready to import.</>
              }
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                className="btn btn-link"
                onClick={handleCancel}
                style={{ color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleApprove}
                disabled={loading || validCount === 0}
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  opacity: validCount === 0 ? 0.5 : 1,
                }}
              >
                {loading ? (
                  <><RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processing...</>
                ) : (
                  <>Approve & Import {validCount} Contacts <ArrowRight size={16} /></>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .data-table tbody tr:hover td { background: #FAFBFC; }
      `}</style>
    </div>
  );
}
