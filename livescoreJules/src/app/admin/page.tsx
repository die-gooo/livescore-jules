"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

/*
 * Admin page for updating match scores and statuses.
 * Features:
 * - Sticky header with team names, scores, and current status.
 * - Horizontal carousel of control panels for goals, status updates, and reset.
 * - Supports new statuses: "in programma", "live 1°t", "live 2°t", "halftime", "final", "sospesa", "rinviata".
 * - Updates local state immediately after database operations to avoid stale values.
 */
export default function AdminPage() {
  const [user, setUser] = useState<User | null>(null);
  const [match, setMatch] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Fetch authenticated user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, []);

  // Fetch the match for the user's team
  const fetchMatch = async () => {
    if (!user) return;
    // Get user's team id from profile
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
    // Get match where user team is home or away
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select(
        `id, start_time, status, home_score, away_score,
        home_team:teams!matches_home_team_id_fkey(name, logo_url),
        away_team:teams!matches_home_team_id_fkey(name, logo_url)`
      )
      .or(`home_team_id.eq.${profile.team_id},away_team_id.eq.${profile.team_id}`)
      .single();
    if (matchError) {
      console.error('Error fetching match:', matchError);
    } else {
      setMatch(matchData);
    }
    setLoading(false);
  };

  // Fetch match once user is loaded
  useEffect(() => {
    if (user) {
      fetchMatch();
    }
  }, [user]);

  // Score increment
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
      // Update local state immediately
      setMatch((prev: any) => (prev && prev.id === match.id ? { ...prev, [scoreField]: newScore } : prev));
      fetchMatch();
    }
  };

  // Score decrement (not below 0)
  const decrementScore = async (team: 'home' | 'away') => {
    if (!match) return;
    const newScore = team === 'home'
      ? Math.max(0, match.home_score - 1)
      : Math.max(0, match.away_score - 1);
    const scoreField = team === 'home' ? 'home_score' : 'away_score';
    const { error } = await supabase
      .from('matches')
      .update({ [scoreField]: newScore })
      .eq('id', match.id);
    if (error) {
      console.error(`Error decrementing ${team} score:`, error);
    } else {
      setMatch((prev: any) => (prev && prev.id === match.id ? { ...prev, [scoreField]: newScore } : prev));
      fetchMatch();
    }
  };

  // Reset scores and set status to "in programma"
  const resetMatch = async () => {
    if (!match) return;
    const { error } = await supabase
      .from('matches')
      .update({ home_score: 0, away_score: 0, status: 'in programma' })
      .eq('id', match.id);
    if (error) {
      console.error('Error resetting match:', error);
    } else {
      setMatch((prev: any) =>
        prev && prev.id === match.id ? { ...prev, home_score: 0, away_score: 0, status: 'in programma' } : prev
      );
      fetchMatch();
    }
  };

  // Update match status
  const updateStatus = async (
    status: 'live' | 'live 1°t' | 'live 2°t' | 'halftime' | 'final' | 'in programma' | 'sospesa' | 'rinviata'
  ) => {
    if (!match) return;
    const { error } = await supabase
      .from('matches')
      .update({ status })
      .eq('id', match.id);
    if (error) {
      console.error('Error updating status:', error);
    } else {
      setMatch((prev: any) => (prev && prev.id === match.id ? { ...prev, status } : prev));
      fetchMatch();
    }
  };

  // Logout
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  // Determine text color for status
  const statusColor = (status: string): string => {
    const lower = status.toLowerCase();
    if (lower.includes('live')) return 'text-yellow-500';
    if (lower === 'halftime') return 'text-orange-500';
    if (lower === 'final') return 'text-red-500';
    if (lower === 'sospesa') return 'text-purple-500';
    if (lower === 'rinviata') return 'text-gray-500';
    if (lower === 'in programma' || lower === 'scheduled') return 'text-blue-500';
    return 'text-gray-600';
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <main className="flex flex-col min-h-screen p-4">
      <div className="flex justify-end mb-4">
        <button onClick={handleLogout} className="p-2 bg-red-500 text-white rounded">
          Logout
        </button>
      </div>
      <h1 className="text-3xl font-bold text-center mb-4">Admin Dashboard</h1>
      {match ? (
        <div className="max-w-md w-full mx-auto">
          {/* Sticky header with match info */}
          <div className="sticky top-0 z-10 bg-white p-4 border rounded shadow-sm">
            <h2 className="text-xl font-bold text-center mb-2">
              {match.home_team.name} vs {match.away_team.name}
            </h2>
            <p className="text-center text-lg font-semibold mb-1">
              {match.home_score} - {match.away_score}
            </p>
            <p className={"text-center text-sm font-semibold capitalize " + statusColor(match.status)}>
              {match.status}
            </p>
          </div>

          {/* Carousel of control panels */}
          <div className="mt-4 flex overflow-x-auto gap-4 pb-4">
            {/* Goals panel */}
            <div className="min-w-[260px] border rounded-lg p-4 bg-gray-50 flex-shrink-0">
              <h3 className="text-lg font-semibold mb-3 text-center">Aggiorna Goal</h3>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => updateScore('home')}
                  className="py-2 px-3 bg-blue-500 text-white rounded w-full"
                >
                  +1 Home
                </button>
                <button
                  onClick={() => decrementScore('home')}
                  className="py-2 px-3 bg-purple-500 text-white rounded w-full"
                >
                  -1 Home
                </button>
                <button
                  onClick={() => updateScore('away')}
                  className="py-2 px-3 bg-blue-500 text-white rounded w-full"
                >
                  +1 Away
                </button>
                <button
                  onClick={() => decrementScore('away')}
                  className="py-2 px-3 bg-purple-500 text-white rounded w-full"
                >
                  -1 Away
                </button>
              </div>
            </div>
            {/* Status panel */}
            <div className="min-w-[260px] border rounded-lg p-4 bg-gray-50 flex-shrink-0">
              <h3 className="text-lg font-semibold mb-3 text-center">Aggiorna Stato</h3>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => updateStatus('live 1°t')}
                  className="py-2 px-3 bg-yellow-500 text-white rounded w-full"
                >
                  Live 1°T
                </button>
                <button
                  onClick={() => updateStatus('live 2°t')}
                  className="py-2 px-3 bg-yellow-500 text-white rounded w-full"
                >
                  Live 2°T
                </button>
                <button
                  onClick={() => updateStatus('halftime')}
                  className="py-2 px-3 bg-orange-500 text-white rounded w-full"
                >
                  Halftime
                </button>
                <button
                  onClick={() => updateStatus('final')}
                  className="py-2 px-3 bg-red-500 text-white rounded w-full"
                >
                  Final
                </button>
                <button
                  onClick={() => updateStatus('in programma')}
                  className="py-2 px-3 bg-blue-500 text-white rounded w-full"
                >
                  In programma
                </button>
                <button
                  onClick={() => updateStatus('sospesa')}
                  className="py-2 px-3 bg-purple-500 text-white rounded w-full"
                >
                  Sospesa
                </button>
                <button
                  onClick={() => updateStatus('rinviata')}
                  className="py-2 px-3 bg-gray-500 text-white rounded w-full"
                >
                  Rinviata
                </button>
              </div>
            </div>
            {/* Reset panel */}
            <div className="min-w-[260px] border rounded-lg p-4 bg-gray-50 flex-shrink-0">
              <h3 className="text-lg font-semibold mb-3 text-center">Altre Azioni</h3>
              <button
                onClick={resetMatch}
                className="py-2 px-3 bg-gray-600 text-white rounded w-full"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      ) : (
        <p>No match found for your team.</p>
      )}
    </main>
  );
}
