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
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  // Index of the keyboard-highlighted option within `filtered`.
  const [activeIdx, setActiveIdx] = useState(-1);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const menuRef = useRef(null);

  // Show a search box for long lists (e.g. States/Districts) unless overridden.
  const canSearch = searchable ?? (options.length > 7);

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

  const handleSelect = (val) => {
    if (onChange) onChange({ target: { name, value: val } });
    setIsOpen(false);
    setQuery('');
    setActiveIdx(-1);
    // Return focus to the trigger so Tab continues from the right place.
    dropdownRef.current?.querySelector('.custom-select-trigger')?.focus();
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
        if (activeIdx >= 0 && filtered[activeIdx]) handleSelect(filtered[activeIdx].value);
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
        onClick={() => !disabled && setIsOpen(!isOpen)}
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
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
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
