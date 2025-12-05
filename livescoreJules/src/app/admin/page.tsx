"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import ErrorBoundary from "@/components/ErrorBoundary";

type MatchWithTeams = {
  id: string;
  start_time: string | null;
  status: string;
  home_score: number;
  away_score: number;
  home_team: { name: string; logo_url: string | null };
  away_team: { name: string; logo_url: string | null };
};

const LIVE_STATUSES = ["live 1°t", "live 2°t", "halftime"];
const timeZone = "Europe/Rome";

function AdminContent() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<MatchWithTeams | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 1. Recupero utente loggato
  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.push("/login");
        return;
      }
      setUser(data.user);
    };
    loadUser();
  }, [router]);

  // 2. Recupero la partita da gestire per la squadra dell'admin
  useEffect(() => {
    if (!user) return;

    const fetchMatch = async () => {
      setLoading(true);
      setError(null);

      // profilo (per team_id)
      const { data: profile, error: profileError } = await supabase
        .from("user_profiles")
        .select("team_id")
        .eq("id", user.id)
        .single();

      if (profileError || !profile?.team_id) {
        console.error("Error fetching user profile:", profileError);
        setError("Profilo non valido o nessuna squadra associata.");
        setLoading(false);
        return;
      }

      // tutte le partite della squadra, ordinate per data
      const { data: matchData, error: matchError } = await supabase
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
        .or(
          `home_team_id.eq.${profile.team_id},away_team_id.eq.${profile.team_id}`
        )
        .order("start_time", { ascending: true });

      if (matchError) {
        console.error("Error fetching matches:", matchError);
        setError("Errore nel caricamento delle partite.");
        setLoading(false);
        return;
      }

      const rows = Array.isArray(matchData) ? matchData : [];

      if (!rows.length) {
        setMatch(null);
        setLoading(false);
        return;
      }

      const now = new Date();

      // 1: partita live
      let chosen =
        rows.find((m: MatchWithTeams) => LIVE_STATUSES.includes(m.status)) ?? null;

      // 2: prossima in programma
      if (!chosen) {
        const upcoming = rows.filter((m: MatchWithTeams) => {
          if (!m.start_time) return false;
          const d = new Date(m.start_time);
          if (isNaN(d.getTime())) return false;
          return d >= now;
        });
        if (upcoming.length > 0) {
          chosen = upcoming[0];
        }
      }

      // 3: se nulla, ultima giocata
      if (!chosen) {
        chosen = rows[rows.length - 1];
      }

      if (!chosen) {
        setMatch(null);
        setLoading(false);
        return;
      }

      const raw = chosen as MatchWithTeams & {
        home_team: { name: string; logo_url: string | null } | Array<{ name: string; logo_url: string | null }>;
        away_team: { name: string; logo_url: string | null } | Array<{ name: string; logo_url: string | null }>;
      };
      const rawHome = Array.isArray(raw.home_team)
        ? raw.home_team[0]
        : raw.home_team;
      const rawAway = Array.isArray(raw.away_team)
        ? raw.away_team[0]
        : raw.away_team;

      const normalized: MatchWithTeams = {
        id: String(raw.id),
        start_time: raw.start_time ?? null,
        status: raw.status ?? "in programma",
        home_score: raw.home_score ?? 0,
        away_score: raw.away_score ?? 0,
        home_team: {
          name: rawHome?.name ?? "",
          logo_url: rawHome?.logo_url ?? null,
        },
        away_team: {
          name: rawAway?.name ?? "",
          logo_url: rawAway?.logo_url ?? null,
        },
      };

      setMatch(normalized);
      setLoading(false);
    };

    fetchMatch();
  }, [user]);

  const formatStartTime = (start: string | null) => {
    if (!start) return "";
    const d = new Date(start);
    if (isNaN(d.getTime())) return "";
    const time = d.toLocaleTimeString("it-IT", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
    });
    const date = d.toLocaleDateString("it-IT", {
      timeZone,
      day: "2-digit",
      month: "2-digit",
    });
    return `${date} • ${time}`;
  };

  const updateScore = async (
    field: "home_score" | "away_score",
    delta: 1 | -1
  ) => {
    if (!match) return;
    const newValue = Math.max(0, match[field] + delta);

    const { error } = await supabase
      .from("matches")
      .update({ [field]: newValue })
      .eq("id", match.id);

    if (error) {
      console.error("Error updating score:", error);
      setError("Errore nell'aggiornamento del punteggio.");
      return;
    }

    setMatch({ ...match, [field]: newValue });
  };

  const updateStatus = async (status: string) => {
    if (!match) return;

    const { error } = await supabase
      .from("matches")
      .update({ status })
      .eq("id", match.id);

    if (error) {
      console.error("Error updating status:", error);
      setError("Errore nell'aggiornamento dello stato.");
      return;
    }

    setMatch({ ...match, status });
  };

  const resetMatch = async () => {
    if (!match) return;

    const { error } = await supabase
      .from("matches")
      .update({
        home_score: 0,
        away_score: 0,
        status: "in programma",
      })
      .eq("id", match.id);

    if (error) {
      console.error("Error resetting match:", error);
      setError("Errore nel reset della partita.");
      return;
    }

    setMatch({
      ...match,
      home_score: 0,
      away_score: 0,
      status: "in programma",
    });
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0b1016] text-white">
        <p>Carico la partita...</p>
      </main>
    );
  }

  if (!match) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0b1016] text-white">
        <p>Nessuna partita associata al tuo profilo.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0b1016] text-white flex items-center justify-center px-4">
      <div className="w-full max-w-3xl rounded-2xl bg-[#141b23] p-6 shadow-xl border border-[#222b36]">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-semibold">Pannello Admin</h1>
          <span className="text-xs text-gray-400">
            {match.start_time
              ? formatStartTime(match.start_time)
              : "Orario da definire"}
          </span>
        </div>

        {error && (
          <div className="mb-3 rounded-lg bg-red-900/40 px-3 py-2 text-sm text-red-200">
            {error}
          </div>
        )}

        {/* Scoreboard */}
        <div className="mb-6 grid grid-cols-3 items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-400 uppercase">Casa</p>
            <p className="text-xl font-semibold">{match.home_team.name}</p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold">
              {match.home_score} - {match.away_score}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wide text-gray-400">
              Stato: {match.status}
            </p>
          </div>
          <div className="text-left">
            <p className="text-sm text-gray-400 uppercase">Ospiti</p>
            <p className="text-xl font-semibold">{match.away_team.name}</p>
          </div>
        </div>

        {/* Controlli punteggio */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl bg-[#1b2430] p-4">
            <p className="mb-2 text-sm text-gray-300">Punteggio Casa</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => updateScore("home_score", -1)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-600 text-lg"
              >
                -
              </button>
              <span className="min-w-[2ch] text-center text-xl font-semibold">
                {match.home_score}
              </span>
              <button
                type="button"
                onClick={() => updateScore("home_score", 1)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-400 text-lg"
              >
                +
              </button>
            </div>
          </div>

          <div className="rounded-xl bg-[#1b2430] p-4">
            <p className="mb-2 text-sm text-gray-300">Punteggio Ospiti</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => updateScore("away_score", -1)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-600 text-lg"
              >
                -
              </button>
              <span className="min-w-[2ch] text-center text-xl font-semibold">
                {match.away_score}
              </span>
              <button
                type="button"
                onClick={() => updateScore("away_score", 1)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-400 text-lg"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Controlli stato */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-sm">
          <button
            type="button"
            onClick={() => updateStatus("in programma")}
            className="rounded-lg bg-[#283039] px-3 py-2 hover:bg-[#3b4754]"
          >
            In programma
          </button>
          <button
            type="button"
            onClick={() => updateStatus("live 1°t")}
            className="rounded-lg bg-[#283039] px-3 py-2 hover:bg-[#3b4754]"
          >
            Live 1°T
          </button>
          <button
            type="button"
            onClick={() => updateStatus("live 2°t")}
            className="rounded-lg bg-[#283039] px-3 py-2 hover:bg-[#3b4754]"
          >
            Live 2°T
          </button>
          <button
            type="button"
            onClick={() => updateStatus("halftime")}
            className="rounded-lg bg-[#283039] px-3 py-2 hover:bg-[#3b4754]"
          >
            Intervallo
          </button>
          <button
            type="button"
            onClick={() => updateStatus("terminata")}
            className="rounded-lg bg-green-700 px-3 py-2 hover:bg-green-800"
          >
            Terminata
          </button>
          <button
            type="button"
            onClick={() => updateStatus("rinviata")}
            className="rounded-lg bg-yellow-700 px-3 py-2 hover:bg-yellow-800"
          >
            Rinviata
          </button>
        </div>

        {/* Reset */}
        <div className="border-t border-[#222b36] pt-4">
          <button
            type="button"
            onClick={resetMatch}
            className="w-full rounded-lg bg-[#283039] px-3 py-2 text-sm font-medium text-white hover:bg-[#3b4754]"
          >
            Reset (0 - 0, In programma)
          </button>
        </div>
      </div>
    </main>
  );
}

export default function AdminPage() {
  return (
    <ErrorBoundary>
      <AdminContent />
    </ErrorBoundary>
  );
}
