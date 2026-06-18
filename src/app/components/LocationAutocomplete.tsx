import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';

const SA_CITIES = [
  // Gauteng
  'Johannesburg', 'Pretoria', 'Sandton', 'Midrand', 'Centurion', 'Soweto',
  'Ekurhuleni', 'Germiston', 'Benoni', 'Boksburg', 'Randburg', 'Roodepoort',
  'Alberton', 'Springs', 'Tembisa', 'Kempton Park', 'Vereeniging', 'Vanderbijlpark',
  'Edenvale', 'Krugersdorp',
  // Western Cape
  'Cape Town', 'Stellenbosch', 'Paarl', 'George', 'Worcester', 'Knysna',
  'Hermanus', 'Somerset West', 'Bellville', 'Mitchells Plain', 'Khayelitsha',
  'Brackenfell', 'Strand', 'Claremont', 'Constantia', 'Mossel Bay', 'Oudtshoorn',
  // KwaZulu-Natal
  'Durban', 'Pietermaritzburg', 'Richards Bay', 'Newcastle', 'Umhlanga',
  'Ballito', 'Pinetown', 'Umlazi', 'Ladysmith', 'Port Shepstone',
  'Amanzimtoti', 'Tongaat', 'Margate', 'Mtubatuba',
  // Eastern Cape
  'Gqeberha', 'Port Elizabeth', 'East London', 'Mthatha', 'Queenstown',
  'King William\'s Town', 'Uitenhage', 'Makhanda', 'Grahamstown', 'Bhisho',
  // Free State
  'Bloemfontein', 'Welkom', 'Bethlehem', 'Sasolburg', 'Kroonstad', 'Phuthaditjhaba',
  // Limpopo
  'Polokwane', 'Mokopane', 'Tzaneen', 'Thohoyandou', 'Bela-Bela', 'Musina', 'Phalaborwa',
  // Mpumalanga
  'Mbombela', 'Nelspruit', 'eMalahleni', 'Witbank', 'Secunda', 'Middelburg',
  'Ermelo', 'Standerton', 'Barberton',
  // North West
  'Rustenburg', 'Mahikeng', 'Potchefstroom', 'Klerksdorp', 'Brits', 'Lichtenburg',
  // Northern Cape
  'Kimberley', 'Upington', 'Springbok', 'De Aar', 'Kuruman',
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  inputClassName?: string;
  showIcon?: boolean;
}

export function LocationAutocomplete({
  value,
  onChange,
  placeholder = 'City or location...',
  className = '',
  inputClassName = '',
  showIcon = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = value.trim().toLowerCase();
    if (q.length < 1) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    const matches = SA_CITIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 8);
    setSuggestions(matches);
    setOpen(matches.length > 0);
  }, [value]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className={showIcon ? 'flex items-center gap-2' : ''}>
        {showIcon && <MapPin className="w-5 h-5 text-[var(--rf-muted)] flex-shrink-0" />}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          autoComplete="off"
          className={inputClassName || 'w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'}
        />
      </div>
      {open && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border border-gray-200 bg-white py-1 shadow-lg text-sm">
          {suggestions.map((city) => (
            <li
              key={city}
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(city);
                setOpen(false);
              }}
              className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 text-gray-800"
            >
              <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
              {city}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
