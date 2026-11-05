"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { safeStorage, track } from "./analytics";

/**
 * Freemium test (no payments). Free = map + FREE_SLOT. Pro = all slots, ranking, CSV export.
 * "Preview" unlocks Pro for this browser during user testing; we count clicks to measure interest.
 */
interface ProCtx {
  preview: boolean;
  gateOpen: string | null; // feature that triggered the modal
  requestPro: (feature: string) => boolean; // returns true if allowed
  openGate: (feature: string) => void; // always opens the Pro modal (interest button)
  closeGate: () => void;
  enablePreview: () => void;
}
const Ctx = createContext<ProCtx | null>(null);
const KEY = "tsg_pro_preview";

export function ProProvider({ children }: { children: React.ReactNode }) {
  const [preview, setPreview] = useState(false);
  const [gateOpen, setGateOpen] = useState<string | null>(null);
  useEffect(() => setPreview(safeStorage().get(KEY) === "1"), []);

  const requestPro = useCallback(
    (feature: string) => {
      if (preview) return true;
      track("pro_click", { feature });
      setGateOpen(feature);
      return false;
    },
    [preview],
  );
  const openGate = useCallback((feature: string) => {
    track("pro_click", { feature });
    setGateOpen(feature);
  }, []);
  const enablePreview = useCallback(() => {
    safeStorage().set(KEY, "1");
    setPreview(true);
    track("pro_preview", { feature: gateOpen ?? "" });
    setGateOpen(null);
  }, [gateOpen]);

  return (
    <Ctx.Provider value={{ preview, gateOpen, requestPro, openGate, closeGate: () => setGateOpen(null), enablePreview }}>
      {children}
    </Ctx.Provider>
  );
}

export function usePro() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePro outside provider");
  return c;
}
