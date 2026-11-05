import "server-only";
import { storageMode, supabaseAdmin } from "./store";

/**
 * Admin check.
 * - Supabase mode: the request must carry a Supabase access token (Bearer) of a user
 *   whose email is listed in ADMIN_EMAILS (comma-separated).
 * - Local mode (development only): no auth, so the importer can be tested without accounts.
 */
export async function isAdmin(req: Request): Promise<boolean> {
  const mode = storageMode();
  if (mode === "local") return true;
  if (mode === "disabled") return false;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user?.email) return false;
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(data.user.email.toLowerCase());
}
