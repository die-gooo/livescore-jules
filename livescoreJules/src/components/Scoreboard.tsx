"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Scoreboard() {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [updatedMatchId, setUpdatedMatchId] = useState<string | null>(null);

  useEffect(() => {
    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id,
          start_time,
          status,
          home_score,
          away_score,
          competition:competitions (
            name
          ),
          home_team:teams!matches_home_team_id_fkey (
            name,
            logo_url
          ),
          away_team:teams!matches_away_team_id_fkey (
            name,
            logo_url
          )
        `);

      if (error) {
        console.error('Error fetching matches:', error);
      } else {
        setMatches(data);
      }
      setLoading(false);
    };

    fetchMatches();

    const channel = supabase
      .channel('matches')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches' },
        (payload) => {
          setMatches((prevMatches) =>
            prevMatches.map((match) =>
              match.id === payload.new.id ? { ...match, ...payload.new } : match
            )
          );
          setUpdatedMatchId(payload.new.id);
          setTimeout(() => setUpdatedMatchId(null), 3000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      {matches.map((match) => (
        <div key={match.id} className="border p-4 my-2 rounded-lg relative">
          {updatedMatchId === match.id && (
            <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
              Updated
            </span>
          )}
          <div className="text-sm text-gray-500">{match.competition.name}</div>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center">
              <img src={match.home_team.logo_url} alt={match.home_team.name} className="w-8 h-8 mr-2" />
              <span>{match.home_team.name}</span>
            </div>
            <div className="text-2xl font-bold">
              {match.home_score} - {match.away_score}
            </div>
            <div className="flex items-center">
              <span>{match.away_team.name}</span>
              <img src={match.away_team.logo_url} alt={match.away_team.name} className="w-8 h-8 ml-2" />
            </div>
          </div>
          <div className="text-center mt-2 text-sm text-gray-500">{match.status}</div>
        </div>
      ))}
    </div>
  );
}
