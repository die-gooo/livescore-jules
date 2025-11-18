"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  const fetchMatch = async () => {
    if (!user) return;

    // First, get the user's profile to find their team_id
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('team_id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      setLoading(false);
      return;
    }

    // Then, fetch the match where the user's team is either home or away
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select(`
        id,
        start_time,
        status,
        home_score,
        away_score,
        home_team:teams!matches_home_team_id_fkey(name, logo_url),
        away_team:teams!matches_away_team_id_fkey(name, logo_url)
      `)
      .or(`home_team_id.eq.${profile.team_id},away_team_id.eq.${profile.team_id}`)
      .single();

    if (matchError) {
      console.error('Error fetching match:', matchError);
    } else {
      setMatch(matchData);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchMatch();
    }
  }, [user]);

  if (loading) {
    return <div>Loading...</div>;
  }

  const updateScore = async (team: 'home' | 'away') => {
    if (!match) return;

    const newScore = team === 'home' ? match.home_score + 1 : match.away_score + 1;
    const scoreField = team === 'home' ? 'home_score' : 'away_score';

    const { error } = await supabase
      .from('matches')
      .update({ [scoreField]: newScore })
      .eq('id', match.id);

    if (error) {
      console.error(`Error updating ${team} score:`, error);
    } else {
      fetchMatch();
    }
  };

  const updateStatus = async (status: 'LIVE' | 'HALFTIME' | 'FINAL') => {
    if (!match) return;

    const { error } = await supabase
      .from('matches')
      .update({ status })
      .eq('id', match.id);

    if (error) {
      console.error('Error updating status:', error);
    } else {
      fetchMatch();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <div className="w-full flex justify-end">
        <button onClick={handleLogout} className="p-2 bg-red-500 text-white rounded">Logout</button>
      </div>
      <h1 className="text-4xl font-bold mb-8">Admin Dashboard</h1>
      {match ? (
        <div className="border p-4 rounded-lg">
          <h2 className="text-2xl font-bold text-center mb-4">{match.home_team.name} vs {match.away_team.name}</h2>
          <p className="text-center text-lg mb-4">Score: {match.home_score} - {match.away_score}</p>
          <p className="text-center text-lg mb-4">Status: {match.status}</p>
          <div className="flex gap-4 justify-center">
            <button onClick={() => updateScore('home')} className="p-2 bg-blue-500 text-white rounded">+1 Home Goal</button>
            <button onClick={() => updateScore('away')} className="p-2 bg-blue-500 text-white rounded">+1 Away Goal</button>
            <button onClick={() => updateStatus('LIVE')} className="p-2 bg-yellow-500 text-white rounded">Live</button>
            <button onClick={() => updateStatus('HALFTIME')} className="p-2 bg-yellow-500 text-white rounded">Halftime</button>
            <button onClick={() => updateStatus('FINAL')} className="p-2 bg-green-500 text-white rounded">Final</button>
          </div>
        </div>
      ) : (
        <p>No match found for your team.</p>
      )}
    </main>
  );
}
