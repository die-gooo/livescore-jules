"use client";

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

type Match = {
  id: string;
  home_score: number;
  away_score: number;
  status: string;
  /** Orario di inizio in formato ISO */
  start_time: string;
  competition: { name: string };
  home_team: { name: string; logo_url: string };
  away_team: { name: string; logo_url: string };
};

export default function Scoreboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [badge, setBadge] = useState<{ id: string; text: string; color: string } | null>(null);
  const matchesRef = useRef<Match[]>(matches);

  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);

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
          competition:competitions (name),
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
          start_time: m.start_time,
          competition: m.competition ?? { name: '' },
          home_team: m.home_team ?? { name: '', logo_url: '' },
          away_team: m.away_team ?? { name: '', logo_url: '' },
        }));

        let goalBadge: { id: string; text: string; color: string } | null = null;
        processed.forEach((newMatch) => {
          const prev = matchesRef.current.find((m) => m.id === newMatch.id);
          if (prev) {
            if (
              prev.home_score !== newMatch.home_score ||
              prev.away_score !== newMatch.away_score
            ) {
              goalBadge = { id: newMatch.id, text: 'GOAL', color: 'bg-green-500' };
            }
          }
        });

        setMatches(processed);
        if (goalBadge) {
          setBadge(goalBadge);
          setTimeout(() => setBadge(null), 3000);
        }
      }
      setLoading(false);
    };

    fetchMatches();
    const intervalId = setInterval(fetchMatches, 5000);

    const channel = supabase
      .channel('realtime-matches')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches' },
        (payload) => {
          const updatedId = String(payload.new.id);
          setMatches((prev) =>
            prev.map((match) =>
              match.id === updatedId
                ? {
                    ...match,
                    home_score: payload.new.home_score,
                    away_score: payload.new.away_score,
                    status: payload.new.status,
                  }
                : match
            )
          );
          const prevMatch = matchesRef.current.find((m) => m.id === updatedId);
          if (
            prevMatch &&
            (prevMatch.home_score !== payload.new.home_score ||
              prevMatch.away_score !== payload.new.away_score)
          ) {
            setBadge({ id: updatedId, text: 'GOAL', color: 'bg-green-500' });
            setTimeout(() => setBadge(null), 3000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      clearInterval(intervalId);
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
            {badge && badge.id === match.id && (
              <span
                className={`absolute top-2 right-2 ${badge.color} text-white text-xs px-2 py-1 rounded-full animate-pulse`}
              >
                {badge.text}
              </span>
            )}
            <div className="text-sm text-gray-500 text-center mb-2">{match.competition.name}</div>
            {/* Mostra l’orario di inizio formattato */}
            <div className="text-xs text-gray-500 text-center mb-1">
              {(() => {
                if (!match.start_time) return null;
                const dateObj = new Date(match.start_time);
                if (isNaN(dateObj.getTime())) return null;
                const timePart = dateObj.toLocaleTimeString('it-IT', {
                  timeZone: 'Europe/Rome',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                const datePart = dateObj.toLocaleDateString('it-IT', {
                  timeZone: 'Europe/Rome',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                });
                return `ore ${timePart} - ${datePart}`;
              })()}
            </div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex-1 flex items-center justify-start text-right">
                <span className="font-bold text-lg mr-2">{match.home_team.name}</span>
                {match.home_team.logo_url && (
                  <img
                    src={match.home_team.logo_url}
                    alt={match.home_team.name}
                    className="w-8 h-8"
                  />
                )}
              </div>
              <div className="text-3xl font-bold mx-4">
                {match.home_score} - {match.away_score}
              </div>
              <div className="flex-1 flex items-center justify-end">
                {match.away_team.logo_url && (
                  <img
                    src={match.away_team.logo_url}
                    alt={match.away_team.name}
                    className="w-8 h-8"
                  />
                )}
                <span className="font-bold text-lg ml-2">{match.away_team.name}</span>
              </div>
            </div>
            <div
              className={`text-center mt-2 text-sm font-semibold capitalize ${
                match.status === 'live'
                  ? 'text-yellow-500'
                  : match.status === 'halftime'
                  ? 'text-orange-500'
                  : match.status === 'final'
                  ? 'text-red-500'
                  : match.status.toLowerCase() === 'in programma' ||
                    match.status.toLowerCase() === 'scheduled'
                  ? 'text-blue-500'
                  : 'text-gray-600'
              }`}
            >
              {match.status}
            </div>
          </div>
        ))
      ) : (
        <p>No matches scheduled.</p>
      )}
    </div>
  );
}
