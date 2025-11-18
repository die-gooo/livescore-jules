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
  // --- Get the first team's ID ---
  const { data: team, error: teamError } = await supabase
    .from('teams')
    .select('id')
    .limit(1)
    .single();

  if (teamError) {
    console.error('Error fetching team:', teamError);
    return;
  }

  // --- Create a new user ---
  const { data: user, error: userError } = await supabase.auth.admin.createUser({
    email: 'admin@example.com',
    password: 'password',
    email_confirm: true,
  });

  if (userError) {
    console.error('Error creating user:', userError);
    return;
  }

  console.log('Created user:', user);

  // --- Create a user profile ---
  const { error: profileError } = await supabase.from('user_profiles').insert([
    {
      id: user.user.id,
      display_name: 'Admin',
      role: 'admin',
      team_id: team.id,
    },
  ]);

  if (profileError) {
    console.error('Error creating user profile:', profileError);
  } else {
    console.log('Created user profile successfully!');
  }
}

main().catch((e) => console.error(e));
