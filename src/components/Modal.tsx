"use client";
import { useEffect, useRef } from "react";

/** Native <dialog>: focus trap, Esc to close and backdrop come from the browser. */
export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="modal-title"
      className="m-auto w-[min(92vw,28rem)] rounded-xl p-0 backdrop:bg-black/50"
    >
      <div className="p-5">
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 id="modal-title" className="text-lg font-bold">{title}</h2>
          <button type="button" onClick={onClose} className="btn btn-secondary min-h-[36px] px-3 py-1" aria-label="×">
            ×
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
