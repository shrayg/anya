"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type PricingModalProps = {
  open: boolean;
  onClose: () => void;
};

/** Legacy modal — redirects to the dedicated /pricing page. */
export function PricingModal({ open, onClose }: PricingModalProps) {
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    onClose();
    router.push("/pricing");
  }, [open, onClose, router]);

  return null;
}
