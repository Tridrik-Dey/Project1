import { useMemo, useState, type FormEvent } from "react";
import { CalendarDays, CheckCircle2, FilePlus2, FileStack, FolderUp, NotepadText, Plus, Trash2, Upload } from "lucide-react";
import { DOCUMENT_TYPES } from "../../../constants/options";
import type { DocumentResponse } from "../../../types/api";
import type { SupplierDashboardT } from "../hooks/useSupplierDashboard";
import type { DocumentFormRow } from "../types";
import { SupplierDatePickerField } from "./SupplierDatePickerField";

type SupplierDocumentsSectionProps = {
  t: SupplierDashboardT;
  isEditable: boolean;
  sectionDone: boolean;
  sectionProgress: string;
  hasUnsavedChanges: boolean;
  canSave: boolean;
  documentRows: DocumentFormRow[];
  documents: DocumentResponse[];
  getTodayIsoDate: () => string;
  addDocumentRow: () => void;
  removeDocumentRow: (id: string) => void;
  updateDocumentRow: (id: string, patch: Partial<DocumentFormRow>) => void;
  unlockDocumentRowForNewExpiry: (id: string) => void;
  getDocumentInputClass: (rowId: string, fieldKey: "type" | "expiryDate" | "file") => string;
  onDeleteDocument: (documentId: string) => Promise<void>;
  onUploadDocument: (event: FormEvent<HTMLFormElement>) => Promise<void>;
};

