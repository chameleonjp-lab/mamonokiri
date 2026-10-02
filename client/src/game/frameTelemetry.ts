export function createFrameTelemetry(capacity = 1800) {
  const cpu: number[] = [];
  const intervals: number[] = [];
  let samples = 0;
  let previous: number | null = null;
  const summary = (values: number[]) => {
    const sorted = values.slice().sort((a, b) => a - b);
    const percentile = (p: number) =>
      sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? null;
    return {
      retained: sorted.length,
      p50: percentile(0.5),
      p95: percentile(0.95),
      p99: percentile(0.99),
    };
  };
  return {
    record(start: number, end: number) {
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
        return;
      const index = samples % capacity;
      cpu[index] = end - start;
      if (previous !== null) intervals[index] = Math.max(0, start - previous);
      previous = start;
      samples++;
    },
    reset() {
      cpu.length = 0;
      intervals.length = 0;
      samples = 0;
      previous = null;
    },
    snapshot() {
      return {
        samples,
        cpuMs: summary(cpu),
        frameIntervalMs: summary(intervals),
        gpuMs: null,
      };
    },
  };
}
