import "dotenv/config";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carico fixtures.json
const fixturesPath = path.join(__dirname, "fixtures.json");
const raw = fs.readFileSync(fixturesPath, "utf8");
const fixtures = JSON.parse(raw);

// Leggo le env
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment");
}

// Client Supabase con service_role (solo lato server / script!)
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  global: {
    headers: {
      "X-Client-Info": "seed-fixtures-script",
    },
  },
});

async function getOrCreateCompetition(name) {
  const { data: existing, error: selectError } = await supabase
    .from("competitions")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (selectError) {
    console.error("Error checking competition:", name, selectError);
    throw selectError;
  }

  if (existing) {
    return existing.id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("competitions")
    .insert({ name })
    .select("id")
    .single();

  if (insertError) {
    console.error("Error inserting competition:", name, insertError);
    throw insertError;
  }

  console.log("Created competition:", name, "id:", inserted.id);
  return inserted.id;
}

async function getOrCreateTeam(name) {
  const { data: existing, error: selectError } = await supabase
    .from("teams")
    .select("id")
    .eq("name", name)
    .maybeSingle();

  if (selectError) {
    console.error("Error checking team:", name, selectError);
    throw selectError;
  }

  if (existing) {
    return existing.id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("teams")
    .insert({ name })
    .select("id")
    .single();

  if (insertError) {
    console.error("Error inserting team:", name, insertError);
    throw insertError;
  }

  console.log("Created team:", name, "id:", inserted.id);
  return inserted.id;
}

async function main() {
  console.log("Starting seed with", fixtures.length, "fixtures");

  // 1) Competitions
  const competitionNames = [...new Set(fixtures.map((f) => f.competition))];
  const competitionMap = new Map();

  for (const name of competitionNames) {
    const id = await getOrCreateCompetition(name);
    competitionMap.set(name, id);
  }

  // 2) Teams
  const teamNamesSet = new Set();
  for (const f of fixtures) {
    teamNamesSet.add(f.home_team);
    teamNamesSet.add(f.away_team);
  }
  const teamNames = [...teamNamesSet];
  const teamMap = new Map();

  for (const name of teamNames) {
    const id = await getOrCreateTeam(name);
    teamMap.set(name, id);
  }

  // 3) Matches
  const matchesToInsert = fixtures.map((f) => {
    const competitionId = competitionMap.get(f.competition);
    const homeTeamId = teamMap.get(f.home_team);
    const awayTeamId = teamMap.get(f.away_team);

    if (!competitionId || !homeTeamId || !awayTeamId) {
      throw new Error(
        `Missing id for competition or teams in fixture: ${JSON.stringify(f)}`
      );
    }

    return {
      competition_id: competitionId,
      round: f.round, // se NON hai la colonna "round", togli questa riga
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      start_time: f.start_time, // ISO string da fixtures.json
      status: "in programma",
      home_score: 0,
      away_score: 0,
    };
  });

  // Inseriamo a batch per sicurezza
  const BATCH_SIZE = 100;
  for (let i = 0; i < matchesToInsert.length; i += BATCH_SIZE) {
    const batch = matchesToInsert.slice(i, i + BATCH_SIZE);
    console.log(`Inserting matches ${i + 1} - ${i + batch.length}...`);

    const { error } = await supabase.from("matches").insert(batch);
    if (error) {
      console.error("Error inserting matches batch:", error);
      throw error;
    }
  }

  console.log("Seed completed successfully!");
}

main()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
