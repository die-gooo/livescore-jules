import Scoreboard from '@/components/Scoreboard';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <h1 className="text-4xl font-bold mb-8">Live Scoreboard</h1>
      <Scoreboard />
    </main>
  );
}
