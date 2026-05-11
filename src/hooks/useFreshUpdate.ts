import { useEffect, useState } from 'react';
import { CHANGELOG, CURRENT_VERSION, type ChangelogEntry } from '@/lib/version';

const SEEN_KEY = 'elvis_changelog_seen_version';
const FRESH_WINDOW_MS = 24 * 60 * 60 * 1000;

function releaseTime(entry: ChangelogEntry): number {
  if (entry.releasedAt) return new Date(entry.releasedAt).getTime();
  // Bakåtkompatibilitet för gamla entries utan tidstämpel: tolka YYYY-MM-DD
  // som midnatt i Europe/Stockholm (+02:00 sommartid räcker för vår synlighet
  // — exakt timme spelar ingen roll när fönstret är 24h).
  return new Date(`${entry.date}T00:00:00+02:00`).getTime();
}

export function useFreshUpdate(): { isFresh: boolean; markSeen: () => void } {
  const [isFresh, setIsFresh] = useState(false);

  useEffect(() => {
    const latest = CHANGELOG[0];
    if (!latest) return;
    const seen = window.localStorage.getItem(SEEN_KEY);
    if (seen === CURRENT_VERSION) return;
    const age = Date.now() - releaseTime(latest);
    if (age < 0 || age >= FRESH_WINDOW_MS) return;
    setIsFresh(true);
    const remaining = FRESH_WINDOW_MS - age;
    const timer = window.setTimeout(() => setIsFresh(false), remaining);
    return () => window.clearTimeout(timer);
  }, []);

  function markSeen() {
    window.localStorage.setItem(SEEN_KEY, CURRENT_VERSION);
    setIsFresh(false);
  }

  return { isFresh, markSeen };
}
