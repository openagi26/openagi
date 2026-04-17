import { describe, expect, it, vi } from 'vitest';

describe('main telemetry shutdown', () => {
  it('telemetry functions are no-ops and do not throw', async () => {
    vi.resetModules();
    const { initTelemetry, shutdownTelemetry, trackMetric, captureTelemetryEvent } =
      await import('@electron/utils/telemetry');

    await expect(initTelemetry()).resolves.toBeUndefined();
    expect(() => trackMetric('test_event')).not.toThrow();
    expect(() => captureTelemetryEvent('test_event')).not.toThrow();
    await expect(shutdownTelemetry()).resolves.toBeUndefined();
  });
});
