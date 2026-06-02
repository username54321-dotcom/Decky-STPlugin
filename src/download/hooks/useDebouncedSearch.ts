import { useState, useEffect, useRef } from "react";
import { callable } from "@decky/api";
import type { GameSearchResult } from "../../shared/types";

const searchGames = callable<[string], GameSearchResult[]>("search_games");

export function useDebouncedSearch(query: string) {
  const [results, setResults] = useState<GameSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    cancelledRef.current = false;

    timerRef.current = setTimeout(async () => {
      try {
        const data = await searchGames(query.trim());
        if (!cancelledRef.current) {
          setResults(data);
        }
      } catch {
        if (!cancelledRef.current) {
          setResults([]);
        }
      } finally {
        if (!cancelledRef.current) {
          setSearching(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timerRef.current);
      cancelledRef.current = true;
    };
  }, [query]);

  return { results, searching };
}
