"use client";

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Shape of a match used within the scoreboard.
 *
 * Supabase ritorna i dati relazionati (competition, home_team, away_team)
 * sotto forma di array di un solo elemento. Per comodità normalizziamo
 * questi campi in oggetti singoli quando carichiamo i dati.
 */
type Match = {
  // Conservo l’id come stringa così da evitare problemi di confronto con numeri
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
    // Recupera e normalizza i match iniziali
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
        // Converto array in oggetti singoli e id in stringa
        const processed: Match[] = (data as any[]).map((m) => ({
          id: String(m.id),
          home_score: m.home_score,
          away_score: m.away_score,
          status: m.status,
          competition: Array.isArray(m.competition) ? (m.competition[0] ?? { name: '' }) : { name: '' },
          home_team: Array.isArray(m.home_team) ? (m.home_team[0] ?? { name: '', logo_url: '' }) : { name: '', logo_url: '' },
          away_team: Array.isArray(m.away_team) ? (m.away_team[0] ?? { name: '', logo_url: '' }) : { name: '', logo_url: '' },
        }));
        setMatches(processed);
      }
      setLoading(false);
    };

    fetchMatches();

    // Configura la sottoscrizione realtime per gli aggiornamenti
    const channel = supabase
      .channel('realtime-matches')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'matches' },
        (payload) => {
          // Converto l’ID a stringa per confronto sicuro
          const updatedId = String(payload.new.id);

          setMatches((prevMatches) =>
            prevMatches.map((match) =>
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
          // Attiva il badge GOAL per tre secondi
          setUpdatedMatchId(updatedId);
          setTimeout(() => setUpdatedMatchId(null), 3000);
        }
      )
      .subscribe();

    // Pulizia alla dismissione del componente
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
                GOAL
              </span>
            )}
            <div className="text-sm text-gray-500 text-center mb-2">{match.competition.name}</div>
            <div className="flex items-center justify-between mt-2">
              <div className="flex-1 flex items-center justify-start text-right">
                <span className="font-bold text-lg mr-2">{match.home_team.name}</span>
                {match.home_team.logo_url && (
                  <img src={match.home_team.logo_url} alt={match.home_team.name} className="w-8 h-8" />
                )}
              </div>
              <div className="text-3xl font-bold mx-4">
                {match.home_score} - {match.away_score}
              </div>
              <div className="flex-1 flex items-center justify-end">
                {match.away_team.logo_url && (
                  <img src={match.away_team.logo_url} alt={match.away_team.name} className="w-8 h-8" />
                )}
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
