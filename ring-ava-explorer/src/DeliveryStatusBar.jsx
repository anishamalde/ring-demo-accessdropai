import React from 'react';

const PHASE_CONFIG = {
  idle: {
    label: 'Waiting for delivery',
    className: 'ad-status-idle',
  },
  active: {
    label: 'Delivery in progress',
    className: 'ad-status-active',
  },
  completed: {
    label: 'Delivery completed',
    className: 'ad-status-completed',
  },
};

export default function DeliveryStatusBar({ phase = 'idle' }) {
  const config = PHASE_CONFIG[phase] || PHASE_CONFIG.idle;

  return (
    <div
      className={`ad-status-bar ${config.className}`}
      role="status"
      aria-live="polite"
      aria-label={`Delivery status: ${config.label}`}
    >
      {config.label}
    </div>
  );
}
