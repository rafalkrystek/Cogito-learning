export interface PerfResult {
  label: string;
  durationMs: number;
}

/**
 * Mierzy czas wykonania asynchronicznej operacji i loguje wynik do konsoli.
 * Zwraca wynik funkcji oraz zapisuje metrykę w sessionStorage (do prostych porównań).
 */
export async function measureAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  try {
    const result = await fn();
    return result;
  } finally {
    const end = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const durationMs = end - start;

    // Prosty log do debugowania w przeglądarce
    console.log(`⏱ [PERF] ${label}: ${durationMs.toFixed(1)} ms`);

    // Zapisz ostatni pomiar w sessionStorage (do ręcznego porównania)
    if (typeof window !== 'undefined') {
      try {
        const key = `perf_${label}`;
        const entry: PerfResult = { label, durationMs };
        sessionStorage.setItem(key, JSON.stringify(entry));
      } catch {
        // Ignoruj błędy storage
      }
    }
  }
}


