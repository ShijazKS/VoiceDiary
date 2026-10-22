import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { listMemories } from '@/lib/memories-repo';
import type { Memory } from '@/lib/memory';

/** Loads memories (newest first) and refreshes every time the screen gets focus. */
export function useMemories(limit = 1000) {
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setMemories(await listMemories(limit));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { memories, loading, reload };
}