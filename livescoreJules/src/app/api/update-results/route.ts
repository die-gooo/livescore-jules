// src/app/api/update-results/route.ts
import { NextRequest, NextResponse } from "next/server";
import supabaseAdmin from "@/lib/supabaseAdmin";
import fixturesResults from "@/data/fixtures_results";

export const runtime = "nodejs";

type FixtureResult = {
  competition: string;
  round: string;
  home_team: string;
  away_team: string;
  start_time: string;
  home_score: number;
  away_score: number;
  status?: string;
};

async function getCompetitionIdByName(name: string) {
  const { data, error } = await supabaseAdmin
    .from("competitions")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Competition not found: ${name}`);
  return data.id as number;
}

async function getTeamIdByName(name: string) {
  const { data, error } = await supabaseAdmin
    .from("teams")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error(`Team not found: ${name}`);
  return data.id as number;
}

export async function GET(req: NextRequest) {
  try {
    const secret = req.nextUrl.searchParams.get("secret");
    if (!secret || secret !== process.env.SEED_SECRET) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized: missing or invalid secret" },
        { status: 401 }
      );
    }

    const fixtures = fixturesResults as FixtureResult[];

    // Cache in memoria per non chiamare 200 volte
    const competitionCache = new Map<string, number>();
    const teamCache = new Map<string, number>();

    let updated = 0;
    let notFound = 0;

    for (const f of fixtures) {
      try {
        // competition id
        let competitionId = competitionCache.get(f.competition);
        if (!competitionId) {
          competitionId = await getCompetitionIdByName(f.competition);
          competitionCache.set(f.competition, competitionId);
        }

        // team ids
        let homeTeamId = teamCache.get(f.home_team);
        if (!homeTeamId) {
          homeTeamId = await getTeamIdByName(f.home_team);
          teamCache.set(f.home_team, homeTeamId);
        }

        let awayTeamId = teamCache.get(f.away_team);
        if (!awayTeamId) {
          awayTeamId = await getTeamIdByName(f.away_team);
          teamCache.set(f.away_team, awayTeamId);
        }

        // match da aggiornare
        const { data: match, error: matchError } = await supabaseAdmin
          .from("matches")
          .select("id, home_score, away_score, status")
          .eq("competition_id", competitionId)
          .eq("home_team_id", homeTeamId)
          .eq("away_team_id", awayTeamId)
          .eq("round", f.round)
          .maybeSingle();

        if (matchError) throw matchError;
        if (!match) {
          console.warn("Match not found for fixture:", f);
          notFound++;
          continue;
        }

        const nextStatus =
          f.status ??
          ((f.home_score !== null || f.away_score !== null) ? "final" : "in programma");

        const { error: updateError } = await supabaseAdmin
          .from("matches")
          .update({
            home_score: f.home_score,
            away_score: f.away_score,
            status: nextStatus,
          })
          .eq("id", match.id);

        if (updateError) throw updateError;
        updated++;
      } catch (e) {
        console.error("Error updating fixture:", f, e);
        // continuiamo col resto
      }
    }

    return NextResponse.json({
      ok: true,
      fixtures: fixtures.length,
      updated,
      notFound,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message ?? String(error) },
      { status: 500 }
    );
  }
}
