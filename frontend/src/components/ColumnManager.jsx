import { useState, useRef, useEffect } from 'react';
import { Columns, GripVertical } from 'lucide-react';

// Column show/hide + drag-reorder control that lives in the table header.
// Clicking the icon opens a dropdown of every column with a toggle + drag handle.
export default function ColumnManager({ order, hidden, labels, onToggle, onReorder }) {
  const [open, setOpen] = useState(false);
  const [dragKey, setDragKey] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const dropOn = (targetKey) => {
    if (dragKey && dragKey !== targetKey) onReorder(dragKey, targetKey);
    setDragKey(null);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" className="col-mgr-btn" onClick={() => setOpen(o => !o)} title="Choose columns">
        <Columns size={16} />
      </button>

      {open && (
        <div className="columns-panel columns-panel-pop">
          <div className="columns-panel-header">Show, hide &amp; reorder columns</div>
          <div className="columns-list">
            {order.map((key) => (
              <div
                className="col-manage-row"
                key={key}
                draggable
                onDragStart={() => setDragKey(key)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => dropOn(key)}
                onDragEnd={() => setDragKey(null)}
                style={{ opacity: dragKey === key ? 0.4 : 1 }}
              >
                <span className="col-grip" title="Drag to reorder"><GripVertical size={16} /></span>
                <span style={{ flex: 1 }}>{labels[key] || key}</span>
                <label className="switch" title="Show / hide column">
                  <input type="checkbox" checked={!hidden.includes(key)} onChange={() => onToggle(key)} />
                  <span className="switch-slider"></span>
                </label>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
