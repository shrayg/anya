"use client";

import { ArrowRight, Plus, X } from "lucide-react";
import clsx from "clsx";

import type { SearchModuleDef } from "@/lib/search-modules";
import {
  createSearchFieldRow,
  detectSearchFieldType,
  getModuleSearchFieldOptions,
  labelForFieldType,
  moduleNeedsManualFieldTypePicker,
  placeholderForFieldType,
  preferredAutoStartFieldType,
  shouldAutoDetectFieldType,
  type ModuleSearchFieldRow,
  type SearchFieldTypeId,
} from "@/lib/module-search-fields";
import {
  DEFAULT_PHONE_DIAL_CODE,
  PHONE_DIAL_CODES,
} from "@/lib/phone-dial-codes";
import {
  AutofillDecoyFields,
  SEARCH_AUTOFILL_SHIELD,
  unlockAutofillShield,
} from "@/lib/search-autofill-shield";
import { LiquidButton } from "@/components/ui/liquid-glass-button";

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
  const needsManualPicker =
    !hideTypePicker && moduleNeedsManualFieldTypePicker(availableIds);
  const showTypeChrome = !hideTypePicker;
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

    if (needsManualPicker) {
      const used = new Set(fields.map((row) => row.type));
      const nextType =
        options.find((option) => !used.has(option.id))?.id ??
        options[0]?.id ??
        "query";

      onChange([...fields, createSearchFieldRow(nextType)]);
      return;
    }

    const nextType = preferredAutoStartFieldType(options);

    onChange([...fields, createSearchFieldRow(nextType)]);
  };

  const onTypeChange = (row: ModuleSearchFieldRow, type: SearchFieldTypeId) => {
    updateRow(row.id, {
      type,
      typeManual: true,
      phoneDialCode:
        type === "phone"
          ? row.phoneDialCode ?? DEFAULT_PHONE_DIAL_CODE
          : undefined,
    });
  };

  const onValueChange = (row: ModuleSearchFieldRow, value: string) => {
    const trimmed = value.trim();

    if (!trimmed) {
      const emptyType = needsManualPicker
        ? row.type
        : preferredAutoStartFieldType(options);

      updateRow(row.id, {
        value,
        typeManual: false,
        type: hideTypePicker ? ("query" as SearchFieldTypeId) : emptyType,
      });
      return;
    }

    if (
      needsManualPicker &&
      (row.typeManual || !shouldAutoDetectFieldType(row.type, availableIds))
    ) {
      updateRow(row.id, { value });
      return;
    }

    if (hideTypePicker) {
      updateRow(row.id, { value, type: "query", typeManual: false });
      return;
    }

    const detected = detectSearchFieldType(value, availableIds, row.type);

    updateRow(row.id, {
      value,
      type: detected,
      typeManual: false,
      phoneDialCode:
        detected === "phone"
          ? row.phoneDialCode ?? DEFAULT_PHONE_DIAL_CODE
          : undefined,
    });
  };

  const visibleFields = singleInput ? fields.slice(0, 1) : fields;
  const multiField = visibleFields.length > 1;
  const inlineSubmit = !multiField;

  const submitButton = (
    <LiquidButton
      className="home-search-submit liquid-glass-button--accent module-search-submit shrink-0"
      data-tour="search-submit"
      disabled={!canSubmit || isSearching || disabled}
      type="submit"
    >
      {isSearching ? (
        "Scanning…"
      ) : (
        <>
          <span>{submitLabel}</span>
          <ArrowRight className="size-4" aria-hidden />
        </>
      )}
    </LiquidButton>
  );

  return (
    <div className="module-search-form module-search-form--composer">
      <AutofillDecoyFields />

      <div className="module-search-fields">
        {visibleFields.map((row, index) => {
          const showDial = showTypeChrome && row.type === "phone";
          const typeLabel = labelForFieldType(row.type, options);
          const isPrimary = index === 0;

          return (
            <div
              key={row.id}
              className={clsx(
                "module-search-field",
                isPrimary && "module-search-field--primary",
                !isPrimary && "module-search-field--extra",
              )}
            >
              {showTypeChrome ? (
                <div className="module-search-field-labelrow">
                  {needsManualPicker ? (
                    <>
                      <label
                        className="sr-only"
                        htmlFor={`field-type-${row.id}`}
                      >
                        Field type
                      </label>
                      <select
                        className="module-search-field-type-select"
                        disabled={disabled}
                        id={`field-type-${row.id}`}
                        value={row.type}
                        onChange={(event) =>
                          onTypeChange(
                            row,
                            event.target.value as SearchFieldTypeId,
                          )
                        }
                      >
                        {options.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <span
                      aria-live="polite"
                      className="module-search-field-label"
                      title={`Detected as ${typeLabel}`}
                    >
                      {typeLabel}
                    </span>
                  )}

                  {!singleInput && visibleFields.length > 1 ? (
                    <button
                      aria-label="Remove field"
                      className="module-search-field-remove-text"
                      disabled={disabled}
                      type="button"
                      onClick={() => removeRow(row.id)}
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div
                className={clsx(
                  "module-search-field-bar",
                  showDial && "module-search-field-bar--phone",
                )}
              >
                {showDial ? (
                  <>
                    <label className="sr-only" htmlFor={`field-dial-${row.id}`}>
                      Country calling code
                    </label>
                    <select
                      className="module-search-field-dial"
                      disabled={disabled}
                      id={`field-dial-${row.id}`}
                      title="Country calling code"
                      value={row.phoneDialCode ?? DEFAULT_PHONE_DIAL_CODE}
                      onChange={(event) =>
                        updateRow(row.id, {
                          phoneDialCode: event.target.value,
                        })
                      }
                    >
                      {PHONE_DIAL_CODES.map((entry) => (
                        <option key={entry.code} value={entry.code}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}

                <input
                  {...SEARCH_AUTOFILL_SHIELD}
                  autoFocus={index === 0}
                  readOnly
                  className="module-search-field-input font-mono"
                  data-tour={index === 0 ? "search-input" : undefined}
                  disabled={disabled}
                  name={`osint-field-${row.id}`}
                  placeholder={
                    hideTypePicker
                      ? moduleDef.hint
                      : showDial
                        ? "National number (no country code)"
                        : placeholderForFieldType(row.type, options)
                  }
                  type="text"
                  value={row.value}
                  onChange={(event) => onValueChange(row, event.target.value)}
                  onFocus={unlockAutofillShield}
                />

                {!singleInput && visibleFields.length === 1 ? (
                  <button
                    aria-label="Clear field"
                    className="module-search-field-clear"
                    disabled={disabled || !row.value}
                    type="button"
                    onClick={() => onValueChange(row, "")}
                  >
                    <X className="size-3.5" strokeWidth={2} />
                  </button>
                ) : null}

                {inlineSubmit && isPrimary ? submitButton : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="module-search-form-footer">
        {!singleInput ? (
          <button
            className="module-search-add-field"
            disabled={disabled || fields.length >= MAX_FIELDS}
            type="button"
            onClick={addRow}
          >
            <Plus aria-hidden className="size-3.5" strokeWidth={2.25} />
            Add another field
            <span className="module-search-add-field-count">
              {fields.length}/{MAX_FIELDS}
            </span>
          </button>
        ) : (
          <span aria-hidden className="module-search-form-footer-spacer" />
        )}

        <div className="module-search-form-footer-actions">
          {extraActions}
          {!inlineSubmit ? submitButton : null}
        </div>
      </div>
    </div>
  );
}
