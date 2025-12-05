import Scoreboard from "@/components/Scoreboard";
import ErrorBoundary from "@/components/ErrorBoundary";

export default function HomePage() {
  return (
    <ErrorBoundary>
      <Scoreboard />
    </ErrorBoundary>
  );
}
