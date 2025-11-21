"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Match = {
  id: string;
  home_score: number;
  away_score: number;
  status: string;
  start_time: string | null;
  competition: { name: string };
  home_team: { name: string; logo_url: string | null };
  away_team: { name: string; logo_url: string | null };
};

export default function Scoreboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [badge, setBadge] = useState<{ id: string; text: string; color: string } | null>(null);
  const matchesRef = useRef<Match[]>(matches);

  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);

  const getStatusColorClass = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("live")) return "text-amber-400";
    if (s === "halftime") return "text-orange-400";
    if (s === "final") return "text-red-400";
    if (s === "sospesa") return "text-purple-300";
    if (s === "rinviata") return "text-gray-400";
    if (s === "in programma" || s === "scheduled") return "text-sky-400";
    return "text-gray-400";
  };

  const formatStartTime = (start: string | null) => {
    if (!start) return "";
    const d = new Date(start);
    if (isNaN(d.getTime())) return "";
    const time = d.toLocaleTimeString("it-IT", {
      timeZone: "Europe/Rome",
      hour: "2-digit",
      minute: "2-digit",
    });
    const date = d.toLocaleDateString("it-IT", {
      timeZone: "Europe/Rome",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    return `ore ${time} – ${date}`;
  };

  useEffect(() => {
    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from("matches")
        .select(`
          id,
          start_time,
          status,
          home_score,
          away_score,
          competition:competitions (name),
          home_team:teams!matches_home_team_id_fkey (name, logo_url),
          away_team:teams!matches_away_team_id_fkey (name, logo_url)
        `)
        .order("start_time", { ascending: true });

      if (error) {
        console.error("Error fetching matches:", error);
        setLoading(false);
        return;
      }

      if (data) {
        const processed: Match[] = (data as any[]).map((m) => ({
          id: String(m.id),
          home_score: m.home_score ?? 0,
          away_score: m.away_score ?? 0,
          status: m.status ?? "in programma",
          start_time: m.start_time ?? null,
          competition: m.competition ?? { name: "" },
          home_team: m.home_team ?? { name: "", logo_url: null },
          away_team: m.away_team ?? { name: "", logo_url: null },
        }));

        // rileva GOAL rispetto allo stato precedente
        let goalBadge: { id: string; text: string; color: string } | null = null;
        processed.forEach((newMatch) => {
          const prev = matchesRef.current.find((m) => m.id === newMatch.id);
          if (
            prev &&
            (prev.home_score !== newMatch.home_score ||
              prev.away_score !== newMatch.away_score)
          ) {
            goalBadge = { id: newMatch.id, text: "GOAL", color: "bg-emerald-500" };
          }
        });

        setMatches(processed);
        if (goalBadge) {
          setBadge(goalBadge);
          setTimeout(() => setBadge(null), 3000);
        }
      }

      setLoading(false);
    };

    fetchMatches();

    const channel = supabase
      .channel("realtime-matches")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "matches" },
        (payload) => {
          const updatedId = String(payload.new.id);
          setMatches((prev) => {
            const next = prev.map((match) =>
              match.id === updatedId
                ? {
                    ...match,
                    home_score: payload.new.home_score,
                    away_score: payload.new.away_score,
                    status: payload.new.status,
                  }
                : match
            );

            const prevMatch = prev.find((m) => m.id === updatedId);
            if (
              prevMatch &&
              (prevMatch.home_score !== payload.new.home_score ||
                prevMatch.away_score !== payload.new.away_score)
            ) {
              setBadge({ id: updatedId, text: "GOAL", color: "bg-emerald-500" });
              setTimeout(() => setBadge(null), 3000);
            }

            matchesRef.current = next;
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#050816] text-slate-300">
        <span className="text-sm">Caricamento partite...</span>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#050816] text-white flex flex-col">
      {/* HEADER */}
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-gradient-to-b from-[#050816] to-[#050816]/95">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
              <span className="text-2xl">🏆</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Live Scoreboard
              </span>
              <h1 className="text-base font-semibold leading-tight">
                Grand Championship
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* LISTA MATCH */}
      <section className="flex-1 mx-auto w-full max-w-5xl px-4 py-4 space-y-4">
        {matches.length === 0 ? (
          <p className="text-center text-sm text-slate-400">
            Nessuna partita in programma.
          </p>
        ) : (
          matches.map((match) => (
            <article
              key={match.id}
              className="relative flex flex-col gap-3 rounded-2xl bg-[#0b1015] border border-slate-800/70 p-4 shadow-sm"
            >
              {/* Badge GOAL */}
              {badge && badge.id === match.id && (
                <span className="absolute -top-2 right-4 rounded-full px-3 py-1 text-[11px] font-bold text-white shadow-md animate-pulse bg-emerald-500">
                  {badge.text}
                </span>
              )}

              {/* Riga stato + competizione */}
              <div className="flex items-center justify-between gap-3">
                <div className="flex flex-col">
                  <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
                    {match.competition.name || "Match"}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    {formatStartTime(match.start_time)}
                  </span>
                </div>
                <div
                  className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${getStatusColorClass(
                    match.status
                  )} border-slate-700 bg-slate-900/60`}
                >
                  {match.status}
                </div>
              </div>

              {/* Riga principale: Home – score – Away */}
              <div className="flex items-center gap-4">
                {/* Home */}
                <div className="flex w-1/3 flex-col items-end gap-1 text-right">
                  <span className="text-sm font-semibold text-slate-50 line-clamp-1">
                    {match.home_team.name}
                  </span>
                  <span className="text-[11px] text-slate-400">Home</span>
                </div>

                {/* Score */}
                <div className="flex w-1/3 flex-col items-center gap-1">
                  <p className="text-3xl font-extrabold tracking-tight tabular-nums text-slate-50">
                    {match.home_score}
                    <span className="mx-1 text-2xl text-slate-500">-</span>
                    {match.away_score}
                  </p>
                </div>

                {/* Away */}
                <div className="flex w-1/3 flex-col items-start gap-1 text-left">
                  <span className="text-sm font-semibold text-slate-50 line-clamp-1">
                    {match.away_team.name}
                  </span>
                  <span className="text-[11px] text-slate-400">Away</span>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
