"use client";

import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";

export type DashSelectOption = {
  value: string;
  label: ReactNode;
  disabled?: boolean;
};

type DashSelectMenuProps = {
  options: DashSelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
  triggerClassName?: string;
  menuClassName?: string;
  name?: string;
  title?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
};

function optionLabelText(label: ReactNode): string {
  if (typeof label === "string" || typeof label === "number") {
    return String(label);
  }
  return "";
}

export function DashSelectMenu({
  options,
  value,
  defaultValue = "",
  onValueChange,
  disabled,
  id,
  className,
  triggerClassName,
  menuClassName,
  name,
  title,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: DashSelectMenuProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [uncontrolled, setUncontrolled] = useState(defaultValue);
  const [activeIndex, setActiveIndex] = useState(0);
  const [menuBox, setMenuBox] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const selectedValue = value !== undefined ? value : uncontrolled;
  const selected =
    options.find((option) => option.value === selectedValue) ?? options[0];
  const enabledIndexes = useMemo(
    () =>
      options
        .map((option, index) => (option.disabled ? -1 : index))
        .filter((index) => index >= 0),
    [options],
  );

  useEffect(() => {
    setMounted(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setMenuBox(null);
  }, []);

  const commit = useCallback(
    (next: string) => {
      if (value === undefined) setUncontrolled(next);
      onValueChange?.(next);
      close();
      triggerRef.current?.focus();
    },
    [close, onValueChange, value],
  );

  const updateMenuBox = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    const viewportPad = 8;
    const preferredMax = 260;
    const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPad;
    const spaceAbove = rect.top - gap - viewportPad;
    const placement =
      spaceBelow < 140 && spaceAbove > spaceBelow ? "above" : "below";
    const maxHeight = Math.min(
      preferredMax,
      Math.max(120, placement === "below" ? spaceBelow : spaceAbove),
    );
    const width = Math.max(rect.width, 9.5 * 16);

    setMenuBox({
      ...(placement === "below"
        ? { top: rect.bottom + gap }
        : { bottom: window.innerHeight - rect.top + gap }),
      left: Math.min(
        Math.max(viewportPad, rect.left),
        window.innerWidth - width - viewportPad,
      ),
      width,
      maxHeight,
    });
  }, []);

  const openMenu = useCallback(() => {
    if (disabled || options.length === 0) return;
    const selectedIndex = Math.max(
      0,
      options.findIndex((option) => option.value === selectedValue),
    );
    const start =
      enabledIndexes.find((index) => index >= selectedIndex) ??
      enabledIndexes[0] ??
      0;
    setActiveIndex(start);
    setOpen(true);
    updateMenuBox();
  }, [disabled, enabledIndexes, options, selectedValue, updateMenuBox]);

  useLayoutEffect(() => {
    if (!open) return;
    updateMenuBox();
    // Focus the list so arrow keys / typeahead work immediately.
    requestAnimationFrame(() => listRef.current?.focus());
    const onReposition = () => updateMenuBox();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updateMenuBox]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (listRef.current?.contains(target)) return;
      close();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [close, open]);

  useEffect(() => {
    if (!open) return;
    const optionEl = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    optionEl?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  useEffect(() => {
    if (disabled) close();
  }, [close, disabled]);

  const moveActive = (delta: number) => {
    if (enabledIndexes.length === 0) return;
    const currentPos = enabledIndexes.indexOf(activeIndex);
    const nextPos =
      currentPos < 0
        ? 0
        : (currentPos + delta + enabledIndexes.length) % enabledIndexes.length;
    setActiveIndex(enabledIndexes[nextPos]!);
  };

  const onTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (
      event.key === "ArrowDown" ||
      event.key === "ArrowUp" ||
      event.key === "Enter" ||
      event.key === " "
    ) {
      event.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      if (event.key === "ArrowDown") moveActive(1);
      if (event.key === "ArrowUp") moveActive(-1);
      if (event.key === "Enter" || event.key === " ") {
        const option = options[activeIndex];
        if (option && !option.disabled) commit(option.value);
      }
    }
  };

  const onListKeyDown = (event: ReactKeyboardEvent<HTMLUListElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      if (enabledIndexes[0] !== undefined) setActiveIndex(enabledIndexes[0]);
    } else if (event.key === "End") {
      event.preventDefault();
      const last = enabledIndexes[enabledIndexes.length - 1];
      if (last !== undefined) setActiveIndex(last);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const option = options[activeIndex];
      if (option && !option.disabled) commit(option.value);
    } else if (event.key === "Tab") {
      close();
    } else if (event.key.length === 1 && !event.altKey && !event.ctrlKey) {
      const needle = event.key.toLowerCase();
      const from = activeIndex + 1;
      const order = [
        ...options.slice(from),
        ...options.slice(0, from),
      ];
      const match = order.find(
        (option) =>
          !option.disabled &&
          optionLabelText(option.label).toLowerCase().startsWith(needle),
      );
      if (match) {
        const index = options.indexOf(match);
        if (index >= 0) setActiveIndex(index);
      }
    }
  };

  const menu =
    mounted && open && menuBox
      ? createPortal(
          <ul
            ref={listRef}
            aria-activedescendant={`${listId}-opt-${activeIndex}`}
            className={clsx("dash-select-panel", menuClassName)}
            id={listId}
            role="listbox"
            style={{
              top: menuBox.top,
              bottom: menuBox.bottom,
              left: menuBox.left,
              width: menuBox.width,
              maxHeight: menuBox.maxHeight,
            }}
            tabIndex={-1}
            onKeyDown={onListKeyDown}
          >
            {options.map((option, index) => {
              const isSelected = option.value === selectedValue;
              const isActive = index === activeIndex;
              return (
                <li
                  key={`${option.value}-${index}`}
                  aria-disabled={option.disabled || undefined}
                  aria-selected={isSelected}
                  className={clsx(
                    "dash-select-option",
                    isSelected && "dash-select-option--selected",
                    isActive && "dash-select-option--active",
                    option.disabled && "dash-select-option--disabled",
                  )}
                  data-index={index}
                  id={`${listId}-opt-${index}`}
                  role="option"
                  onMouseEnter={() => {
                    if (!option.disabled) setActiveIndex(index);
                  }}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    if (!option.disabled) commit(option.value);
                  }}
                >
                  {option.label}
                </li>
              );
            })}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className={clsx("dash-select-root", className)}>
      {name ? (
        <input name={name} type="hidden" value={selectedValue ?? ""} />
      ) : null}
      <button
        ref={triggerRef}
        aria-controls={listId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={clsx(
          "dash-select dash-select-trigger",
          open && "dash-select-trigger--open",
          triggerClassName,
        )}
        disabled={disabled}
        id={id}
        title={title}
        type="button"
        onClick={() => {
          if (open) close();
          else openMenu();
        }}
        onKeyDown={onTriggerKeyDown}
      >
        <span className="dash-select-trigger-label">
          {selected?.label ?? "Select"}
        </span>
        <ChevronDown
          aria-hidden
          className={clsx(
            "dash-select-chevron",
            open && "dash-select-chevron--open",
          )}
          strokeWidth={2}
        />
      </button>
      {menu}
    </div>
  );
}

