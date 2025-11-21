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
    if (s.indexOf("live") !== -1 || s === "halftime" || s.indexOf("1t") !== -1 || s.indexOf("2t") !== -1) {
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
    if (s === "in programma" || s === "scheduled") {
      return {
        label: "In programma",
        className: "bg-gray-500/10 text-gray-300",
        dot: false,
      };
    }
    return {
      label: status || "Altro",
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

        const roundDates: { [round: string]: Date } = {};
        processed.forEach((m) => {
          if (!m.round || !m.start_time) return;
          const d = new Date(m.start_time);
          if (isNaN(d.getTime())) return;
          if (!roundDates[m.round] || d < roundDates[m.round]) {
            roundDates[m.round] = d;
          }
        });

        const allRounds = Object.keys(roundDates).sort((a, b) => {
          const da = roundDates[a].getTime();
          const db = roundDates[b].getTime();
          return da - db;
        });

        if (!selectedRound && allRounds.length > 0) {
          const today = new Date();
          let chosen = allRounds[allRounds.length - 1];
          for (let i = 0; i < allRounds.length; i++) {
            const r = allRounds[i];
            const d = roundDates[r];
            if (d >= today) {
              chosen = r;
              break;
            }
          }
          setSelectedRound(chosen);
        }

        let localBadge: { id: string; text: string; color: string } | null = null;

        processed.forEach((newMatch) => {
          const prev = matchesRef.current.find((m) => m.id === newMatch.id);
          const badgeInfo = computeBadgeFromScores(prev, {
            home_score: newMatch.home_score,
            away_score: newMatch.away_score,
          });
          if (badgeInfo) {
            localBadge = { id: newMatch.id, text: badgeInfo.text, color: badgeInfo.color };
          }
        });

        setMatches(processed);

        if (localBadge) {
          setBadge(localBadge);
          setTimeout(function () {
            setBadge(null);
          }, 6000);
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
              setBadge({ id: updatedId, text: badgeInfo.text, color: badgeInfo.color });
              setTimeout(function () {
                setBadge(null);
              }, 6000);
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
    (visibleMatches[0] && visibleMatches[0].competition.name) ||
    (matches[0] && matches[0].competition.name) ||
    "Live Scoreboard";

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

  const roundLabel = (() => {
    if (!selectedRound) return "Tutte le partite";
    const lower = selectedRound.toLowerCase();
    if (lower.indexOf("giornata") !== -1) return selectedRound;
    return "Giornata " + selectedRound;
  })();

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
                  {roundLabel}
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
                    className="relative rounded-xl bg-[#121925] p-4 shadow-sm transition-shadow hover:shadow-lg"
                  >
                    {/* Badge GOAL / Reset */}
                    {badge && badge.id === match.id && (
                      <span
                        className={
                          "absolute -top-2 right-3 rounded-full px-3 py-1 text-[11px] font-bold text-white shadow-md animate-pulse " +
                          badge.color
                        }
                      >
                        {badge.text}
                      </span>
                    )}

                    {/* Riga 1: status */}
                    <div className="flex justify-center mb-2">
                      <div
                        className={
                          "flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider " +
                          statusPill.className
                        }
                      >
                        {statusPill.dot && (
                          <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                        )}
                        {statusPill.label}
                      </div>
                    </div>

                    {/* Riga 2: tempo e data */}
                    <div className="flex justify-center mb-3">
                      <span className="text-xs text-gray-400">
                        {timeInfo ? timeInfo.time + " • " + timeInfo.date : ""}
                      </span>
                    </div>

                    {/* Riga 3: squadre + punteggio */}
                    <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
                      {/* Home */}
                      <div className="flex items-center gap-2 sm:w-1/3">
                        {match.home_team.logo_url && (
                          <img
                            src={match.home_team.logo_url}
                            alt={match.home_team.name}
                            className="h-8 w-8 rounded-full bg-[#050816] object-contain border border-slate-800"
                          />
                        )}
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-white">
                            {match.home_team.name}
                          </span>
                          <span className="text-xs text-gray-400">Home</span>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="flex flex-col items-center justify-center sm:w-1/3">
                        <p className="text-3xl font-bold tracking-tighter text-white">
                          {match.home_score}
                          <span className="mx-1 text-2xl text-gray-400">-</span>
                          {match.away_score}
                        </p>
                      </div>

                      {/* Away */}
                      <div className="flex items-center gap-2 justify-end sm:w-1/3">
                        <div className="flex flex-col items-end">
                          <span className="text-sm font-semibold text-white text-right">
                            {match.away_team.name}
                          </span>
                          <span className="text-xs text-gray-400">Away</span>
                        </div>
                        {match.away_team.logo_url && (
                          <img
                            src={match.away_team.logo_url}
                            alt={match.away_team.name}
                            className="h-8 w-8 rounded-full bg-[#050816] object-contain border border-slate-800"
                          />
                        )}
                      </div>
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
