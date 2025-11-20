"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Match = {
  id: string;
  home_score: number;
  away_score: number;
  status: string;
  home_team: { name: string; logo_url: string };
  away_team: { name: string; logo_url: string };
};

export default function AdminPage() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id,
          home_score,
          away_score,
          status,
          home_team:teams!matches_home_team_id_fkey (name, logo_url),
          away_team:teams!matches_away_team_id_fkey (name, logo_url)
        `)
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching matches:', error);
        return;
      }
      if (data) {
        const processed: Match[] = (data as any[]).map((m) => ({
          id: String(m.id),
          home_score: m.home_score,
          away_score: m.away_score,
          status: m.status,
          home_team: m.home_team ?? { name: '', logo_url: '' },
          away_team: m.away_team ?? { name: '', logo_url: '' },
        }));
        setMatches(processed);
      }
      setLoading(false);
    };

    fetchMatches();
  }, []);

  // Increment goal
  const updateScore = async (id: string, team: 'home' | 'away') => {
    const match = matches.find((m) => m.id === id);
    if (!match) return;
    const newScore =
      team === 'home' ? match.home_score + 1 : match.away_score + 1;

    const updates =
      team === 'home'
        ? { home_score: newScore }
        : { away_score: newScore };

    const { error } = await supabase.from('matches').update(updates).eq('id', id);
    if (error) {
      console.error('Error updating score:', error);
    }
  };

  // Decrement goal (non scende sotto zero)
  const decrementScore = async (id: string, team: 'home' | 'away') => {
    const match = matches.find((m) => m.id === id);
    if (!match) return;
    const currentScore = team === 'home' ? match.home_score : match.away_score;
    if (currentScore <= 0) return;

    const updates =
      team === 'home'
        ? { home_score: currentScore - 1 }
        : { away_score: currentScore - 1 };

    const { error } = await supabase.from('matches').update(updates).eq('id', id);
    if (error) {
      console.error('Error decrementing score:', error);
    }
  };

  // Cambia stato (live, halftime, final)
  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('matches').update({ status }).eq('id', id);
    if (error) {
      console.error('Error updating status:', error);
    }
  };

  // Reset punteggio e stato (riporta a 0-0 e stato live)
  const resetMatch = async (id: string) => {
    const { error } = await supabase
      .from('matches')
      .update({ home_score: 0, away_score: 0, status: 'live' })
      .eq('id', id);
    if (error) {
      console.error('Error resetting match:', error);
    }
  };

  if (loading) {
    return <div>Loading matches...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      {matches.length === 0 ? (
        <p>No matches available.</p>
      ) : (
        matches.map((match) => (
          <div
            key={match.id}
            className="border rounded-lg p-4 mb-8 shadow-sm bg-white"
          >
            <h2 className="text-xl font-semibold mb-2">
              {match.home_team.name} vs {match.away_team.name}
            </h2>
            <div className="mb-2">
              Score: {match.home_score} - {match.away_score}
            </div>
            <div className="mb-4 capitalize">Status: {match.status}</div>

            <div className="flex flex-wrap gap-4 justify-center mt-4">
              {/* Increment buttons */}
              <button
                onClick={() => updateScore(match.id, 'home')}
                className="p-2 bg-blue-500 text-white rounded"
              >
                +1 Home Goal
              </button>
              <button
                onClick={() => updateScore(match.id, 'away')}
                className="p-2 bg-blue-500 text-white rounded"
              >
                +1 Away Goal
              </button>
              {/* Decrement buttons */}
              <button
                onClick={() => decrementScore(match.id, 'home')}
                className="p-2 bg-purple-500 text-white rounded"
              >
                -1 Home Goal
              </button>
              <button
                onClick={() => decrementScore(match.id, 'away')}
                className="p-2 bg-purple-500 text-white rounded"
              >
                -1 Away Goal
              </button>
              {/* Status buttons */}
              <button
                onClick={() => updateStatus(match.id, 'live')}
                className="p-2 bg-yellow-500 text-white rounded"
              >
                Live
              </button>
              <button
                onClick={() => updateStatus(match.id, 'halftime')}
                className="p-2 bg-orange-500 text-white rounded"
              >
                Halftime
              </button>
              <button
                onClick={() => updateStatus(match.id, 'final')}
                className="p-2 bg-red-500 text-white rounded"
              >
                Final
              </button>
              {/* Reset button */}
              <button
                onClick={() => resetMatch(match.id)}
                className="p-2 bg-gray-600 text-white rounded"
              >
                Reset
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
