"use client";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useI18n } from "@/i18n/client";
import { track } from "@/lib/client/analytics";
import { Modal } from "./Modal";

export function FeedbackWidget() {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error" | "need">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) return setState("need");
    setState("sending");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment, page: pathname, locale }),
    }).catch(() => null);
    if (res?.ok) {
      track("feedback_submit", { rating });
      setState("done");
      setRating(null);
      setComment("");
    } else setState("error");
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setState("idle");
        }}
        className="btn btn-primary fixed bottom-4 right-4 z-40 shadow-lg"
      >
        ★ {t("feedback.open")}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("feedback.title")}>
        {state === "done" ? (
          <p role="status" className="py-4">{t("feedback.thanks")}</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">{t("feedback.rating")}</legend>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <label key={n} className="cursor-pointer">
                    <input type="radio" name="rating" value={n} checked={rating === n} onChange={() => setRating(n)} className="peer sr-only" />
                    <span
                      aria-label={t("feedback.ratingN", { n })}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-lg font-bold peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-fg peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-[var(--focus)]"
                    >
                      {n}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="text-sm font-medium">{t("feedback.comment")}</span>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                maxLength={1000}
                rows={3}
                className="mt-1 w-full rounded-md border border-border p-2"
                aria-describedby="fb-hint"
              />
              <span id="fb-hint" className="text-xs text-muted">{t("feedback.commentHint")}</span>
            </label>
            {state === "need" && <p role="alert" className="text-sm font-medium text-demo-fg">{t("feedback.needRating")}</p>}
            {state === "error" && <p role="alert" className="text-sm font-medium text-demo-fg">{t("common.error")}</p>}
            <button type="submit" className="btn btn-primary w-full" disabled={state === "sending"}>
              {t("feedback.send")}
            </button>
          </form>
        )}
      </Modal>
    </>
  );
}
