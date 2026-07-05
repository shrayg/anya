export const STAFF_ROLES = ["admin", "mod", "developer", "helper"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export type StaffRoleMeta = {
  id: StaffRole;
  label: string;
  description: string;
  badgeClass: string;
  dotClass: string;
  avatarRingClass: string;
};

export const STAFF_ROLE_META: Record<StaffRole, StaffRoleMeta> = {
  admin: {
    id: "admin",
    label: "Admin",
    description: "Full workspace admin dashboard in Settings",
    badgeClass:
      "border-rose-400/45 bg-gradient-to-r from-rose-500/20 to-red-600/10 text-rose-100 shadow-[0_0_12px_rgba(244,63,94,0.15)]",
    dotClass: "bg-rose-400",
    avatarRingClass: "ring-rose-400/50",
  },
  mod: {
    id: "mod",
    label: "Mod",
    description: "Moderation staff — display badge only",
    badgeClass:
      "border-sky-400/45 bg-gradient-to-r from-sky-500/20 to-blue-600/10 text-sky-100 shadow-[0_0_12px_rgba(56,189,248,0.12)]",
    dotClass: "bg-sky-400",
    avatarRingClass: "ring-sky-400/50",
  },
  developer: {
    id: "developer",
    label: "Developer",
    description: "Development staff — display badge only",
    badgeClass:
      "border-violet-400/45 bg-gradient-to-r from-violet-500/20 to-purple-600/10 text-violet-100 shadow-[0_0_12px_rgba(167,139,250,0.12)]",
    dotClass: "bg-violet-400",
    avatarRingClass: "ring-violet-400/50",
  },
  helper: {
    id: "helper",
    label: "Helper",
    description: "Support staff — display badge only",
    badgeClass:
      "border-emerald-400/45 bg-gradient-to-r from-emerald-500/20 to-teal-600/10 text-emerald-100 shadow-[0_0_12px_rgba(52,211,153,0.12)]",
    dotClass: "bg-emerald-400",
    avatarRingClass: "ring-emerald-400/50",
  },
};

export function parseStaffRole(value: string | null | undefined): StaffRole | null {
  if (!value) return null;

  return STAFF_ROLES.includes(value as StaffRole) ? (value as StaffRole) : null;
}

export function getStaffRoleMeta(
  value: string | null | undefined,
): StaffRoleMeta | null {
  const role = parseStaffRole(value);

  return role ? STAFF_ROLE_META[role] : null;
}
