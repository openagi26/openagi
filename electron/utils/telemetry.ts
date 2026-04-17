/**
 * Telemetry Module (Disabled for OpenAGI)
 * All telemetry functions are no-ops to protect user privacy.
 */

 
export async function initTelemetry(): Promise<void> {
  // No-op: OpenAGI does not collect telemetry
}

 
export function trackMetric(_event: string, _properties: Record<string, unknown> = {}): void {
  // No-op
}

 
export function captureTelemetryEvent(_event: string, _properties: Record<string, unknown> = {}): void {
  // No-op
}

export async function shutdownTelemetry(): Promise<void> {
  // No-op
}