export function optionsFromSelectChildren(
  children: ReactNode,
): DashSelectOption[] {
  const options: DashSelectOption[] = [];

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type !== "option") return;

    const props = child.props as {
      value?: string | number;
      disabled?: boolean;
      children?: ReactNode;
    };

    options.push({
      value: props.value === undefined ? "" : String(props.value),
      label: props.children ?? String(props.value ?? ""),
      disabled: Boolean(props.disabled),
    });
  });

  return options;
}

export function DashSelectFromNativeProps({
  className,
  children,
  value,
  defaultValue,
  disabled,
  id,
  name,
  title,
  onChange,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
}: SelectHTMLAttributes<HTMLSelectElement>) {
  const options = useMemo(() => optionsFromSelectChildren(children), [children]);
  const resolvedValue =
    value === undefined ? undefined : value === null ? "" : String(value);
  const resolvedDefault =
    defaultValue === undefined
      ? undefined
      : defaultValue === null
        ? ""
        : String(defaultValue);

  return (
    <DashSelectMenu
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      defaultValue={resolvedDefault}
      disabled={disabled}
      id={id}
      name={name}
      options={options}
      title={title}
      triggerClassName={className}
      value={resolvedValue}
      onValueChange={(next) => {
        if (!onChange) return;
        const target = {
          value: next,
          name: name ?? "",
        } as HTMLSelectElement;
        onChange({
          target,
          currentTarget: target,
        } as ChangeEvent<HTMLSelectElement>);
      }}
    />
  );
}
