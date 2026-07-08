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
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

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
    if (!isOpen) setQuery('');
  }, [isOpen, canSearch]);

  const handleSelect = (val) => {
    if (onChange) onChange({ target: { name, value: val } });
    setIsOpen(false);
    setQuery('');
  };

  const selectedOption = options.find(o => o.value === value);
  const q = query.trim().toLowerCase();
  const filtered = canSearch && q
    ? options.filter(o => o.label.toLowerCase().includes(q))
    : options;

  return (
    <div className={`custom-select-container ${disabled ? 'disabled' : ''} ${className}`} ref={dropdownRef}>
      <div
        className="custom-select-trigger"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        tabIndex={disabled ? -1 : 0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!disabled) setIsOpen(!isOpen);
          }
          if (e.key === 'Escape') setIsOpen(false);
        }}
      >
        <span className={!selectedOption ? 'placeholder' : ''} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className={`chevron ${isOpen ? 'open' : ''}`} />
      </div>

      {isOpen && (
        <div className="custom-select-menu">
          {canSearch && (
            <div className="custom-select-search" onClick={(e) => e.stopPropagation()}>
              <Search size={14} />
              <input
                ref={searchRef}
                value={query}
                placeholder="Search…"
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Escape') setIsOpen(false); }}
              />
            </div>
          )}
          {filtered.length === 0 ? (
            <div className="custom-select-empty">{canSearch && q ? 'No matches' : 'No options'}</div>
          ) : (
            filtered.map((opt) => (
              <div
                key={opt.value}
                className={`custom-select-option ${value === opt.value ? 'selected' : ''}`}
                onClick={() => handleSelect(opt.value)}
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
