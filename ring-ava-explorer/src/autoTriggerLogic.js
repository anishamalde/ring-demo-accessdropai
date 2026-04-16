/**
 * autoTriggerLogic.js
 *
 * Pure helper functions extracted from AccessDropScreen's auto-trigger logic
 * for property-based testing. No React, no side effects.
 */

/**
 * Determines whether the onPersonDetected callback should fire
 * based on the previous and current person count.
 *
 * @param {number} prevCount - Previous detection cycle count
 * @param {number} currentCount - Current detection cycle count
 * @returns {boolean} true if callback should fire (count changed)
 */
export function shouldFireCallback(prevCount, currentCount) {
  return prevCount !== currentCount;
}

/**
 * Determines the auto-trigger action to take based on current state.
 *
 * @param {string} phase - Current delivery phase ('idle', 'active', 'completed')
 * @param {number} personCount - Current person count from detection
 * @param {boolean} debounceActive - Whether a debounce timer is currently running
 * @returns {'start_debounce' | 'cancel_debounce' | 'none'} The action to take
 */
export function getAutoTriggerAction(phase, personCount, debounceActive) {
  if (personCount >= 1 && phase === 'idle' && !debounceActive) {
    return 'start_debounce';
  }
  if (personCount === 0 && debounceActive) {
    return 'cancel_debounce';
  }
  return 'none';
}

/**
 * Determines whether the trigger should fire when the debounce timer elapses.
 *
 * @param {string} phase - Current delivery phase at timer expiry
 * @param {number} lastPersonCount - Most recent person count at timer expiry
 * @returns {boolean} true if TRIGGER_DOORSTEP should be dispatched
 */
export function shouldTriggerOnDebounceExpiry(phase, lastPersonCount) {
  return phase === 'idle' && lastPersonCount >= 1;
}

/**
 * Determines whether auto-trigger is allowed for a given delivery phase.
 *
 * @param {string} phase - Current delivery phase
 * @returns {boolean} true if auto-trigger can dispatch in this phase
 */
export function isAutoTriggerAllowed(phase) {
  return phase === 'idle';
}
