import React from 'react';

/**
 * VoiceModePanel — voice-guided interaction panel for blind/low-vision customers.
 *
 * Displays a speaking indicator when Polly is active, delivery status info,
 * parcel location details, and voice action buttons. Uses ARIA live regions
 * to announce status changes to screen readers.
 *
 * Props:
 *   deliveryState   — current DeliveryState from the flow engine
 *   isSpeaking      — boolean, true when Polly TTS is actively speaking
 *   parcelLocation  — string or null, confirmed parcel location description
 *   onAction        — callback receiving action objects
 */
export default function VoiceModePanel({ deliveryState, isSpeaking = false, parcelLocation = null, onAction }) {
  const phase = deliveryState?.phase ?? 'idle';
  const actionsDisabled = phase !== 'active';

  const statusText =
    phase === 'idle'
      ? 'Waiting for delivery to start.'
      : phase === 'active'
        ? 'Delivery in progress.'
        : 'Delivery completed.';

  const locationText = parcelLocation
    ? `Your parcel is at: ${parcelLocation}`
    : 'Parcel location has not yet been confirmed.';

  return (
    <section className="ad-voice-panel" aria-label="Voice mode interaction panel">
      {/* Speaking indicator — announced assertively so screen readers pick it up */}
      <div
        className={`ad-voice-speaking ${isSpeaking ? 'ad-voice-speaking--active' : ''}`}
        role="status"
        aria-live="assertive"
        aria-label={isSpeaking ? 'Assistant is speaking' : 'Assistant is silent'}
      >
        {isSpeaking ? '🔊 Speaking…' : '🔇 Silent'}
      </div>

      {/* Delivery status — announced assertively on change */}
      <div
        className="ad-voice-status"
        role="status"
        aria-live="assertive"
        aria-label={`Delivery status: ${statusText}`}
      >
        <p className="ad-voice-status-text">{statusText}</p>
      </div>

      {/* Parcel location info */}
      <div
        className="ad-voice-location"
        aria-live="assertive"
        role="status"
        aria-label={locationText}
      >
        <p className="ad-voice-location-text">{locationText}</p>
      </div>

      {/* Action buttons */}
      <div className="ad-voice-actions" role="group" aria-label="Voice delivery action buttons">
        <button
          className="ad-voice-btn ad-voice-btn--acknowledge"
          disabled={actionsDisabled}
          aria-label="Acknowledge delivery"
          onClick={() => onAction({ type: 'ACKNOWLEDGE_DELIVERY' })}
        >
          Acknowledge Delivery
        </button>
        <button
          className="ad-voice-btn ad-voice-btn--where"
          disabled={actionsDisabled}
          aria-label="Where is my parcel?"
          onClick={() => onAction({ type: 'WHERE_IS_PARCEL' })}
        >
          Where is my parcel?
        </button>
      </div>
    </section>
  );
}
