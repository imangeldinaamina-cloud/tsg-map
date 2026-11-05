import { Suspense } from "react";
import { MapExplorer } from "./MapExplorer";

export default function MapPage() {
  return (
    <Suspense>
      <MapExplorer />
    </Suspense>
  );
}
