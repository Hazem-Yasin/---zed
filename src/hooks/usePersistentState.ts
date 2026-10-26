import { useCallback, useEffect, useRef, useState } from 'react';

const PREFIX = 'mushaf-maps:';

/** Safe localStorage read; any failure (private mode, bad JSON, quota) falls back to the default. */
export function readStored<T>(key: string, fallback: T, validate?: (v: unknown) => boolean): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    const parsed = JSON.parse(raw);
    if (validate && !validate(parsed)) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function writeStored(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable: persistence is best-effort */
  }
}

/**
 * useState that survives reloads. `validate` rejects stale/corrupt stored values
 * (e.g. a view name that no longer exists) so the app never boots into a broken state.
 */
export function usePersistentState<T>(
  key: string,
  initial: T,
  validate?: (v: unknown) => boolean
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readStored(key, initial, validate));
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    writeStored(key, value);
  }, [key, value]);

  const set = useCallback<React.Dispatch<React.SetStateAction<T>>>((v) => setValue(v), []);
  return [value, set];
}
