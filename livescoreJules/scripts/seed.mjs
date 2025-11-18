import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL or service role key is missing.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  // --- Create a competition ---
  const { data: competition, error: competitionError } = await supabase
    .from('competitions')
    .insert([{ name: 'Premier League', country: 'England' }])
    .select()
    .single();

  if (competitionError) {
    console.error('Error creating competition:', competitionError);
    return;
  }
  console.log('Created competition:', competition);


  // --- Create two teams ---
  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .insert([
      { name: 'Manchester United', short_name: 'MUN', logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/7/7a/Manchester_United_FC_crest.svg/1200px-Manchester_United_FC_crest.svg.png' },
      { name: 'Manchester City', short_name: 'MCI', logo_url: 'https://upload.wikimedia.org/wikipedia/en/thumb/e/eb/Manchester_City_FC_badge.svg/1200px-Manchester_City_FC_badge.svg.png' },
    ])
    .select();

  if (teamsError) {
    console.error('Error creating teams:', teamsError);
    return;
  }
  console.log('Created teams:', teams);

  // --- Create a match ---
  const { error: matchError } = await supabase.from('matches').insert([
    {
      home_team_id: teams[0].id,
      away_team_id: teams[1].id,
      competition_id: competition.id,
      start_time: new Date().toISOString(),
      status: 'SCHEDULED',
    },
  ]);

  if (matchError) {
    console.error('Error creating match:', matchError);
  } else {
    console.log('Created match successfully!');
  }
}

main().catch((e) => console.error(e));
