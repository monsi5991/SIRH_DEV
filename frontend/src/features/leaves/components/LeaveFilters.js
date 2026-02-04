// src/features/leaves/components/LeaveFilters.js
import React, { useState } from "react";
import PropTypes from "prop-types";
import { Search as SearchIcon, Filter } from "lucide-react";
import { Button } from "../../../components/ui/button";

/**
 * LeaveFilters
 * Composant de recherche et filtrage des demandes de congés
 */
export default function LeaveFilters({ value, onChange, onSearch }) {
  const [searchTerm, setSearchTerm] = useState(value?.search || "");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onSearch) onSearch(searchTerm);
  };

  const handleReset = () => {
    setSearchTerm("");
    if (onChange) onChange({ search: "" });
    if (onSearch) onSearch("");
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col sm:flex-row gap-2 sm:items-center"
    >
      <div className="relative flex-1">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (onChange) onChange({ search: e.target.value });
          }}
          placeholder="Rechercher par employé, statut…"
          className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full"
        />
      </div>

      <div className="flex gap-2">
        <Button type="submit" variant="default">
          <SearchIcon className="w-4 h-4 mr-2" />
          Rechercher
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handleReset}
        >
          <Filter className="w-4 h-4 mr-2" />
          Réinitialiser
        </Button>
      </div>
    </form>
  );
}

// ✅ Validation des props (corrige les erreurs ESLint)
LeaveFilters.propTypes = {
  value: PropTypes.shape({
    search: PropTypes.string,
  }),
  onChange: PropTypes.func, // appelée quand le champ change
  onSearch: PropTypes.func, // appelée au submit
};

// ✅ Valeurs par défaut
LeaveFilters.defaultProps = {
  value: { search: "" },
  onChange: () => {},
  onSearch: () => {},
};
