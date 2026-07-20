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

  // Every ancestor that can clip the button — the table's overflow-x scroller
  // is the one that matters here. Returns their bounding rects.
  const clipRects = (el) => {
    const rects = [];
    for (let n = el.parentElement; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (/(auto|scroll|hidden)/.test(s.overflowX + s.overflowY)) rects.push(n.getBoundingClientRect());
    }
    return rects;
  };

  // Anchor the panel to the button in viewport coordinates, flipping above the
  // button when there isn't room below and clamping so it never leaves screen.
  // Returns false when the button has been scrolled out of view, so the caller
  // can close instead of leaving the panel floating away from its trigger.
  const place = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return false;
    const r = btn.getBoundingClientRect();
    const vh = window.innerHeight;
    const vw = window.innerWidth;

    // The button sits in the first column header; scrolling the table sideways
    // slides it out of the scroller. Once it is gone the panel has no anchor
    // and would drift over the sidebar — bail and let the caller close.
    const clips = clipRects(btn);
    const hidden = clips.some(c => r.right <= c.left || r.left >= c.right || r.bottom <= c.top || r.top >= c.bottom);
    if (hidden) return false;

    const spaceBelow = vh - r.bottom - MARGIN * 2;
    const spaceAbove = r.top - MARGIN * 2;
    const flipUp = spaceBelow < 220 && spaceAbove > spaceBelow;

    // Never taller than the room available on the chosen side.
    const maxHeight = Math.max(160, Math.min(420, (flipUp ? spaceAbove : spaceBelow)));

    // Keep the panel inside the viewport, and inside the scroller the button
    // belongs to, so it can never overlap the sidebar.
    const minLeft = Math.max(MARGIN, ...clips.map(c => c.left));
    const maxRight = Math.min(vw - MARGIN, ...clips.map(c => c.right));

    let left = r.left;
    if (left + PANEL_W > maxRight) left = maxRight - PANEL_W;
    if (left < minLeft) left = minLeft;

    setPos({
      left,
      top: flipUp ? undefined : r.bottom + MARGIN,
      bottom: flipUp ? vh - r.top + MARGIN : undefined,
      maxHeight,
    });
    return true;
  }, []);

  // Placement must land before paint: `pos` still holds the coordinates from
  // the previous open, so with a plain effect the panel paints once at the
  // stale spot and then jumps (visible if the page scrolled in between).
  useLayoutEffect(() => {
    if (open) { if (!place()) setOpen(false); }
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
    // Re-anchor while the page or the table's own horizontal scroller moves;
    // close once the button itself has scrolled out of view.
    const reanchor = () => { if (!place()) setOpen(false); };

    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', reanchor);
    window.addEventListener('scroll', reanchor, true); // capture: catches inner scrollers
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', reanchor);
      window.removeEventListener('scroll', reanchor, true);
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
