import { NextRequest, NextResponse } from "next/server";
import supabaseAdmin from "@/lib/supabaseAdmin";
import fixtures from "@/data/fixtures";

export const runtime = "nodejs";

type Fixture = {
  competition: string;
  round: string;
  home_team: string;
  away_team: string;
  start_time: string;
  venue: string | null;
};

async function getOrCreateCompetition(name: string) {
  const { data: existing, error: selectError } = await supabaseAdmin
    .from("competitions")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing.id as number;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("competitions")
    .insert({ name })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return inserted.id as number;
}

async function getOrCreateTeam(name: string) {
  const { data: existing, error: selectError } = await supabaseAdmin
    .from("teams")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing) return existing.id as number;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("teams")
    .insert({ name })
    .select("id")
    .single();

  if (insertError) throw insertError;
  return inserted.id as number;
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

    const fixturesTyped = fixtures as Fixture[];

    const competitionNames = Array.from(
      new Set(fixturesTyped.map((f) => f.competition))
    );
    const competitionMap = new Map<string, number>();
    for (const name of competitionNames) {
      const id = await getOrCreateCompetition(name);
      competitionMap.set(name, id);
    }

    const teamNames = Array.from(
      new Set(fixturesTyped.flatMap((f) => [f.home_team, f.away_team]))
    );
    const teamMap = new Map<string, number>();
    for (const name of teamNames) {
      const id = await getOrCreateTeam(name);
      teamMap.set(name, id);
    }

    const matchesToInsert = fixturesTyped.map((f) => {
      const competitionId = competitionMap.get(f.competition);
      const homeTeamId = teamMap.get(f.home_team);
      const awayTeamId = teamMap.get(f.away_team);

      if (!competitionId || !homeTeamId || !awayTeamId) {
        throw new Error(
          Missing id for competition or teams in fixture: ${JSON.stringify(f)}
        );
      }

      return {
        competition_id: competitionId,
        round: f.round, // se non vuoi usare round, togli questa riga
        home_team_id: homeTeamId,
        away_team_id: awayTeamId,
        start_time: f.start_time,
        status: "in programma",
        home_score: 0,
        away_score: 0,
      };
    });

    const BATCH_SIZE = 100;
    let insertedTotal = 0;
    for (let i = 0; i < matchesToInsert.length; i += BATCH_SIZE) {
      const batch = matchesToInsert.slice(i, i + BATCH_SIZE);
      const { error } = await supabaseAdmin.from("matches").insert(batch);
      if (error) {
        return NextResponse.json(
          { ok: false, error: error.message },
          { status: 500 }
        );
      }
      insertedTotal += batch.length;
    }

    return NextResponse.json({
      ok: true,
      competitionsCreated: competitionNames.length,
      teamsCreated: teamNames.length,
      matchesInserted: insertedTotal,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message ?? String(error) },
      { status: 500 }
    );
  }
}
