import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export default function CustomSelect({ 
  value, 
  onChange, 
  options, 
  placeholder = "Select...", 
  disabled = false, 
  name,
  className = ""
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

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

  const handleSelect = (val) => {
    if (onChange) {
      // Simulate event object to match native select behavior
      onChange({ target: { name, value: val } });
    }
    setIsOpen(false);
  };

  const selectedOption = options.find(o => o.value === value);

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
          if (e.key === 'Escape') {
            setIsOpen(false);
          }
        }}
      >
        <span className={!selectedOption ? 'placeholder' : ''} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className={`chevron ${isOpen ? 'open' : ''}`} />
      </div>
      
      {isOpen && (
        <div className="custom-select-menu">
          {options.length === 0 ? (
            <div className="custom-select-empty">No options</div>
          ) : (
            options.map((opt) => (
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
