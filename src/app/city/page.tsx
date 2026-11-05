import { Suspense } from "react";
import { CityApp } from "./CityApp";

export default function CityPage() {
  return (
    <Suspense>
      <CityApp />
    </Suspense>
  );
}
