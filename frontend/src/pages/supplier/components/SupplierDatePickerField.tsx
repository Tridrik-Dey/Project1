import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import type { SupplierDashboardT } from "../hooks/useSupplierDashboard";
import { useI18n } from "../../../i18n/I18nContext";

type SupplierDatePickerFieldProps = {
  t: SupplierDashboardT;
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
  className?: string;
  minDate?: string;
  maxDate?: string;
};

function toIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function formatDisplay(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return "";
  return `${d}-${m}-${y}`;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getMonthStartIndexMondayFirst(year: number, month: number): number {
  const sundayFirst = new Date(year, month, 1).getDay();
  return (sundayFirst + 6) % 7;
}

export function SupplierDatePickerField({
  t,
  value,
  onChange,
  disabled,
  className,
  minDate,
  maxDate
}: SupplierDatePickerFieldProps) {
  const { language } = useI18n();
  const locale = language === "en" ? "en-US" : "it-IT";
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const initialDate = useMemo(() => {
    if (value) {
      const parsed = new Date(`${value}T00:00:00`);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  }, [value]);
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!value) return;
    const selected = new Date(`${value}T00:00:00`);
    if (Number.isNaN(selected.getTime())) return;
    setViewYear(selected.getFullYear());
    setViewMonth(selected.getMonth());
  }, [value]);

  const monthLabel = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(new Date(viewYear, viewMonth, 1)),
    [locale, viewMonth, viewYear]
  );

  const weekdayLabels = useMemo(
    () => (language === "en" ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] : ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"]),
    [language]
  );

  const days = useMemo(() => {
    const start = getMonthStartIndexMondayFirst(viewYear, viewMonth);
    const total = getDaysInMonth(viewYear, viewMonth);
    const cells: Array<{ day: number; iso: string; disabled: boolean; selected: boolean } | null> = [];
    for (let i = 0; i < start; i += 1) cells.push(null);
    for (let day = 1; day <= total; day += 1) {
      const iso = toIso(new Date(viewYear, viewMonth, day));
      cells.push({
        day,
        iso,
        disabled: Boolean((minDate && iso < minDate) || (maxDate && iso > maxDate)),
        selected: iso === value
      });
    }
    return cells;
  }, [maxDate, minDate, value, viewMonth, viewYear]);

  return (
    <div className="supplier-date-picker-control" ref={rootRef}>
      <input
        className={className}
        disabled={disabled}
        type="text"
        readOnly
        value={formatDisplay(value)}
        placeholder="gg-mm-aaaa"
        onClick={() => !disabled && setOpen((prev) => !prev)}
      />
      <button
        className="supplier-date-picker-trigger"
        type="button"
        disabled={disabled}
        title={t("field.date.openPicker")}
        aria-label={t("field.date.openPicker")}
        onClick={() => setOpen((prev) => !prev)}
      >
        <CalendarDays className="h-4 w-4" />
      </button>
      {open ? (
        <div className="supplier-date-popover" role="dialog" aria-label={t("field.date.openPicker")}>
          <div className="supplier-date-popover-head">
            <button
              className="supplier-date-nav-btn"
              type="button"
              onClick={() => {
                if (viewMonth === 0) {
                  setViewMonth(11);
                  setViewYear((prev) => prev - 1);
                } else {
                  setViewMonth((prev) => prev - 1);
                }
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <strong>{monthLabel}</strong>
            <button
              className="supplier-date-nav-btn"
              type="button"
              onClick={() => {
                if (viewMonth === 11) {
                  setViewMonth(0);
                  setViewYear((prev) => prev + 1);
                } else {
                  setViewMonth((prev) => prev + 1);
                }
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <div className="supplier-date-weekdays">
            {weekdayLabels.map((label) => <span key={label}>{label}</span>)}
          </div>
          <div className="supplier-date-days-grid">
            {days.map((cell, index) => {
              if (!cell) return <span key={`empty-${index}`} className="supplier-date-day-empty" />;
              return (
                <button
                  key={cell.iso}
                  className={`supplier-date-day-btn ${cell.selected ? "selected" : ""}`}
                  type="button"
                  disabled={cell.disabled}
                  onClick={() => {
                    onChange(cell.iso);
                    setOpen(false);
                  }}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
          <div className="supplier-date-popover-foot">
            <button className="supplier-date-foot-btn" type="button" onClick={() => onChange("")}>
              <X className="h-4 w-4" /> {t("common.reset")}
            </button>
            <button className="supplier-date-foot-btn" type="button" onClick={() => setOpen(false)}>
              {t("common.close")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
