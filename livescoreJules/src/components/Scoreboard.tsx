"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Match = {
  id: string;
  round: string | null;
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
  const [selectedRound, setSelectedRound] = useState<string | "all">("all");

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

  const computeBadgeFromScores = (
    prev: { home_score: number; away_score: number } | undefined,
    next: { home_score: number; away_score: number }
  ): { text: string; color: string } | null => {
    if (!prev) return null;
    if (prev.home_score === next.home_score && prev.away_score === next.away_score) {
      return null;
    }
    if (next.home_score === 0 && next.away_score === 0) {
      return { text: "Reset", color: "bg-slate-500" };
    }
    return { text: "GOAL", color: "bg-emerald-500" };
  };

  useEffect(() => {
    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from("matches")
        .select(`
          id,
          round,
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
          round: m.round ?? null,
          home_score: m.home_score ?? 0,
          away_score: m.away_score ?? 0,
          status: m.status ?? "in programma",
          start_time: m.start_time ?? null,
          competition: m.competition ?? { name: "" },
          home_team: m.home_team ?? { name: "", logo_url: null },
          away_team: m.away_team ?? { name: "", logo_url: null },
        }));

        let localBadge: { id: string; text: string; color: string } | null = null;

        processed.forEach((newMatch) => {
          const prev = matchesRef.current.find((m) => m.id === newMatch.id);
          const badgeInfo = computeBadgeFromScores(prev, {
            home_score: newMatch.home_score,
            away_score: newMatch.away_score,
          });
          if (badgeInfo) {
            localBadge = { id: newMatch.id, ...badgeInfo };
          }
        });

        setMatches(processed);

        if (localBadge) {
          setBadge(localBadge);
          setTimeout(() => setBadge(null), 6000);
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
            const nextMatches = prev.map((match) =>
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
            const badgeInfo = computeBadgeFromScores(prevMatch, {
              home_score: payload.new.home_score,
              away_score: payload.new.away_score,
            });

            if (badgeInfo) {
              setBadge({ id: updatedId, ...badgeInfo });
              setTimeout(() => setBadge(null), 6000);
            }

            matchesRef.current = nextMatches;
            return nextMatches;
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

  // calcolo giornate uniche
  const rounds = Array.from(
    new Set(matches.map((m) => m.round).filter((r): r is string => !!r))
  ).sort((a, b) => parseInt(a) - parseInt(b));

  const visibleMatches =
    selectedRound === "all"
      ? matches
      : matches.filter((m) => m.round === selectedRound);

  return (
    <main className="min-h-screen bg-[#050816] text-white">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 flex flex-col gap-4">
        {/* HEADER */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400">
              <span className="text-2xl">🏆</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                Live scoreboard
              </span>
              <h1 className="text-xl sm:text-2xl font-semibold leading-tight">
                Grand Championship
              </h1>
            </div>
          </div>
        </header>

        {/* FILTRO GIORNATE */}
        <section className="flex flex-col gap-2">
          <span className="text-xs text-slate-400 mb-1">
            Filtra per giornata
          </span>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setSelectedRound("all")}
              className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium border ${
                selectedRound === "all"
                  ? "bg-sky-500 text-white border-sky-500"
                  : "bg-transparent text-slate-300 border-slate-600"
              }`}
            >
              Tutte
            </button>
            {rounds.map((round) => (
              <button
                key={round}
                onClick={() => setSelectedRound(round)}
                className={`whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium border ${
                  selectedRound === round
                    ? "bg-sky-500 text-white border-sky-500"
                    : "bg-transparent text-slate-300 border-slate-600"
                }`}
              >
                Giornata {round}
              </button>
            ))}
          </div>
        </section>

        {/* LISTA MATCH */}
        <section className="flex-1 space-y-4">
          {visibleMatches.length === 0 ? (
            <p className="text-center text-sm text-slate-400">
              Nessuna partita trovata per questa giornata.
            </p>
          ) : (
            visibleMatches.map((match) => (
              <article
                key={match.id}
                className="relative mx-auto w-full max-w-md sm:max-w-lg md:max-w-2xl rounded-2xl bg-[#0b1015] border border-slate-800/70 p-4 sm:p-5 shadow-sm"
              >
                {badge && badge.id === match.id && (
                  <span
                    className={`absolute -top-2 right-4 rounded-full px-3 py-1 text-[11px] font-bold text-white shadow-md animate-pulse ${badge.color}`}
                  >
                    {badge.text}
                  </span>
                )}

                <div className="flex items-center justify-between gap-3 mb-3">
                  <div className="flex flex-col">
                    <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wide">
                      {match.competition.name || "Match"} •{" "}
                      {match.round ? `Giornata ${match.round}` : ""}
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

                <div className="flex items-center gap-4">
                  <div className="flex w-1/3 flex-col items-end gap-1 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-sm font-semibold text-slate-50 line-clamp-1">
                        {match.home_team.name}
                      </span>
                      {match.home_team.logo_url && (
                        <img
                          src={match.home_team.logo_url}
                          alt={match.home_team.name}
                          className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-[#050816] object-contain border border-slate-800"
                        />
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400">Home</span>
                  </div>

                  <div className="flex w-1/3 flex-col items-center gap-1">
                    <p className="text-3xl font-extrabold tracking-tight tabular-nums text-slate-50">
                      {match.home_score}
                      <span className="mx-1 text-2xl text-slate-500">-</span>
                      {match.away_score}
                    </p>
                  </div>

                  <div className="flex w-1/3 flex-col items-start gap-1 text-left">
                    <div className="flex items-center justify-start gap-2">
                      {match.away_team.logo_url && (
                        <img
                          src={match.away_team.logo_url}
                          alt={match.away_team.name}
                          className="h-8 w-8 sm:h-9 sm:w-9 rounded-full bg-[#050816] object-contain border border-slate-800"
                        />
                      )}
                      <span className="text-sm font-semibold text-slate-50 line-clamp-1">
                        {match.away_team.name}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400">Away</span>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
