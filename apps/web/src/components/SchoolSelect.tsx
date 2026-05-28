import { useEffect, useMemo, useRef, useState } from "react";
import type { School } from "../api";
import type { TranslationCopy } from "../i18n";

export function SchoolSelect({
  copy,
  schools,
  selectedSchoolId,
  onChange
}: {
  copy: TranslationCopy;
  schools: School[];
  selectedSchoolId: string;
  onChange: (schoolId: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLLabelElement | null>(null);
  const selectedSchool = schools.find((school) => school.id === selectedSchoolId);
  const normalizedSearch = search.toLowerCase().trim();
  const filteredSchools = useMemo(() => {
    const rows = normalizedSearch
      ? schools.filter((school) =>
        `${school.name} ${school.qark} ${school.city}`.toLowerCase().includes(normalizedSearch)
      )
      : schools;
    return rows.slice(0, 36);
  }, [normalizedSearch, schools]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  return (
    <label className="school-select" ref={wrapperRef}>
      {copy.schoolIdentifier}
      <input
        value={isOpen ? search : selectedSchool?.name || search}
        onChange={(event) => {
          setSearch(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          setIsOpen(true);
          setSearch("");
        }}
        placeholder={copy.schoolSearchPlaceholder}
      />
      {isOpen && (
        <div className="school-option-list">
          {filteredSchools.map((school) => (
            <button
              className={school.id === selectedSchoolId ? "active" : ""}
              key={school.id}
              onClick={() => {
                onChange(school.id);
                setSearch("");
                setIsOpen(false);
              }}
              type="button"
            >
              <strong>{school.name}</strong>
              <span>{school.city} · {school.qark}</span>
            </button>
          ))}
        </div>
      )}
      {selectedSchool && (
        <small className="selected-school">
          {copy.selectedSchool}: {selectedSchool.name} · {selectedSchool.city}, {selectedSchool.qark}
        </small>
      )}
    </label>
  );
}
