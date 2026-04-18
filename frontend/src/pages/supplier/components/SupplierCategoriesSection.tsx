import { useMemo, useState } from "react";
import { CheckCheck, Search, X } from "lucide-react";
import type { SupplierDashboardT } from "../hooks/useSupplierDashboard";

type SupplierCategoriesSectionProps = {
  t: SupplierDashboardT;
  isEditable: boolean;
  invalidCategoriesSection: boolean;
  sectionDone: boolean;
  sectionProgress: string;
  canSave: boolean;
  flatCategoryList: Array<{ id: string; label: string; code: string }>;
  savedCategoryIds: string[];
  selectedCategoryIds: string[];
  setSelectedCategoryIds: React.Dispatch<React.SetStateAction<string[]>>;
  setInvalidSections: React.Dispatch<React.SetStateAction<{ profile: boolean; categories: boolean; contacts: boolean; documents: boolean }>>;
  onSaveCategories: () => Promise<void>;
};

export function SupplierCategoriesSection({
  t,
  isEditable,
  invalidCategoriesSection,
  sectionDone,
  sectionProgress,
  canSave,
  flatCategoryList,
  savedCategoryIds,
  selectedCategoryIds,
  setSelectedCategoryIds,
  setInvalidSections,
  onSaveCategories
}: SupplierCategoriesSectionProps) {
  const [query, setQuery] = useState("");
  const categoryById = useMemo(() => new Map(flatCategoryList.map((cat) => [cat.id, cat])), [flatCategoryList]);
  const filteredCategories = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return flatCategoryList;
    return flatCategoryList.filter((cat) =>
      cat.label.toLowerCase().includes(normalized) || cat.code.toLowerCase().includes(normalized)
    );
  }, [flatCategoryList, query]);

  const hasUnsavedChanges = useMemo(() => {
    if (savedCategoryIds.length !== selectedCategoryIds.length) return true;
    const saved = new Set(savedCategoryIds);
    for (const id of selectedCategoryIds) {
      if (!saved.has(id)) return true;
    }
    return false;
  }, [savedCategoryIds, selectedCategoryIds]);

  function clearCategoryInvalidState() {
    setInvalidSections((prev) => ({ ...prev, categories: false }));
  }

  function clearAllCategories() {
    setSelectedCategoryIds([]);
    clearCategoryInvalidState();
  }

  function selectAllFilteredCategories() {
    const filteredIds = filteredCategories.map((cat) => cat.id);
    setSelectedCategoryIds((prev) => Array.from(new Set([...prev, ...filteredIds])));
    clearCategoryInvalidState();
  }

  return (
    <section className="panel supplier-categories-panel">
      <div className="supplier-section-head">
        <h3>{t("supplier.categories.title")}</h3>
        <div className="supplier-section-meta">
          <span className="supplier-section-progress">{sectionProgress}</span>
          {hasUnsavedChanges ? <span className="supplier-section-unsaved">{t("supplier.section.unsaved")}</span> : null}
          <span className={`supplier-section-chip ${sectionDone ? "complete" : "pending"}`}>
            {sectionDone ? t("supplier.section.complete") : t("supplier.section.pending")}
          </span>
        </div>
      </div>
      <div className="supplier-categories-toolbar">
        <div className="supplier-categories-search-wrap">
          <Search className="supplier-categories-search-icon h-4 w-4" />
          <input
            className="supplier-categories-search"
            disabled={!isEditable}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("supplier.categories.searchPlaceholder")}
          />
          <div className="supplier-categories-quick-actions">
            <button type="button" title={t("supplier.categories.quick.selectAll")} aria-label={t("supplier.categories.quick.selectAll")} disabled={!isEditable} onClick={selectAllFilteredCategories}>
              <CheckCheck className="h-4 w-4" />
            </button>
            <button type="button" title={t("supplier.categories.quick.clearAll")} aria-label={t("supplier.categories.quick.clearAll")} disabled={!isEditable} onClick={clearAllCategories}>
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="supplier-categories-selected-chips">
        {selectedCategoryIds.map((id) => (
          <button
            key={id}
            type="button"
            className="supplier-categories-chip"
            disabled={!isEditable}
            onClick={() => {
              setSelectedCategoryIds((prev) => prev.filter((value) => value !== id));
              clearCategoryInvalidState();
            }}
          >
            {categoryById.get(id)?.label ?? id}
            {categoryById.get(id)?.code ? <span className="review-category-code-chip">{categoryById.get(id)?.code}</span> : null}
            <span aria-hidden="true">×</span>
          </button>
        ))}
      </div>
      <div className={`checkbox-grid supplier-categories-grid ${invalidCategoriesSection ? "input-invalid" : ""}`}>
        {filteredCategories.map((cat) => (
          <label key={cat.id} className="supplier-category-item">
            <input
              type="checkbox"
              checked={selectedCategoryIds.includes(cat.id)}
              disabled={!isEditable}
              onChange={(e) => {
                setSelectedCategoryIds((prev) =>
                  e.target.checked ? [...prev, cat.id] : prev.filter((value) => value !== cat.id)
                );
                clearCategoryInvalidState();
              }}
            />
            <span className="supplier-category-item-label">{cat.label}</span>
            {cat.code ? <span className="review-category-code-chip">{cat.code}</span> : null}
          </label>
        ))}
        {filteredCategories.length === 0 ? <div className="supplier-categories-empty">{t("supplier.categories.noMatch")}</div> : null}
      </div>
      <button className={`supplier-categories-save-btn ${!canSave ? "is-locked" : ""}`} disabled={!isEditable} onClick={() => void onSaveCategories()}>{t("supplier.categories.save")}</button>
    </section>
  );
}
