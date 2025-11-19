"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Define a more specific type for our match data for better code quality
type Match = {
  id: string;
  home_score: number;
  away_score: number;
  status: string;
  competition: {
    name: string;
  };
  home_team: {
    name: string;
    logo_url: string;
  };
  away_team: {
    name: string;
    logo_url: string;
  };
};

export default function Scoreboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatedMatchId, setUpdatedMatchId] = useState<string | null>(null);

  useEffect(() => {
    // Function to fetch the initial data
    const fetchMatches = async () => {
      const { data, error } = await supabase
        .from('matches')
        .select(`
          id,
          start_time,
          status,
          home_score,
          away_score,
          competition:competitions (name),
          home_team:teams!matches_home_team_id_fkey (name, logo_url),
          away_team:teams!matches_away_team_id_fkey (name, logo_url)
        `)
        .order('start_time', { ascending: true });

      if (error) {
        console.error('Error fetching matches:', error);
      } else if (data) {
        setMatches(data as Match[]);
      }
      setLoading(false);
    };

    fetchMatches();

    // Set up the real-time subscription
    const channel = supabase
      .channel('realtime-matches')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches' },
        (payload) => {
          // *** THIS IS THE CORRECTED LOGIC ***
          // It now correctly updates the match in the list without losing team/league data.
          setMatches((prevMatches) =>
            prevMatches.map((match) => {
              if (match.id === payload.new.id) {
                // Return the existing match data but with the new scores and status
                return {
                  ...match,
                  home_score: payload.new.home_score,
                  away_score: payload.new.away_score,
                  status: payload.new.status,
                };
              }
              return match;
            })
          );

          // This triggers the "Updated" badge to appear
          setUpdatedMatchId(payload.new.id);
          setTimeout(() => setUpdatedMatchId(null), 3000); // The badge will disappear after 3 seconds
        }
      )
      .subscribe();

    // Cleanup function to remove the channel subscription when the component is no longer on screen
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return <div>Loading matches...</div>;
  }

  return (
    <div className="w-full max-w-2xl">
      {matches.length > 0 ? (
        matches.map((match) => (
          <div key={match.id} className="border p-4 my-2 rounded-lg relative shadow-sm bg-white">
            {updatedMatchId === match.id && (
              <span className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full animate-pulse">
                Updated
              </span>
            )}
            <div className="text-sm text-gray-500 text-center mb-2">{match.competition.name}</div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex-1 flex items-center justify-start text-right">
                <span className="font-bold text-lg mr-2">{match.home_team.name}</span>
                {match.home_team.logo_url && <img src={match.home_team.logo_url} alt={match.home_team.name} className="w-8 h-8" />}
              </div>
              <div className="text-3xl font-bold mx-4">
                {match.home_score} - {match.away_score}
              </div>
              <div className="flex-1 flex items-center justify-end">
                {match.away_team.logo_url && <img src={match.away_team.logo_url} alt={match.away_team.name} className="w-8 h-8" />}
                <span className="font-bold text-lg ml-2">{match.away_team.name}</span>
              </div>
            </div>
            <div className="text-center mt-2 text-sm text-gray-600 capitalize">{match.status}</div>
          </div>
        ))
      ) : (
        <p>No matches scheduled.</p>
      )}
    </div>
  );
}
