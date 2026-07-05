import clsx from "clsx";

import {
  getStaffRoleMeta,
  type StaffRole,
  STAFF_ROLE_META,
} from "@/lib/staff-roles";

export function StaffBadge({
  role,
  size = "sm",
  className,
}: {
  role: StaffRole | string | null | undefined;
  size?: "xs" | "sm" | "md";
  className?: string;
}) {
  const meta = getStaffRoleMeta(role);

  if (!meta) return null;

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border font-semibold uppercase tracking-[0.14em]",
        meta.badgeClass,
        size === "xs" && "px-2 py-0.5 text-[9px]",
        size === "sm" && "px-2.5 py-0.5 text-[10px]",
        size === "md" && "px-3 py-1 text-[11px]",
        className,
      )}
      title={meta.description}
    >
      <span className={clsx("size-1.5 shrink-0 rounded-full", meta.dotClass)} />
      {meta.label}
    </span>
  );
}

export function StaffRolePicker({
  value,
  onChange,
  disabled,
}: {
  value: StaffRole | null;
  onChange: (role: StaffRole | null) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className="dash-select w-full min-w-[8.5rem] text-xs"
      disabled={disabled}
      onChange={(event) => {
        const next = event.target.value;

        onChange(next ? (next as StaffRole) : null);
      }}
      value={value ?? ""}
    >
      <option value="">No staff badge</option>
      {Object.values(STAFF_ROLE_META).map((role) => (
        <option key={role.id} value={role.id}>
          {role.label}
        </option>
      ))}
    </select>
  );
}
