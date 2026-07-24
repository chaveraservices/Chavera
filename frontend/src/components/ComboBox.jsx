import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';

// Free-text input with autocomplete suggestions. The user can type ANYTHING
// (so tiny villages that aren't in any list are never blocked); matching
// suggestions appear as they type. Emits a native-select-style change event.
export default function ComboBox({
  value = '',
  onChange,
  onBlur,
  options = [],
  placeholder = '',
  name,
  disabled = false,
  required = false,
  inputClassName = 'input-field',
  style,
  maxSuggestions = 50,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const inputRef = useRef(null);

  // Close the suggestion list on outside click.
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const emit = (v) => onChange && onChange({ target: { name, value: v } });

  const filtered = useMemo(() => {
    const uniq = [...new Set(options.filter(Boolean))];
    const q = (value || '').toLowerCase().trim();
    // While typing, show substring matches (excluding an exact match of what's typed).
    const list = q
      ? uniq.filter(o => o.toLowerCase().includes(q) && o.toLowerCase() !== q)
      : uniq;
    return list.slice(0, maxSuggestions);
  }, [options, value, maxSuggestions]);

  return (
    <div className="custom-select-container" ref={ref} style={{ width: '100%', position: 'relative' }}>
      <input
        ref={inputRef}
        name={name}
        value={value}
        disabled={disabled}
        required={required}
        placeholder={placeholder}
        className={inputClassName}
        style={{ ...style, width: '100%', paddingRight: 34 }}
        autoComplete="off"
        onChange={(e) => { emit(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={onBlur}
      />
      <span
        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', display: 'flex', cursor: disabled ? 'default' : 'pointer', color: 'var(--text-muted)' }}
        onMouseDown={(e) => {
          e.preventDefault();
          if (disabled) return;
          setOpen(o => !o);
          inputRef.current?.focus();
        }}
      >
        <ChevronDown size={16} style={{ transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </span>
      {open && (
        <div className="custom-select-menu">
          {filtered.length === 0 ? (
            <div className="custom-select-empty">
              {(value || '').trim() ? 'No match — keep typing to add it' : 'No suggestions yet — type to add'}
            </div>
          ) : (
            filtered.map((opt) => (
              <div
                key={opt}
                className={`custom-select-option ${opt === value ? 'selected' : ''}`}
                // onMouseDown (not onClick) so selecting doesn't blur the input first.
                onMouseDown={(e) => { e.preventDefault(); emit(opt); setOpen(false); }}
              >
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  {opt}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
