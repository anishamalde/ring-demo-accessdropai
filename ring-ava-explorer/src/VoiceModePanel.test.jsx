import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VoiceModePanel from './VoiceModePanel';

const idleState = { phase: 'idle', mode: 'voice', messages: [], parcelLocation: null, otpCode: null, safePlace: null, startedAt: null, completedAt: null, useMockData: false, error: null };
const activeState = { ...idleState, phase: 'active', startedAt: Date.now() };
const completedState = { ...idleState, phase: 'completed', completedAt: Date.now() };

describe('VoiceModePanel', () => {
  it('renders the speaking indicator as silent when not speaking', () => {
    render(<VoiceModePanel deliveryState={activeState} isSpeaking={false} parcelLocation={null} onAction={() => {}} />);
    expect(screen.getByText('🔇 Silent')).toBeInTheDocument();
  });

  it('renders the speaking indicator as active when speaking', () => {
    render(<VoiceModePanel deliveryState={activeState} isSpeaking={true} parcelLocation={null} onAction={() => {}} />);
    expect(screen.getByText('🔊 Speaking…')).toBeInTheDocument();
  });

  it('applies active CSS class to speaking indicator when speaking', () => {
    const { container } = render(<VoiceModePanel deliveryState={activeState} isSpeaking={true} parcelLocation={null} onAction={() => {}} />);
    const indicator = container.querySelector('.ad-voice-speaking');
    expect(indicator).toHaveClass('ad-voice-speaking--active');
  });

  it('shows delivery status for idle phase', () => {
    render(<VoiceModePanel deliveryState={idleState} isSpeaking={false} parcelLocation={null} onAction={() => {}} />);
    expect(screen.getByText('Waiting for delivery to start.')).toBeInTheDocument();
  });

  it('shows delivery status for active phase', () => {
    render(<VoiceModePanel deliveryState={activeState} isSpeaking={false} parcelLocation={null} onAction={() => {}} />);
    expect(screen.getByText('Delivery in progress.')).toBeInTheDocument();
  });

  it('shows delivery status for completed phase', () => {
    render(<VoiceModePanel deliveryState={completedState} isSpeaking={false} parcelLocation={null} onAction={() => {}} />);
    expect(screen.getByText('Delivery completed.')).toBeInTheDocument();
  });

  it('shows parcel location when provided', () => {
    render(<VoiceModePanel deliveryState={activeState} isSpeaking={false} parcelLocation="Front porch, left side" onAction={() => {}} />);
    expect(screen.getByText('Your parcel is at: Front porch, left side')).toBeInTheDocument();
  });

  it('shows not-yet-confirmed message when no parcel location', () => {
    render(<VoiceModePanel deliveryState={activeState} isSpeaking={false} parcelLocation={null} onAction={() => {}} />);
    expect(screen.getByText('Where is my parcel?')).toBeInTheDocument();
  });

  it('renders both action buttons', () => {
    render(<VoiceModePanel deliveryState={activeState} isSpeaking={false} parcelLocation={null} onAction={() => {}} />);
    expect(screen.getByRole('button', { name: /acknowledge delivery/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /where is my parcel/i })).toBeInTheDocument();
  });

  it('disables action buttons in idle phase', () => {
    render(<VoiceModePanel deliveryState={idleState} isSpeaking={false} parcelLocation={null} onAction={() => {}} />);
    expect(screen.getByRole('button', { name: /acknowledge delivery/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /where is my parcel/i })).toBeDisabled();
  });

  it('enables action buttons in active phase', () => {
    render(<VoiceModePanel deliveryState={activeState} isSpeaking={false} parcelLocation={null} onAction={() => {}} />);
    expect(screen.getByRole('button', { name: /acknowledge delivery/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /where is my parcel/i })).toBeEnabled();
  });

  it('disables action buttons in completed phase', () => {
    render(<VoiceModePanel deliveryState={completedState} isSpeaking={false} parcelLocation={null} onAction={() => {}} />);
    expect(screen.getByRole('button', { name: /acknowledge delivery/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /where is my parcel/i })).toBeDisabled();
  });

  it('calls onAction with ACKNOWLEDGE_DELIVERY when button clicked', () => {
    const onAction = vi.fn();
    render(<VoiceModePanel deliveryState={activeState} isSpeaking={false} parcelLocation={null} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: /acknowledge delivery/i }));
    expect(onAction).toHaveBeenCalledWith({ type: 'ACKNOWLEDGE_DELIVERY' });
  });

  it('calls onAction with WHERE_IS_PARCEL when button clicked', () => {
    const onAction = vi.fn();
    render(<VoiceModePanel deliveryState={activeState} isSpeaking={false} parcelLocation={null} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: /where is my parcel/i }));
    expect(onAction).toHaveBeenCalledWith({ type: 'WHERE_IS_PARCEL' });
  });

  it('uses aria-live="assertive" on the speaking indicator', () => {
    const { container } = render(<VoiceModePanel deliveryState={activeState} isSpeaking={false} parcelLocation={null} onAction={() => {}} />);
    const indicator = container.querySelector('.ad-voice-speaking');
    expect(indicator).toHaveAttribute('aria-live', 'assertive');
  });

  it('uses aria-live="assertive" on the delivery status region', () => {
    const { container } = render(<VoiceModePanel deliveryState={activeState} isSpeaking={false} parcelLocation={null} onAction={() => {}} />);
    const status = container.querySelector('.ad-voice-status');
    expect(status).toHaveAttribute('aria-live', 'assertive');
  });

  it('uses aria-live="assertive" on the parcel location region', () => {
    const { container } = render(<VoiceModePanel deliveryState={activeState} isSpeaking={false} parcelLocation={null} onAction={() => {}} />);
    const location = container.querySelector('.ad-voice-location');
    expect(location).toHaveAttribute('aria-live', 'assertive');
  });

  it('has ARIA labels on both action buttons', () => {
    render(<VoiceModePanel deliveryState={activeState} isSpeaking={false} parcelLocation={null} onAction={() => {}} />);
    expect(screen.getByRole('button', { name: 'Acknowledge delivery' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Where is my parcel?' })).toBeInTheDocument();
  });

  it('has aria-label on the action buttons group', () => {
    render(<VoiceModePanel deliveryState={activeState} isSpeaking={false} parcelLocation={null} onAction={() => {}} />);
    expect(screen.getByRole('group')).toHaveAttribute('aria-label', 'Voice delivery action buttons');
  });

  it('has aria-label on the panel section', () => {
    render(<VoiceModePanel deliveryState={activeState} isSpeaking={false} parcelLocation={null} onAction={() => {}} />);
    expect(screen.getByRole('region', { name: 'Voice mode interaction panel' })).toBeInTheDocument();
  });
});
