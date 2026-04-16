import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { shouldFireCallback, getAutoTriggerAction, shouldTriggerOnDebounceExpiry, isAutoTriggerAllowed } from './autoTriggerLogic';

/**
 * Feature: accessdrop-live-detection
 * Property 1: Detection callback fires on count transitions
 *
 * Validates: Requirements 2.1, 2.2, 2.3
 */
describe('Feature: accessdrop-live-detection', () => {
  describe('Property 1: Detection callback fires on count transitions', () => {
    it('should fire callback exactly once per count transition', () => {
      fc.assert(
        fc.property(
          fc.array(fc.nat({ max: 10 }), { minLength: 1, maxLength: 100 }),
          (counts) => {
            const callbackArgs = [];
            let prevCount = 0; // initial state before any detection

            for (const count of counts) {
              if (shouldFireCallback(prevCount, count)) {
                callbackArgs.push(count);
              }
              prevCount = count;
            }

            // Verify: callback fired exactly once per transition
            const expectedArgs = [];
            let prev = 0;
            for (const count of counts) {
              if (count !== prev) {
                expectedArgs.push(count);
              }
              prev = count;
            }

            expect(callbackArgs).toEqual(expectedArgs);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not fire callback when count stays the same', () => {
      fc.assert(
        fc.property(
          fc.nat({ max: 10 }),
          fc.nat({ min: 2, max: 20 }),
          (count, repetitions) => {
            let prevCount = count;
            let callbackFired = false;

            // Repeat the same count multiple times
            for (let i = 0; i < repetitions; i++) {
              if (shouldFireCallback(prevCount, count)) {
                callbackFired = true;
              }
              prevCount = count;
            }

            expect(callbackFired).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 2: Debounce guards auto-trigger timing
   *
   * Validates: Requirements 5.1, 5.2, 5.4
   *
   * For any sequence of person count changes over time while the delivery phase
   * is idle, TRIGGER_DOORSTEP is dispatched if and only if the person count
   * remains >= 1 continuously for the full debounce period (DEBOUNCE_MS).
   * If the count drops to 0 before the debounce period elapses, the pending
   * trigger is cancelled and no action is dispatched.
   */
  describe('Property 2: Debounce guards auto-trigger timing', () => {
    const DEBOUNCE_MS = 2000;

    it('should trigger only after continuous detection for DEBOUNCE_MS', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.record({
              count: fc.nat({ max: 5 }),
              delayMs: fc.nat({ max: 3000 }),
            }),
            { minLength: 1, maxLength: 50 }
          ),
          (events) => {
            let debounceActive = false;
            let debounceStartTime = 0;
            let currentTime = 0;
            let triggered = false;
            let lastCount = 0;

            for (const { count, delayMs } of events) {
              if (triggered) break;

              lastCount = count;
              const action = getAutoTriggerAction('idle', count, debounceActive);

              if (action === 'start_debounce') {
                debounceActive = true;
                debounceStartTime = currentTime;
              } else if (action === 'cancel_debounce') {
                debounceActive = false;
              }

              currentTime += delayMs;

              // Check if debounce period has elapsed
              if (debounceActive && (currentTime - debounceStartTime) >= DEBOUNCE_MS) {
                if (shouldTriggerOnDebounceExpiry('idle', lastCount)) {
                  triggered = true;
                }
                debounceActive = false;
              }
            }

            // Verify: if triggered, the last count at trigger time was >= 1
            // and debounce period had elapsed
            if (triggered) {
              expect(lastCount).toBeGreaterThanOrEqual(1);
            }

            // Verify: if all events had count 0, no trigger should have fired
            if (events.every(e => e.count === 0)) {
              expect(triggered).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should cancel trigger when count drops to 0 before debounce elapses', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 5 }),
          fc.nat({ max: 1999 }),
          (initialCount, earlyDelay) => {
            // Start with person detected
            let debounceActive = false;
            const action1 = getAutoTriggerAction('idle', initialCount, debounceActive);
            expect(action1).toBe('start_debounce');
            debounceActive = true;

            // Before DEBOUNCE_MS elapses, count drops to 0
            const action2 = getAutoTriggerAction('idle', 0, debounceActive);
            expect(action2).toBe('cancel_debounce');
            debounceActive = false;

            // After cancellation, debounce is no longer active
            expect(debounceActive).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 3: Auto-trigger respects delivery phase
   *
   * Validates: Requirements 3.1, 3.2
   *
   * For any delivery phase and for any person detection event with count >= 1,
   * the auto-trigger mechanism dispatches TRIGGER_DOORSTEP only when the phase
   * is idle. When the phase is active or completed, no action is dispatched.
   */
  describe('Property 3: Auto-trigger respects delivery phase', () => {
    it('should only allow trigger when phase is idle', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('idle', 'active', 'completed'),
          fc.integer({ min: 1, max: 10 }),
          (phase, personCount) => {
            const allowed = isAutoTriggerAllowed(phase);
            const action = getAutoTriggerAction(phase, personCount, false);

            if (phase === 'idle') {
              expect(allowed).toBe(true);
              expect(action).toBe('start_debounce');
            } else {
              expect(allowed).toBe(false);
              expect(action).toBe('none');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not trigger on debounce expiry when phase is not idle', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('active', 'completed'),
          fc.integer({ min: 1, max: 10 }),
          (phase, lastCount) => {
            const shouldTrigger = shouldTriggerOnDebounceExpiry(phase, lastCount);
            expect(shouldTrigger).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
