import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  name,
  className = "",
  searchable, // undefined => auto (search box shown when the list is long)
  autoOpen = false, // open the menu on mount (used for the honorific field)
  advanceOnSelect = true, // after a keyboard pick, jump to the next form field
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Index of the keyboard-highlighted option within `filtered`.
  const [activeIdx, setActiveIdx] = useState(-1);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const menuRef = useRef(null);
  // Guards for open-on-focus: a mouse click focuses AND clicks (let the click
  // toggle, don't also open on the focus); and after a selection the trigger is
  // re-focused (don't reopen from that).
  const mouseDownRef = useRef(false);
  const skipOpenRef = useRef(false);

  // Show a search box for long lists (e.g. States/Districts) unless overridden.
  const canSearch = searchable ?? (options.length > 7);
  // Number shortcuts (press 1–9 to pick an option) only make sense on short,
  // non-searchable lists — on a searchable list a digit is a search character.
  const numberKeys = !canSearch;

  // #5: open on mount for the honorific field, so the form starts on it.
  useEffect(() => {
    if (autoOpen && !disabled) {
      setIsOpen(true);
      const t = setTimeout(() => dropdownRef.current?.querySelector('.custom-select-trigger')?.focus(), 0);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus the search box when opening; clear the query when closing.
  useEffect(() => {
    if (isOpen && canSearch) {
      const t = setTimeout(() => searchRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    if (!isOpen) { setQuery(''); setActiveIdx(-1); }
  }, [isOpen, canSearch]);

  // When the menu opens, scroll it into view within the modal so it isn't cut
  // off near the bottom on shorter (14"/16") laptop screens. `nearest` means
  // an already-visible dropdown doesn't jump.
  useEffect(() => {
    if (!isOpen) return;
    const t = setTimeout(() => {
      menuRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 30);
    return () => clearTimeout(t);
  }, [isOpen]);

  const handleSelect = (val, { advance = false } = {}) => {
    if (onChange) onChange({ target: { name, value: val } });
    setIsOpen(false);
    setQuery('');
    setActiveIdx(-1);
    // Return focus to the trigger so Tab continues from the right place, but
    // don't let open-on-focus reopen the menu we just closed.
    skipOpenRef.current = true;
    const trigger = dropdownRef.current?.querySelector('.custom-select-trigger');
    trigger?.focus();

    // Keyboard pick: mirror the form's Enter-advances-field behaviour by moving
    // focus to the next field (which, if it's a dropdown, opens on focus).
    // Deferred a tick so the just-closed menu (and its search box) is gone and
    // any field this selection enables — e.g. District after State — is live;
    // otherwise the search input or a still-disabled field steals the focus.
    if (advance && advanceOnSelect && trigger) {
      setTimeout(() => {
        const scope = trigger.closest('form') || document;
        const focusables = Array.from(
          scope.querySelectorAll('input, select, textarea, [data-kbd-focusable]')
        ).filter(n =>
          !n.disabled && n.tabIndex !== -1 && n.offsetParent !== null &&
          !n.closest('.custom-select-menu')   // never land on a dropdown's search box
        );
        const idx = focusables.indexOf(trigger);
        if (idx >= 0 && idx < focusables.length - 1) focusables[idx + 1].focus();
      }, 0);
    }
  };

  // Open when the trigger gains focus via keyboard (Tab), so dropdowns open by
  // themselves in the entry flow. A mouse click is handled by onClick instead,
  // and a post-selection refocus is skipped — see the guard refs above.
  const openFromFocus = () => {
    if (disabled) return;
    if (mouseDownRef.current) { mouseDownRef.current = false; return; }
    if (skipOpenRef.current) { skipOpenRef.current = false; return; }
    setIsOpen(true);
    const cur = options.findIndex(o => o.value === value);
    setActiveIdx(cur >= 0 ? cur : 0);
  };

  const selectedOption = options.find(o => o.value === value);
  const q = query.trim().toLowerCase();
  const filtered = canSearch && q
    ? options.filter(o => o.label.toLowerCase().includes(q))
    : options;

  // Typing in the search box invalidates the old highlight position.
  useEffect(() => { setActiveIdx(filtered.length ? 0 : -1); }, [query]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the highlighted row scrolled into view during arrow navigation.
  useEffect(() => {
    if (!isOpen || activeIdx < 0) return;
    const el = menuRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, isOpen]);

  // Single keyboard handler for the whole control, so the same keys work
  // whether focus sits on the trigger or in the search box.
  const onKeyDown = (e) => {
    if (disabled) return;

    if (!isOpen) {
      // Closed: Enter/Space/Arrow opens. Everything else (incl. Tab) passes
      // through so the form's own Enter-advances-field behaviour still works.
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        e.stopPropagation();
        setIsOpen(true);
        const cur = options.findIndex(o => o.value === value);
        setActiveIdx(cur >= 0 ? cur : 0);
      }
      return;
    }

    // Open: the menu owns the keys.
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault(); e.stopPropagation();
        setActiveIdx(i => (filtered.length ? (i + 1) % filtered.length : -1));
        break;
      case 'ArrowUp':
        e.preventDefault(); e.stopPropagation();
        setActiveIdx(i => (filtered.length ? (i - 1 + filtered.length) % filtered.length : -1));
        break;
      case 'Home':
        e.preventDefault(); setActiveIdx(filtered.length ? 0 : -1);
        break;
      case 'End':
        e.preventDefault(); setActiveIdx(filtered.length - 1);
        break;
      case 'Enter':
        e.preventDefault(); e.stopPropagation();
        if (activeIdx >= 0 && filtered[activeIdx]) handleSelect(filtered[activeIdx].value, { advance: true });
        else setIsOpen(false);
        break;
      case 'Escape':
        e.preventDefault(); e.stopPropagation();
        setIsOpen(false);
        break;
      case 'Tab':
        // Let Tab move on, but don't leave an orphaned menu behind.
        setIsOpen(false);
        break;
      default:
        // #6: number shortcuts — 1..9 selects that option (short lists only).
        if (numberKeys && /^[1-9]$/.test(e.key)) {
          const idx = Number(e.key) - 1;
          if (filtered[idx]) {
            e.preventDefault(); e.stopPropagation();
            handleSelect(filtered[idx].value, { advance: true });
          }
        }
        break;
    }
  };

  return (
    <div
      className={`custom-select-container ${disabled ? 'disabled' : ''} ${className}`}
      ref={dropdownRef}
      onKeyDown={onKeyDown}
    >
      <div
        className="custom-select-trigger"
        onMouseDown={() => { mouseDownRef.current = true; }}
        onClick={() => { if (!disabled) setIsOpen(o => !o); mouseDownRef.current = false; }}
        onFocus={openFromFocus}
        tabIndex={disabled ? -1 : 0}
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        data-kbd-focusable=""
      >
        <span className={!selectedOption ? 'placeholder' : ''} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className={`chevron ${isOpen ? 'open' : ''}`} />
      </div>

      {isOpen && (
        <div className="custom-select-menu" ref={menuRef} role="listbox">
          {canSearch && (
            <div className="custom-select-search" onClick={(e) => e.stopPropagation()}>
              <Search size={14} />
              <input
                ref={searchRef}
                value={query}
                placeholder="Search…"
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="custom-select-empty">{canSearch && q ? 'No matches' : 'No options'}</div>
          ) : (
            filtered.map((opt, i) => (
              <div
                key={opt.value}
                data-idx={i}
                role="option"
                aria-selected={value === opt.value}
                className={`custom-select-option ${value === opt.value ? 'selected' : ''} ${i === activeIdx ? 'active' : ''}`}
                onClick={() => handleSelect(opt.value)}
                onMouseEnter={() => setActiveIdx(i)}
              >
                {numberKeys && i < 9 && <span className="opt-key">{i + 1}</span>}
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>
                  {opt.label}
                </span>
                {value === opt.value && <Check size={16} className="check-icon" />}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
