"use client";

import { Plus, X } from "lucide-react";

import type { SearchModuleDef } from "@/lib/search-modules";
import {
  createSearchFieldRow,
  getModuleSearchFieldOptions,
  placeholderForFieldType,
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
    if (fields.length >= MAX_FIELDS) return;
    const used = new Set(fields.map((row) => row.type));
    const nextType =
      options.find((option) => !used.has(option.id))?.id ??
      options[0]?.id ??
      "query";

    onChange([...fields, createSearchFieldRow(nextType)]);
  };

  return (
    <div className="module-search-form">
      <AutofillDecoyFields />
      <div className="module-search-fields">
        {fields.map((row, index) => (
          <div key={row.id} className="module-search-field-row">
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
                })
              }
            >
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              {...SEARCH_AUTOFILL_SHIELD}
              autoFocus={index === 0}
              readOnly
              className="ui-input module-search-field-input font-mono text-sm"
              data-tour={index === 0 ? "search-input" : undefined}
              disabled={disabled}
              name={`osint-field-${row.id}`}
              placeholder={placeholderForFieldType(row.type, options)}
              type="text"
              value={row.value}
              onChange={(event) =>
                updateRow(row.id, { value: event.target.value })
              }
              onFocus={unlockAutofillShield}
            />
            <button
              aria-label="Remove field"
              className="module-search-field-remove"
              disabled={disabled || fields.length <= 1}
              type="button"
              onClick={() => removeRow(row.id)}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="module-search-form-actions">
        <button
          className="ui-btn ui-btn-ghost module-search-add-field"
          disabled={disabled || fields.length >= MAX_FIELDS}
          type="button"
          onClick={addRow}
        >
          <Plus className="size-3.5" />
          Add field
        </button>
        <div className="module-search-form-submit-group">
          {extraActions}
          <button
            className="ui-btn ui-btn-primary shrink-0 sm:min-w-[6.5rem]"
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
