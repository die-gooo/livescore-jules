"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Match = {
  id: string;
  start_time: string | null;
  status: string;
  home_score: number;
  away_score: number;
  home_team: { name: string; logo_url: string | null };
  away_team: { name: string; logo_url: string | null };
};

export default function HomePage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Carica i match iniziali
  const loadMatches = async () => {
    const { data, error } = await supabase
      .from("matches")
      .select(
        `
        id,
        start_time,
        status,
        home_score,
        away_score,
        home_team:teams!matches_home_team_id_fkey (name, logo_url),
        away_team:teams!matches_away_team_id_fkey (name, logo_url)
      `
      )
      .order("start_time", { ascending: true });

    if (!error && data) {
      const formatted = data.map((raw: any) => {
        const home = Array.isArray(raw.home_team)
          ? raw.home_team[0]
          : raw.home_team;
        const away = Array.isArray(raw.away_team)
          ? raw.away_team[0]
          : raw.away_team;

        return {
          ...raw,
          home_team: home ?? { name: "", logo_url: null },
          away_team: away ?? { name: "", logo_url: null },
        };
      });

      setMatches(formatted);
    }

    setLoading(false);
  };

  // 2. Ascolta aggiornamenti realtime su tutta la tabella matches
  useEffect(() => {
    loadMatches();

    const channel = supabase
      .channel("realtime-matches")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "matches",
        },
        async () => {
          // ricarica i match ogni volta che la tabella cambia
          loadMatches();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) return <p>Carico le partite...</p>;

  return (
    <main className="min-h-screen text-white bg-[#0b1016] px-4 py-8">
      <h1 className="text-2xl mb-6">Risultati in tempo reale</h1>

      <div className="grid gap-4">
        {matches.map((m) => (
          <div key={m.id} className="bg-[#141b23] p-4 rounded-xl">
            <div className="flex justify-between text-lg font-semibold">
              <span>{m.home_team.name}</span>
              <span>
                {m.home_score} - {m.away_score}
              </span>
              <span>{m.away_team.name}</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">{m.status}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
