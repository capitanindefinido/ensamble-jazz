import { Search } from "lucide-react";

export default function SearchBar({ value, onChange, placeholder }) {
  return (
    <div className="be-search">
      <Search size={16} className="be-search-ic" />
      <input
        className="be-search-in"
        placeholder={placeholder || "Buscar tema o compositor"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
