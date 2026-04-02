import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

export function useSugarWodIdentity() {
  const { user, session } = useAuth();
  const [sugarwodAthleteId, setSugarwodAthleteId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [matched, setMatched] = useState(null);

  useEffect(() => {
    if (!user || !session) {
      setLoading(false);
      return;
    }

    async function identify() {
      // Check if already stored in profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('sugarwod_athlete_id')
        .eq('id', user.id)
        .single();

      if (profile?.sugarwod_athlete_id) {
        setSugarwodAthleteId(profile.sugarwod_athlete_id);
        setMatched(true);
        setLoading(false);
        return;
      }

      // Ask the server to look up and persist the mapping
      try {
        const res = await fetch('/api/sugarwod/identify', {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const json = await res.json();
        if (json.matched) {
          setSugarwodAthleteId(json.sugarwod_athlete_id);
          setMatched(true);
        } else {
          setMatched(false);
        }
      } catch {
        setMatched(false);
      }
      setLoading(false);
    }

    identify();
  }, [user, session]);

  return { sugarwodAthleteId, loading, matched };
}
