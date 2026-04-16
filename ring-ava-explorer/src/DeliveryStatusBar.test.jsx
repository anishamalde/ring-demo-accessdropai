import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DeliveryStatusBar from './DeliveryStatusBar';

describe('DeliveryStatusBar', () => {
  it('renders idle phase with correct text and class', () => {
    const { container } = render(<DeliveryStatusBar phase="idle" />);
    expect(screen.getByText('Waiting for delivery')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('ad-status-bar', 'ad-status-idle');
  });

  it('renders active phase with correct text and class', () => {
    const { container } = render(<DeliveryStatusBar phase="active" />);
    expect(screen.getByText('Delivery in progress')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('ad-status-bar', 'ad-status-active');
  });

  it('renders completed phase with correct text and class', () => {
    const { container } = render(<DeliveryStatusBar phase="completed" />);
    expect(screen.getByText('Delivery completed')).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('ad-status-bar', 'ad-status-completed');
  });

  it('defaults to idle when no phase prop is provided', () => {
    render(<DeliveryStatusBar />);
    expect(screen.getByText('Waiting for delivery')).toBeInTheDocument();
  });

  it('falls back to idle for an unrecognised phase value', () => {
    render(<DeliveryStatusBar phase="unknown" />);
    expect(screen.getByText('Waiting for delivery')).toBeInTheDocument();
  });

  it('has role="status" for screen reader announcements', () => {
    render(<DeliveryStatusBar phase="active" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('has aria-live="polite" so changes are announced', () => {
    render(<DeliveryStatusBar phase="active" />);
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('has an aria-label describing the delivery status', () => {
    render(<DeliveryStatusBar phase="completed" />);
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label',
      'Delivery status: Delivery completed'
    );
  });
});
