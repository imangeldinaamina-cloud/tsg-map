import type { Metadata } from "next";
import { AdminView } from "./AdminView";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function AdminPage() {
  return <AdminView />;
}
