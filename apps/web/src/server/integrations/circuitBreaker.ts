import { AppError, ErrorCode } from '../lib/errors';
import { logger } from '../lib/logger';

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount: number = 0;
  private lastFailureTime: number = 0;
  private readonly failureThreshold: number;
  private readonly cooldownPeriodMs: number;

  constructor(failureThreshold: number = 5, cooldownPeriodMs: number = 60_000) {
    this.failureThreshold = failureThreshold;
    this.cooldownPeriodMs = cooldownPeriodMs;
  }

  public getState(): CircuitBreakerState {
    if (this.state === 'OPEN') {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.cooldownPeriodMs) {
        this.state = 'HALF_OPEN';
      }
    }
    return this.state;
  }

  public async execute<T>(fn: () => Promise<T>, correlationId?: string): Promise<T> {
    const currentState = this.getState();

    if (currentState === 'OPEN') {
      logger.warn('Circuit breaker is OPEN. Rejecting execution.', correlationId);
      throw new AppError(
        'ML service is currently unavailable (circuit open).',
        503,
        ErrorCode.CIRCUIT_BREAKER_OPEN
      );
    }

    try {
      const result = await fn();
      this.onSuccess(correlationId);
      return result;
    } catch (err) {
      this.onFailure(correlationId);
      throw err;
    }
  }

  private onSuccess(correlationId?: string) {
    if (this.state === 'HALF_OPEN' || this.failureCount > 0) {
      logger.info(
        `Circuit breaker reset to CLOSED after successful request.`,
        correlationId
      );
    }
    this.state = 'CLOSED';
    this.failureCount = 0;
  }

  private onFailure(correlationId?: string) {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      logger.error(
        `Circuit breaker tripped to OPEN. Consecutive failures: ${this.failureCount}`,
        correlationId
      );
    }
  }

  public reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}

export const circuitBreaker = new CircuitBreaker(5, 60_000);