export function SupplierDocumentsSection({
  t,
  isEditable,
  sectionDone,
  sectionProgress,
  hasUnsavedChanges,
  canSave,
  documentRows,
  documents,
  getTodayIsoDate,
  addDocumentRow,
  removeDocumentRow,
  updateDocumentRow,
  unlockDocumentRowForNewExpiry,
  getDocumentInputClass,
  onDeleteDocument,
  onUploadDocument
}: SupplierDocumentsSectionProps) {
  const [historySort, setHistorySort] = useState<"recent" | "expiry" | "type">("recent");
  const today = getTodayIsoDate();
  const getDocumentTypeLabel = (type: string) => t(`option.documentType.${type.toLowerCase()}`);

  const sortedDocuments = useMemo(() => {
    const copy = [...documents];
    if (historySort === "type") {
      copy.sort((a, b) => getDocumentTypeLabel(a.documentType).localeCompare(getDocumentTypeLabel(b.documentType)));
      return copy;
    }
    if (historySort === "expiry") {
      copy.sort((a, b) => {
        const aDate = a.expiryDate ?? "9999-12-31";
        const bDate = b.expiryDate ?? "9999-12-31";
        return aDate.localeCompare(bDate);
      });
      return copy;
    }
    copy.sort((a, b) => {
      const aTs = Date.parse(a.uploadedAt ?? "");
      const bTs = Date.parse(b.uploadedAt ?? "");
      return (Number.isNaN(bTs) ? 0 : bTs) - (Number.isNaN(aTs) ? 0 : aTs);
    });
    return copy;
  }, [documents, historySort]);

  const groupedDocuments = useMemo(() => {
    const map = new Map<string, DocumentResponse[]>();
    for (const doc of sortedDocuments) {
      const list = map.get(doc.documentType) ?? [];
      list.push(doc);
      map.set(doc.documentType, list);
    }
    return Array.from(map.entries());
  }, [sortedDocuments]);

  function getExpiryState(expiryDate?: string): "valid" | "expiring" | "expired" | "na" {
    if (!expiryDate) return "na";
    if (expiryDate < today) return "expired";
    const diffDays = Math.ceil((Date.parse(expiryDate) - Date.parse(today)) / (1000 * 60 * 60 * 24));
    if (diffDays <= 30) return "expiring";
    return "valid";
  }

  function getExpiryLabel(expiryDate?: string): string {
    const state = getExpiryState(expiryDate);
    if (state === "expired") return t("supplier.documents.expiry.expired");
    if (state === "expiring") return t("supplier.documents.expiry.expiring");
    if (state === "valid") return t("supplier.documents.expiry.valid");
    return t("common.na");
  }

  return (
    <section className="panel supplier-documents-panel">
      <div className="supplier-section-head">
        <h3>{t("supplier.documents.title")}</h3>
        <div className="supplier-section-meta">
          <span className="supplier-section-progress">{sectionProgress}</span>
          {hasUnsavedChanges ? <span className="supplier-section-unsaved">{t("supplier.section.unsaved")}</span> : null}
          <span className={`supplier-section-chip ${sectionDone ? "complete" : "pending"}`}>
            {sectionDone ? t("supplier.section.complete") : t("supplier.section.pending")}
          </span>
        </div>
      </div>
      <div className="supplier-documents-layout">
        <form className="supplier-documents-form supplier-documents-editor" onSubmit={(event) => void onUploadDocument(event)}>
          <div className="stack">
          {documentRows.map((row, index) => (
            <div key={row.id} className={`supplier-doc-row ${getDocumentInputClass(row.id, "type") || getDocumentInputClass(row.id, "expiryDate") || getDocumentInputClass(row.id, "file") ? "supplier-doc-row-invalid" : ""}`}>
              <h4>{t("supplier.documents.item", { index: index + 1 })}</h4>
              {/*
                In Documento N, hide types already used in previous rows.
                This keeps Documento 2 from reusing Documento 1 type.
              */}
              {(() => {
                const usedTypesBefore = new Set(documentRows.slice(0, index).map((r) => r.type));
                return (
              <div className="grid-form">
                <label className={`floating-field ${row.type ? "has-value" : ""}`}>
                  <FileStack className="floating-field-icon" />
                  <select
                    className={`floating-input ${getDocumentInputClass(row.id, "type")}`}
                    disabled={!isEditable || !!row.lockedType}
                    value={row.type}
                    onChange={(e) => updateDocumentRow(row.id, { type: e.target.value })}
                  >
                    <option value="">{t("common.select.dashed")}</option>
                    {DOCUMENT_TYPES
                      .filter((v) => !usedTypesBefore.has(v) || v === row.type)
                      .map((v) => <option key={v} value={v}>{getDocumentTypeLabel(v)}</option>)}
                  </select>
                  <span className="floating-field-label">{t("field.type")}</span>
                </label>
                <label className={`floating-field ${row.expiryDate ? "has-value" : ""}`}>
                  <CalendarDays className="floating-field-icon" />
                  <SupplierDatePickerField
                    t={t}
                    value={row.expiryDate}
                    onChange={(next) => updateDocumentRow(row.id, { expiryDate: next })}
                    disabled={!isEditable || !!row.lockedExpiry}
                    minDate={getTodayIsoDate()}
                    className={`floating-input floating-input-date ${getDocumentInputClass(row.id, "expiryDate")}`}
                  />
                  <span className="floating-field-label">{t("field.expiryDate")}</span>
                </label>
                <label className={`full floating-field ${row.notes ? "has-value" : ""}`}>
                  <NotepadText className="floating-field-icon" />
                  <input className="floating-input" disabled={!isEditable || !!row.lockedExpiry} placeholder={t("field.hint.notes")} value={row.notes} onChange={(e) => updateDocumentRow(row.id, { notes: e.target.value })} />
                  <span className="floating-field-label">{t("field.notes")}</span>
                </label>
                <label className="full">
                  {t("field.file")}
                  <input
                    id={`supplier-doc-file-${row.id}`}
                    className="supplier-file-input-native"
                    disabled={!isEditable || !!row.lockedExpiry}
                    type="file"
                    onChange={(e) => updateDocumentRow(row.id, { file: e.target.files?.[0] ?? null })}
                  />
                  <div className="supplier-file-picker-row">
                    <div className={`supplier-file-picker ${getDocumentInputClass(row.id, "file") ? "input-invalid" : ""}`}>
                      <button
                        className="supplier-file-picker-btn"
                        type="button"
                        disabled={!isEditable || !!row.lockedExpiry}
                        onClick={() => {
                          const input = document.getElementById(`supplier-doc-file-${row.id}`) as HTMLInputElement | null;
                          if (!input) return;
                          // Reset native value so selecting the same file again still triggers onChange.
                          input.value = "";
                          input.click();
                        }}
                      >
                        <FolderUp className="h-4 w-4" />
                        {row.file ? t("supplier.documents.changeFile") : t("supplier.documents.chooseFile")}
                      </button>
                      <span className={`supplier-file-name-chip ${row.file ? "has-file" : ""}`}>
                        {row.file ? row.file.name : t("supplier.documents.noFileSelected")}
                      </span>
                    </div>
                    {row.lockedType && row.lockedExpiry ? (
                      <button
                        className="supplier-doc-cycle-btn"
                        type="button"
                        disabled={!isEditable}
                        title={t("supplier.documents.newExpiry")}
                        aria-label={t("supplier.documents.newExpiry")}
                        onClick={() => unlockDocumentRowForNewExpiry(row.id)}
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  {row.file ? (
                    <span className="supplier-file-ready">
                      <CheckCircle2 className="h-4 w-4" />
                      {t("supplier.documents.readyToUpload")}
                    </span>
                  ) : null}
                </label>
              </div>
                );
              })()}
              {documentRows.length > 1 && !row.lockedType ? (
                <button
                  className="supplier-doc-remove-btn"
                  type="button"
                  disabled={!isEditable}
                  title={t("supplier.documents.removeItem")}
                  aria-label={t("supplier.documents.removeItem")}
                  onClick={() => removeDocumentRow(row.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
          ))}
          <div className="inline-form supplier-doc-actions">
            <button className="supplier-doc-add-btn" type="button" disabled={!isEditable} onClick={addDocumentRow}>
              <FilePlus2 className="h-4 w-4" />
              {t("supplier.documents.addMore")}
            </button>
            <button className={`supplier-doc-upload-btn ${!canSave ? "is-locked" : ""}`} disabled={!isEditable} type="submit">
              <Upload className="h-4 w-4" />
              {t("supplier.documents.upload")}
            </button>
          </div>
          </div>
        </form>

        <div className="supplier-documents-history">
          <div className="supplier-doc-history-head">
            <strong>{t("supplier.documents.title")} ({documents.length})</strong>
            <select className="supplier-doc-sort-select" value={historySort} onChange={(e) => setHistorySort(e.target.value as "recent" | "expiry" | "type")}>
              <option value="recent">{t("supplier.documents.sort.recent")}</option>
              <option value="expiry">{t("supplier.documents.sort.expiry")}</option>
              <option value="type">{t("supplier.documents.sort.type")}</option>
            </select>
          </div>
          {documents.length === 0 ? (
            <ul className="list supplier-doc-list">
              <li className="subtle">{t("common.noDocuments")}</li>
            </ul>
          ) : (
            <div className="supplier-doc-groups">
              {groupedDocuments.map(([type, items]) => (
                <div key={type} className="supplier-doc-group">
                  <div className="supplier-doc-group-head">
                    <span className="supplier-doc-type-pill">{getDocumentTypeLabel(type)}</span>
                    <span className="supplier-doc-group-count">{items.length}</span>
                  </div>
                  <ul className="list supplier-doc-list">
                    {items.map((d) => (
                      <li key={d.id} className="supplier-doc-history-item">
                        <div className="supplier-doc-history-main">
                          <strong>{d.originalFilename}</strong>
                          <div className="subtle">
                            {Math.round(d.fileSizeBytes / 1024)} KB | {t("field.expiryDate")}: {d.expiryDate ?? t("common.na")} | {t("supplier.doc.current")}: {String(d.isCurrent)}
                          </div>
                        </div>
                        <div className="supplier-doc-history-actions">
                          <div className={`supplier-doc-expiry-badge ${getExpiryState(d.expiryDate)}`}>
                            {getExpiryLabel(d.expiryDate)}
                          </div>
                          <button
                            className="supplier-doc-list-remove-btn"
                            type="button"
                            disabled={!isEditable}
                            title={t("supplier.documents.removeItem")}
                            aria-label={t("supplier.documents.removeItem")}
                            onClick={() => void onDeleteDocument(d.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
