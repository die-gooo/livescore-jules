"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

type MatchWithTeams = {
  id: number;
  start_time: string | null;
  status: string;
  home_score: number;
  away_score: number;
  home_team: { name: string; logo_url: string | null };
  away_team: { name: string; logo_url: string | null };
};

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [match, setMatch] = useState<MatchWithTeams | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const fetchMatch = async () => {
    if (!user) return;

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("team_id")
      .eq("id", user.id)
      .single();

    if (profileError) {
      console.error("Error fetching user profile:", profileError);
      setLoading(false);
      return;
    }

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
      .or(`home_team_id.eq.${profile.team_id},away_team_id.eq.${profile.team_id}`)
      .single();

    if (matchError) {
      console.error("Error fetching match:", matchError);
    } else {
      setMatch(matchData as MatchWithTeams);
    }

    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchMatch();
    }
  }, [user]);

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

  const updateScore = async (team: "home" | "away", delta: 1 | -1) => {
    if (!match) return;

    const field = team === "home" ? "home_score" : "away_score";
    const current = team === "home" ? match.home_score : match.away_score;
    const nextScore = Math.max(0, current + delta);

    const { error } = await supabase
      .from("matches")
      .update({ [field]: nextScore })
      .eq("id", match.id);

    if (error) {
      console.error("Error updating score:", error);
      return;
    }

    setMatch((prev) =>
      prev
        ? {
            ...prev,
            [field]: nextScore,
          }
        : prev
    );
  };

  const updateStatus = async (
    status:
      | "in programma"
      | "live 1°t"
      | "live 2°t"
      | "halftime"
      | "final"
      | "sospesa"
      | "rinviata"
  ) => {
    if (!match) return;

    const { error } = await supabase
      .from("matches")
      .update({ status })
      .eq("id", match.id);

    if (error) {
      console.error("Error updating status:", error);
      return;
    }

    setMatch((prev) =>
      prev
        ? {
            ...prev,
            status,
          }
        : prev
    );
  };

  const resetMatch = async () => {
    if (!match) return;

    const { error } = await supabase
      .from("matches")
      .update({ home_score: 0, away_score: 0, status: "in programma" })
      .eq("id", match.id);

    if (error) {
      console.error("Error resetting match:", error);
      return;
    }

    setMatch((prev) =>
      prev
        ? {
            ...prev,
            home_score: 0,
            away_score: 0,
            status: "in programma",
          }
        : prev
    );
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#111418] text-slate-300">
        <span className="text-sm">Caricamento dashboard...</span>
      </main>
    );
  }

  if (!match) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#111418] text-white">
        <button
          onClick={handleLogout}
          className="absolute top-4 right-4 rounded-full bg-red-500 px-3 py-1 text-xs font-semibold"
        >
          Logout
        </button>
        <h1 className="text-lg font-semibold mb-2">Match Admin</h1>
        <p className="text-sm text-slate-400 text-center px-6">
          Nessuna partita associata al tuo profilo.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#111418] text-white flex flex-col items-center">
      <div className="relative mx-auto flex h-auto min-h-screen w-full max-w-lg flex-col bg-[#111418]">
        {/* HEADER STICKY */}
        <div className="sticky top-0 z-10 bg-[#111418] pt-4">
          <div className="flex items-center p-4 pb-2">
            <div className="flex size-12 shrink-0 items-center justify-start text-white">
              <span className="material-symbols-outlined">timer</span>
            </div>
            <h1 className="flex-1 text-center text-lg font-bold leading-tight tracking-[-0.015em]">
              Match Admin
            </h1>
            <div className="flex w-12 items-center justify-end">
              <button
                onClick={handleLogout}
                className="flex h-8 cursor-pointer items-center justify-center rounded-full bg-red-500 px-3 text-[11px] font-semibold"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Tabs (solo UI, per ora sempre Live attivo) */}
          <div className="flex gap-8 border-b border-[#3b4754] px-4">
            <button className="flex flex-col items-center justify-center border-b-[3px] border-b-sky-500 pb-[13px] pt-4 text-sky-500">
              <p className="text-sm font-bold tracking-[0.015em]">Live</p>
            </button>
            <button className="flex flex-col items-center justify-center border-b-[3px] border-b-transparent pb-[13px] pt-4 text-[#9cabba]">
              <p className="text-sm font-bold tracking-[0.015em]">Upcoming</p>
            </button>
            <button className="flex flex-col items-center justify-center border-b-[3px] border-b-transparent pb-[13px] pt-4 text-[#9cabba]">
              <p className="text-sm font-bold tracking-[0.015em]">Finished</p>
            </button>
          </div>
        </div>

        {/* CONTENUTO */}
        <div className="flex-1 bg-[#182029] px-4 py-4 pb-6">
          {/* Card match principale */}
          <div className="flex flex-col gap-4 rounded-lg bg-[#111418] p-4">
            {/* Riga titolo + stato */}
            <div className="flex w-full items-start justify-between gap-4">
              <div className="flex flex-1 items-start gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-[#283039] text-white">
                  <span className="material-symbols-outlined">
                    sports_soccer
                  </span>
                </div>
                <div className="flex flex-1 flex-col justify-center">
                  <p className="text-base font-medium">
                    {match.home_team.name} vs {match.away_team.name}
                  </p>
                  <p className="text-xs text-[#9cabba]">
                    {formatStartTime(match.start_time)}
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                <div className="flex h-7 items-center justify-center rounded-full bg-red-600/20 px-3">
                  <p className="text-xs font-bold text-red-400 uppercase">
                    {match.status}
                  </p>
                </div>
              </div>
            </div>

            {/* Riga score centrale */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col items-start gap-1">
                <span className="text-xs text-[#9cabba] uppercase">Home</span>
                <span className="text-sm font-semibold">
                  {match.home_team.name}
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-[#9cabba] uppercase">
                  Score
                </span>
                <span className="text-3xl font-bold tracking-tight tabular-nums">
                  {match.home_score}
                  <span className="mx-1 text-2xl text-[#9cabba]">-</span>
                  {match.away_score}
                </span>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-[#9cabba] uppercase">Away</span>
                <span className="text-sm font-semibold">
                  {match.away_team.name}
                </span>
              </div>
            </div>

            {/* Controlli score */}
            <div className="grid grid-cols-2 gap-4 mt-2">
              {/* Home score */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-white">
                  Home score
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateScore("home", -1)}
                    className="flex size-8 items-center justify-center rounded-md bg-[#283039] text-white hover:bg-[#3b4754]"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    readOnly
                    value={match.home_score}
                    className="w-full rounded-md border-0 bg-[#283039] px-3 py-2 text-center text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={() => updateScore("home", +1)}
                    className="flex size-8 items-center justify-center rounded-md bg-[#283039] text-white hover:bg-[#3b4754]"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Away score */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-white">
                  Away score
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => updateScore("away", -1)}
                    className="flex size-8 items-center justify-center rounded-md bg-[#283039] text-white hover:bg-[#3b4754]"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    readOnly
                    value={match.away_score}
                    className="w-full rounded-md border-0 bg-[#283039] px-3 py-2 text-center text-sm text-white"
                  />
                  <button
                    type="button"
                    onClick={() => updateScore("away", +1)}
                    className="flex size-8 items-center justify-center rounded-md bg-[#283039] text-white hover:bg-[#3b4754]"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Status + reset */}
            <div className="flex flex-col gap-3 mt-2">
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-white">
                  Match status
                </label>
                <select
                  value={match.status}
                  onChange={(e) =>
                    updateStatus(e.target.value as any)
                  }
                  className="w-full rounded-md border-0 bg-[#283039] p-2 text-sm text-white"
                >
                  <option value="in programma">In programma</option>
                  <option value="live 1°t">Live 1°T</option>
                  <option value="live 2°t">Live 2°T</option>
                  <option value="halftime">Halftime</option>
                  <option value="final">Final</option>
                  <option value="sospesa">Sospesa</option>
                  <option value="rinviata">Rinviata</option>
                </select>
              </div>

              <button
                type="button"
                onClick={resetMatch}
                className="w-full rounded-lg bg-[#283039] px-3 py-2 text-sm font-medium text-white hover:bg-[#3b4754]"
              >
                Reset (0 - 0, In programma)
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
