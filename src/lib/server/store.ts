import "server-only";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Observation } from "@/lib/domain";

/**
 * Storage adapter.
 * - "supabase": SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set (production).
 * - "local": JSON files in ./.data — development only, for running without accounts.
 */
export type StorageMode = "supabase" | "local" | "disabled";

export function storageMode(): StorageMode {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
  if (process.env.NODE_ENV !== "production") return "local";
  return "disabled";
}

let admin: SupabaseClient | null = null;
export function supabaseAdmin(): SupabaseClient {
  if (!admin) {
    admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    });
  }
  return admin;
}

const DATA_DIR = path.join(process.cwd(), ".data");
async function readLocal<T>(name: string): Promise<T[]> {
  try {
    return JSON.parse(await fs.readFile(path.join(DATA_DIR, name + ".json"), "utf8"));
  } catch {
    return [];
  }
}
async function writeLocal<T>(name: string, rows: T[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(path.join(DATA_DIR, name + ".json"), JSON.stringify(rows, null, 1));
}
async function appendLocal<T>(name: string, row: T) {
  const rows = await readLocal<T>(name);
  rows.push(row);
  await writeLocal(name, rows);
}

function assertEnabled() {
  if (storageMode() === "disabled") throw new Error("Storage is not configured (set Supabase env vars)");
}

// ---------- observations (real measured data) ----------

export interface StoredObservation extends Observation {
  imported_at: string;
}

export async function listObservations(): Promise<StoredObservation[]> {
  const mode = storageMode();
  if (mode === "disabled") return [];
  if (mode === "local") return readLocal<StoredObservation>("observations");
  const { data, error } = await supabaseAdmin()
    .from("observations")
    .select("point_id,point_type,lat,lon,date,time_start,slot,frames,mean_people_per_frame,holdout,imported_at")
    .limit(10000);
  if (error) throw error;
  return data as StoredObservation[];
}

/** Insert or update by (point_id, date, slot). `replace` wipes existing rows first. */
export async function saveObservations(rows: Observation[], replace: boolean): Promise<number> {
  assertEnabled();
  const imported_at = new Date().toISOString();
  const stamped = rows.map((r) => ({ ...r, imported_at }));
  if (storageMode() === "local") {
    const existing = replace ? [] : await readLocal<StoredObservation>("observations");
    const key = (o: Observation) => `${o.point_id}|${o.date}|${o.slot}`;
    const map = new Map(existing.map((o) => [key(o), o]));
    for (const r of stamped) map.set(key(r), r);
    await writeLocal("observations", [...map.values()]);
    return stamped.length;
  }
  const sb = supabaseAdmin();
  if (replace) {
    const { error } = await sb.from("observations").delete().neq("point_id", "");
    if (error) throw error;
  }
  const { error } = await sb.from("observations").upsert(stamped, { onConflict: "point_id,date,slot" });
  if (error) throw error;
  return stamped.length;
}

// ---------- feedback / events / waitlist ----------

export interface FeedbackRow {
  created_at: string;
  page: string;
  rating: number;
  comment: string | null;
  locale: string;
}
export interface EventRow {
  created_at: string;
  type: string;
  path: string | null;
  props: Record<string, string | number | boolean> | null;
}
export interface WaitlistRow {
  created_at: string;
  email: string;
  consent: boolean;
  consent_version: string;
  source: string;
  locale: string;
}

async function insert(table: "feedback" | "events" | "waitlist", row: object) {
  assertEnabled();
  if (storageMode() === "local") return appendLocal(table, row);
  const { error } = await supabaseAdmin().from(table).insert(row);
  if (error) throw error;
}

export const insertFeedback = (r: FeedbackRow) => insert("feedback", r);
export const insertEvent = (r: EventRow) => insert("events", r);

/** Returns false if the email is already on the list. */
export async function insertWaitlist(r: WaitlistRow): Promise<boolean> {
  assertEnabled();
  if (storageMode() === "local") {
    const rows = await readLocal<WaitlistRow>("waitlist");
    if (rows.some((x) => x.email === r.email && x.source === r.source)) return false;
    await appendLocal("waitlist", r);
    return true;
  }
  const { error } = await supabaseAdmin().from("waitlist").insert(r);
  if (error?.code === "23505") return false; // unique violation
  if (error) throw error;
  return true;
}

async function listAll<T>(table: string): Promise<T[]> {
  if (storageMode() === "disabled") return [];
  if (storageMode() === "local") return readLocal<T>(table);
  const { data, error } = await supabaseAdmin().from(table).select("*").order("created_at", { ascending: false }).limit(5000);
  if (error) throw error;
  return data as T[];
}

export const listFeedback = () => listAll<FeedbackRow>("feedback");
export const listEvents = () => listAll<EventRow>("events");
export const listWaitlist = () => listAll<WaitlistRow>("waitlist");
