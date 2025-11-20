"use client";

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';

/** Rappresentazione di un match per la scoreboard. */
type Match = {
  id: string;
  home_score: number;
  away_score: number;
  status: string;
  competition: { name: string };
  home_team: { name: string; logo_url: string };
  away_team: { name: string; logo_url: string };
};

export default function Scoreboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  /**
   * Stato del badge (GOAL o cambi di stato).
   * Contiene l'id del match, il testo da mostrare e la classe di colore.
   */
  const [badge, setBadge] = useState<{ id: string; text: string; color: string } | null>(null);

  // Ref per confrontare punteggi e stati precedenti al polling
  const matchesRef = useRef<Match[]>(matches);
  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);

  useEffect(() => {
    // Fetch iniziale e polling
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
          competition: m.competition ?? { name: '' },
          home_team: m.home_team ?? { name: '', logo_url: '' },
          away_team: m.away_team ?? { name: '', logo_url: '' },
        }));

        // Determina se mostrare un badge (goal o cambi di stato)
        let badgeInfo: { id: string; text: string; color: string } | null = null;
        processed.forEach((newMatch) => {
          const prev = matchesRef.current.find((m) => m.id === newMatch.id);
          if (prev) {
            if (prev.home_score !== newMatch.home_score || prev.away_score !== newMatch.away_score) {
              badgeInfo = { id: newMatch.id, text: 'GOAL', color: 'bg-green-500' };
            } else if (prev.status !== newMatch.status) {
              const statusText = String(newMatch.status).toUpperCase();
              let colorClass = 'bg-gray-500';
              if (statusText === 'LIVE') colorClass = 'bg-yellow-500';
              if (statusText === 'HALFTIME') colorClass = 'bg-orange-500';
              if (statusText === 'FINAL') colorClass = 'bg-red-500';
              badgeInfo = { id: newMatch.id, text: statusText, color: colorClass };
            }
          }
        });

        setMatches(processed);
        if (badgeInfo) {
          setBadge(badgeInfo);
          setTimeout(() => setBadge(null), 3000);
        }
      }
      setLoading(false);
    };

    // Primo fetch
    fetchMatches();
    // Polling ogni 5 secondi
    const intervalId = setInterval(fetchMatches, 5000);

    // Sottoscrizione realtime tramite canale
    const channel = supabase
      .channel('realtime-matches')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches' },
        (payload) => {
          const updatedId = String(payload.new.id);
          // Aggiorna lo stato locale dei match
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
          // Controlla se si tratta di un goal o di un cambio di stato
          const prevMatch = matchesRef.current.find((m) => m.id === updatedId);
          let badgeInfo: { id: string; text: string; color: string } | null = null;
          if (prevMatch) {
            if (
              prevMatch.home_score !== payload.new.home_score ||
              prevMatch.away_score !== payload.new.away_score
            ) {
              badgeInfo = { id: updatedId, text: 'GOAL', color: 'bg-green-500' };
            } else if (prevMatch.status !== payload.new.status) {
              const statusText = String(payload.new.status).toUpperCase();
              let colorClass = 'bg-gray-500';
              if (statusText === 'LIVE') colorClass = 'bg-yellow-500';
              if (statusText === 'HALFTIME') colorClass = 'bg-orange-500';
              if (statusText === 'FINAL') colorClass = 'bg-red-500';
              badgeInfo = { id: updatedId, text: statusText, color: colorClass };
            }
          }
          if (badgeInfo) {
            setBadge(badgeInfo);
            setTimeout(() => setBadge(null), 3000);
          }
        }
      )
      .subscribe();

    // Cleanup: rimuove il canale realtime e il polling
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
            <div className="text-sm text-gray-500 text-center mb-2">
              {match.competition.name}
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
            <div className="text-center mt-2 text-sm text-gray-600 capitalize">
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
