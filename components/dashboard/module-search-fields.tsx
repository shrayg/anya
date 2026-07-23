"use client";

import { Plus, X } from "lucide-react";

import type { SearchModuleDef } from "@/lib/search-modules";
import {
  createSearchFieldRow,
  detectSearchFieldType,
  getModuleSearchFieldOptions,
  placeholderForFieldType,
  shouldAutoDetectFieldType,
  type ModuleSearchFieldRow,
  type SearchFieldTypeId,
} from "@/lib/module-search-fields";
import {
  AutofillDecoyFields,
  SEARCH_AUTOFILL_SHIELD,
  unlockAutofillShield,
} from "@/lib/search-autofill-shield";

const MAX_FIELDS = 8;

export function ModuleSearchFields({
  moduleDef,
  fields,
  onChange,
  disabled,
  submitLabel,
  isSearching,
  canSubmit,
  extraActions,
}: {
  moduleDef: SearchModuleDef;
  fields: ModuleSearchFieldRow[];
  onChange: (fields: ModuleSearchFieldRow[]) => void;
  disabled?: boolean;
  submitLabel: string;
  isSearching: boolean;
  canSubmit: boolean;
  extraActions?: React.ReactNode;
}) {
  const options = getModuleSearchFieldOptions(moduleDef);
  const availableIds = options.map((option) => option.id);
  const hideTypePicker = Boolean(moduleDef.hideFieldTypePicker);
  const singleInput =
    hideTypePicker || Boolean(moduleDef.singleSearchField);

  const updateRow = (id: string, patch: Partial<ModuleSearchFieldRow>) => {
    onChange(
      fields.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const removeRow = (id: string) => {
    if (fields.length <= 1) return;
    onChange(fields.filter((row) => row.id !== id));
  };

  const addRow = () => {
    if (fields.length >= MAX_FIELDS || singleInput) return;
    const used = new Set(fields.map((row) => row.type));
    const nextType =
      options.find((option) => !used.has(option.id))?.id ??
      options[0]?.id ??
      "query";

    onChange([...fields, createSearchFieldRow(nextType)]);
  };

  const onValueChange = (row: ModuleSearchFieldRow, value: string) => {
    const trimmed = value.trim();

    // Cleared input unlocks a manual type pick so the next value can auto-detect.
    if (!trimmed) {
      updateRow(row.id, {
        value,
        typeManual: false,
        ...(hideTypePicker ? { type: "query" as SearchFieldTypeId } : {}),
      });
      return;
    }

    if (
      !hideTypePicker &&
      (row.typeManual || !shouldAutoDetectFieldType(row.type, availableIds))
    ) {
      updateRow(row.id, { value });
      return;
    }

    const detected = detectSearchFieldType(value, availableIds, row.type);

    updateRow(row.id, {
      value,
      type: detected,
      typeManual: false,
    });
  };

  const visibleFields = singleInput ? fields.slice(0, 1) : fields;

  return (
    <div className="module-search-form">
      <AutofillDecoyFields />
      <div className="module-search-fields">
        {visibleFields.map((row, index) => (
          <div
            key={row.id}
            className={
              hideTypePicker
                ? "module-search-field-row module-search-field-row--simple"
                : "module-search-field-row"
            }
          >
            {hideTypePicker ? null : (
              <>
                <label className="sr-only" htmlFor={`field-type-${row.id}`}>
                  Field type
                </label>
                <select
                  className="module-search-field-type dash-select"
                  disabled={disabled}
                  id={`field-type-${row.id}`}
                  value={row.type}
                  onChange={(event) =>
                    updateRow(row.id, {
                      type: event.target.value as SearchFieldTypeId,
                      typeManual: true,
                    })
                  }
                >
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            <input
              {...SEARCH_AUTOFILL_SHIELD}
              autoFocus={index === 0}
              readOnly
              className="ui-input module-search-field-input font-mono"
              data-tour={index === 0 ? "search-input" : undefined}
              disabled={disabled}
              name={`osint-field-${row.id}`}
              placeholder={
                hideTypePicker
                  ? moduleDef.hint
                  : placeholderForFieldType(row.type, options)
              }
              type="text"
              value={row.value}
              onChange={(event) => onValueChange(row, event.target.value)}
              onFocus={unlockAutofillShield}
            />
            {singleInput ? null : (
              <button
                aria-label="Remove field"
                className="module-search-field-remove"
                disabled={disabled || fields.length <= 1}
                type="button"
                onClick={() => removeRow(row.id)}
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="module-search-form-actions">
        {singleInput ? (
          <span />
        ) : (
          <button
            className="ui-btn ui-btn-ghost module-search-add-field"
            disabled={disabled || fields.length >= MAX_FIELDS}
            type="button"
            onClick={addRow}
          >
            <Plus className="size-4" />
            Add field
          </button>
        )}
        <div className="module-search-form-submit-group">
          {extraActions}
          <button
            className="ui-btn ui-btn-primary shrink-0"
            data-tour="search-submit"
            disabled={!canSubmit || isSearching || disabled}
            type="submit"
          >
            {isSearching ? "Scanning…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
