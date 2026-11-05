import { Suspense } from "react";
import { RankingView } from "./RankingView";

export default function RankingPage() {
  return (
    <Suspense>
      <RankingView />
    </Suspense>
  );
}
