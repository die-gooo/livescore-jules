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
  const [selectedRound, setSelectedRound] = useState<string | null>(null);

  const matchesRef = useRef<Match[]>(matches);

  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);

  const formatStartTime = (start: string | null) => {
    if (!start) return null;
    const d = new Date(start);
    if (isNaN(d.getTime())) return null;
    const time = d.toLocaleTimeString("it-IT", {
      timeZone: "Europe/Rome",
      hour: "2-digit",
      minute: "2-digit",
    });
    const date = d.toLocaleDateString("it-IT", {
      timeZone: "Europe/Rome",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
    return { time, date };
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

  const getStatusPill = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes("live") || s === "halftime" || s.includes("1t") || s.includes("2t")) {
      return {
        label: s === "halftime" ? "Halftime" : "Live",
        className: "bg-red-500/10 text-red-500",
        dot: true,
      };
    }
    if (s === "final" || s === "ft") {
      return {
        label: "FT",
        className: "bg-sky-500/10 text-sky-400",
        dot: false,
      };
    }
    return {
      label: status || "Scheduled",
      className: "bg-gray-500/10 text-gray-400",
      dot: false,
    };
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

        // set giornata di default alla prima disponibile
        const allRounds = Array.from(
          new Set(
            processed
              .map((m) => m.round)
              .filter((r): r is string => !!r)
          )
        ).sort((a, b) => parseInt(a) - parseInt(b));

        if (!selectedRound && allRounds.length > 0) {
          setSelectedRound(allRounds[0]);
        }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#101922] text-slate-300">
        <span className="text-sm">Caricamento partite...</span>
      </main>
    );
  }

  // giornate disponibili
  const rounds = Array.from(
    new Set(
      matches
        .map((m) => m.round)
        .filter((r): r is string => !!r)
    )
  ).sort((a, b) => parseInt(a) - parseInt(b));

  const currentRoundIndex = selectedRound ? rounds.indexOf(selectedRound) : -1;

  const visibleMatches =
    selectedRound && currentRoundIndex !== -1
      ? matches.filter((m) => m.round === selectedRound)
      : matches;

  const roundDate = (() => {
    const dates = visibleMatches
      .map((m) => (m.start_time ? new Date(m.start_time) : null))
      .filter((d): d is Date => !!d && !isNaN(d.getTime()));
    if (dates.length === 0) return "";
    const first = dates.reduce((min, d) => (d < min ? d : min), dates[0]);
    return first.toLocaleDateString("it-IT", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  })();

  const competitionName =
    visibleMatches[0]?.competition.name || matches[0]?.competition.name || "Live Scoreboard";

  const handlePrevRound = () => {
    if (currentRoundIndex > 0) {
      setSelectedRound(rounds[currentRoundIndex - 1]);
    }
  };

  const handleNextRound = () => {
    if (currentRoundIndex !== -1 && currentRoundIndex < rounds.length - 1) {
      setSelectedRound(rounds[currentRoundIndex + 1]);
    }
  };

  return (
    <main className="min-h-screen bg-[#101922] text-gray-200">
      <div className="relative flex min-h-screen w-full flex-col">
        {/* HEADER STICKY */}
        <header className="sticky top-0 z-10 border-b border-gray-800 bg-[#101922]/80 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center p-4">
            <div className="text-sky-400 flex size-10 shrink-0 items-center justify-center">
              <span className="text-3xl">🏆</span>
            </div>
            <h1 className="ml-2 text-xl font-bold leading-tight tracking-tight text-white">
              {competitionName}
            </h1>
          </div>
          <div className="mx-auto max-w-5xl">
            <div className="flex items-center justify-between border-t border-gray-800 px-4 py-3">
              <button
                onClick={handlePrevRound}
                disabled={currentRoundIndex <= 0}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800/70 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-gray-800 transition-colors"
              >
                ‹
              </button>
              <div className="flex flex-col items-center">
                <h2 className="text-lg font-semibold text-white">
                  {selectedRound ? Giornata ${selectedRound} : "Tutte le partite"}
                </h2>
                {roundDate && (
                  <p className="text-xs text-gray-400">
                    {roundDate}
                  </p>
                )}
              </div>
              <button
                onClick={handleNextRound}
                disabled={currentRoundIndex === -1 || currentRoundIndex >= rounds.length - 1}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-800/70 text-gray-300 hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-gray-800 transition-colors"
              >
                ›
              </button>
            </div>
          </div>
        </header>

        {/* LISTA PARTITE DELLA GIORNATA */}
        <main className="mx-auto w-full max-w-5xl flex-1 p-4 md:p-6">
          {visibleMatches.length === 0 ? (
            <p className="text-center text-sm text-gray-400">
              Nessuna partita trovata per questa giornata.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {visibleMatches.map((match) => {
                const timeInfo = formatStartTime(match.start_time);
                const statusPill = getStatusPill(match.status);

                return (
                  <div
                    key={match.id}
                    className="relative flex items-center gap-4 rounded-xl bg-[#121925] p-4 shadow-sm transition-shadow hover:shadow-lg"
                  >
                    {/* Badge GOAL / Reset */}
                    {badge && badge.id === match.id && (
                      <span
                        className={absolute -top-2 right-3 rounded-full px-3 py-1 text-[11px] font-bold text-white shadow-md animate-pulse ${badge.color}}
                      >
                        {badge.text}
                      </span>
                    )}

                    {/* Home */}
                    <div className="flex w-1/3 flex-col items-end gap-2 text-right">
                      <span className="text-base font-semibold text-white line-clamp-1">
                        {match.home_team.name}
                      </span>
                      <span className="text-xs text-gray-400">Home</span>
                    </div>

                    {/* Center */}
                    <div className="flex w-1/3 flex-col items-center justify-center gap-2">
                      <div
                        className={flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${statusPill.className}}
                      >
                        {statusPill.dot && (
                          <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                        )}
                        {statusPill.label}
                      </div>
                      <p className="text-4xl font-bold tracking-tighter text-white">
                        {match.home_score}{" "}
                        <span className="mx-1 text-3xl text-gray-400">-</span>
                        {match.away_score}
                      </p>
                      <span className="text-xs text-gray-400">
                        {timeInfo ? ${timeInfo.time} • ${timeInfo.date} : ""}
                      </span>
                    </div>

                    {/* Away */}
                    <div className="flex w-1/3 flex-col items-start gap-2 text-left">
                      <span className="text-base font-semibold text-white line-clamp-1">
                        {match.away_team.name}
                      </span>
                      <span className="text-xs text-gray-400">Away</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </main>
  );
}
