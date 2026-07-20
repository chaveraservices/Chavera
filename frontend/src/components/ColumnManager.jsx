import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Columns, GripVertical } from 'lucide-react';

// Column show/hide + drag-reorder control that lives in the table header.
// Clicking the icon opens a dropdown of every column with a toggle + drag handle.
//
// The panel is rendered through a portal onto <body> rather than as an
// absolutely-positioned child. The table lives inside .table-container, which
// sets overflow-x:auto to scroll sideways when many columns are on — and an
// overflow container clips positioned descendants. Anchored to the button with
// position:fixed instead, so it can never be cut off by the table's bounds.
export default function ColumnManager({ order, hidden, labels, onToggle, onReorder }) {
  const [open, setOpen] = useState(false);
  const [dragKey, setDragKey] = useState(null);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const panelRef = useRef(null);

  const PANEL_W = 290;
  const MARGIN = 8;   // gap between button and panel, and from the viewport edge

  // Anchor the panel to the button in viewport coordinates, flipping above the
  // button when there isn't room below and clamping so it never leaves screen.
  const place = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    const spaceBelow = vh - r.bottom - MARGIN * 2;
    const spaceAbove = r.top - MARGIN * 2;
    const flipUp = spaceBelow < 220 && spaceAbove > spaceBelow;

    // Never taller than the room available on the chosen side.
    const maxHeight = Math.max(160, Math.min(420, (flipUp ? spaceAbove : spaceBelow)));

    let left = r.left;
    if (left + PANEL_W > vw - MARGIN) left = vw - PANEL_W - MARGIN; // clamp right edge
    if (left < MARGIN) left = MARGIN;                                // clamp left edge

    setPos({
      left,
      top: flipUp ? undefined : r.bottom + MARGIN,
      bottom: flipUp ? vh - r.top + MARGIN : undefined,
      maxHeight,
    });
  }, []);

  // Placement must land before paint: `pos` still holds the coordinates from
  // the previous open, so with a plain effect the panel paints once at the
  // stale spot and then jumps (visible if the page scrolled in between).
  useLayoutEffect(() => {
    if (open) place();
    else setPos(null);
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    const onDocDown = (e) => {
      // The panel is outside the button's DOM subtree now, so check both.
      if (btnRef.current?.contains(e.target)) return;
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    // Re-anchor while the page or the table's own horizontal scroller moves.
    const onScroll = () => place();

    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', onScroll, true); // capture: catches inner scrollers
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, place]);

  const dropOn = (targetKey) => {
    if (dragKey && dragKey !== targetKey) onReorder(dragKey, targetKey);
    setDragKey(null);
  };

  const panel = open && pos && (
    <div
      ref={panelRef}
      className="columns-panel columns-panel-pop"
      style={{
        left: pos.left,
        top: pos.top,
        bottom: pos.bottom,
        maxHeight: pos.maxHeight,
      }}
    >
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
  );

  return (
    <div style={{ display: 'inline-flex' }}>
      <button
        ref={btnRef}
        type="button"
        className="col-mgr-btn"
        onClick={() => setOpen(o => !o)}
        title="Choose columns"
        aria-expanded={open}
      >
        <Columns size={16} />
      </button>
      {panel && createPortal(panel, document.body)}
    </div>
  );
}
