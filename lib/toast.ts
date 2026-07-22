import { toast as sonnerToast } from "sonner";

/** Site-wide toast API — always prefer this over ad-hoc alerts. */
export const toast = sonnerToast;

export function toastUpgradePanel() {
  toast.message("Upgrade to unlock the panel", {
    description: "Professional and higher plans include Panel access.",
    action: {
      label: "View plans",
      onClick: () => {
        window.location.href = "/pricing";
      },
    },
  });
}

export function toastSignInForPanel() {
  toast.message("Sign in to unlock the panel", {
    description: "Log in with a Professional+ plan to open Panel.",
    action: {
      label: "Log in",
      onClick: () => {
        window.location.href = "/auth?action=login";
      },
    },
  });
}
