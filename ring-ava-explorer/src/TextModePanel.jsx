import React, { useRef, useEffect } from 'react';

/**
 * Formats a timestamp (ms since epoch) into a readable time string.
 */
function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/**
 * TextModePanel — text-first interaction panel for deaf/hard-of-hearing customers.
 *
 * Displays transcribed courier messages in a scrollable, high-contrast panel
 * and provides action buttons for delivery interactions.
 *
 * Props:
 *   messages      — array of { id, sender, text, timestamp, isFinal }
 *   deliveryState — current DeliveryState from the flow engine
 *   onAction      — callback receiving action objects
 */
export default function TextModePanel({ messages = [], deliveryState, onAction }) {
  const messagesEndRef = useRef(null);

  // Auto-scroll to the latest message whenever the list changes
  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const phase = deliveryState?.phase ?? 'idle';
  const actionsDisabled = phase !== 'active';

  return (
    <section className="ad-text-panel" aria-label="Text mode interaction panel">
      {/* Scrollable message list */}
      <div
        className="ad-text-messages"
        role="log"
        aria-live="polite"
        aria-label="Courier message transcript"
      >
        {messages.length === 0 && (
          <p className="ad-text-empty">No messages yet. Waiting for delivery to start.</p>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`ad-text-message ad-text-message--${msg.sender || 'varun'}`}
          >
            <span className="ad-text-message-time">{formatTimestamp(msg.timestamp)}</span>
            <span className="ad-text-message-sender">{msg.sender ?? 'varun'}</span>
            <span className="ad-text-message-text">{msg.text}</span>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Action buttons */}
      <div className="ad-text-actions" role="group" aria-label="Delivery action buttons">
        <button
          className="ad-text-btn ad-text-btn--safe-place"
          disabled={actionsDisabled}
          aria-label="Confirm safe place for parcel"
          onClick={() => onAction({ type: 'CONFIRM_SAFE_PLACE', location: 'Front porch' })}
        >
          Confirm Safe Place
        </button>
        <button
          className="ad-text-btn ad-text-btn--otp"
          disabled={actionsDisabled}
          aria-label="Request OTP help"
          onClick={() => onAction({ type: 'REQUEST_OTP' })}
        >
          OTP Help
        </button>
        <button
          className="ad-text-btn ad-text-btn--received"
          disabled={actionsDisabled}
          aria-label="Mark parcel as received"
          onClick={() => onAction({ type: 'MARK_RECEIVED' })}
        >
          Mark as Received
        </button>
      </div>
    </section>
  );
}
