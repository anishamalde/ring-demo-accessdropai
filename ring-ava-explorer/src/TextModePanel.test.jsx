import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TextModePanel from './TextModePanel';

const mockMessages = [
  { id: 'msg-1', sender: 'courier', text: 'Hello, I have a parcel for you.', timestamp: 1700000000000 },
  { id: 'msg-2', sender: 'varun', text: 'Safe place confirmed: Front porch', timestamp: 1700000005000 },
];

const idleState = { phase: 'idle', mode: 'text', messages: [], parcelLocation: null, otpCode: null, safePlace: null, startedAt: null, completedAt: null, useMockData: false, error: null };
const activeState = { ...idleState, phase: 'active', startedAt: Date.now() };
const completedState = { ...idleState, phase: 'completed', completedAt: Date.now() };

describe('TextModePanel', () => {
  it('renders empty state when no messages', () => {
    render(<TextModePanel messages={[]} deliveryState={idleState} onAction={() => {}} />);
    expect(screen.getByText('No messages yet. Waiting for delivery to start.')).toBeInTheDocument();
  });

  it('renders messages with text and timestamps', () => {
    render(<TextModePanel messages={mockMessages} deliveryState={activeState} onAction={() => {}} />);
    expect(screen.getByText('Hello, I have a parcel for you.')).toBeInTheDocument();
    expect(screen.getByText('Safe place confirmed: Front porch')).toBeInTheDocument();
  });

  it('renders all three action buttons', () => {
    render(<TextModePanel messages={[]} deliveryState={activeState} onAction={() => {}} />);
    expect(screen.getByRole('button', { name: /confirm safe place/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /request otp help/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /mark parcel as received/i })).toBeInTheDocument();
  });

  it('disables action buttons in idle phase', () => {
    render(<TextModePanel messages={[]} deliveryState={idleState} onAction={() => {}} />);
    expect(screen.getByRole('button', { name: /confirm safe place/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /request otp help/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /mark parcel as received/i })).toBeDisabled();
  });

  it('enables action buttons in active phase', () => {
    render(<TextModePanel messages={[]} deliveryState={activeState} onAction={() => {}} />);
    expect(screen.getByRole('button', { name: /confirm safe place/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /request otp help/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /mark parcel as received/i })).toBeEnabled();
  });

  it('disables action buttons in completed phase', () => {
    render(<TextModePanel messages={[]} deliveryState={completedState} onAction={() => {}} />);
    expect(screen.getByRole('button', { name: /confirm safe place/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /request otp help/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /mark parcel as received/i })).toBeDisabled();
  });

  it('calls onAction with CONFIRM_SAFE_PLACE when button clicked', () => {
    const onAction = vi.fn();
    render(<TextModePanel messages={[]} deliveryState={activeState} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: /confirm safe place/i }));
    expect(onAction).toHaveBeenCalledWith({ type: 'CONFIRM_SAFE_PLACE', location: 'Front porch' });
  });

  it('calls onAction with REQUEST_OTP when OTP Help clicked', () => {
    const onAction = vi.fn();
    render(<TextModePanel messages={[]} deliveryState={activeState} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: /request otp help/i }));
    expect(onAction).toHaveBeenCalledWith({ type: 'REQUEST_OTP' });
  });

  it('calls onAction with MARK_RECEIVED when Mark as Received clicked', () => {
    const onAction = vi.fn();
    render(<TextModePanel messages={[]} deliveryState={activeState} onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: /mark parcel as received/i }));
    expect(onAction).toHaveBeenCalledWith({ type: 'MARK_RECEIVED' });
  });

  it('has ARIA labels on all buttons', () => {
    render(<TextModePanel messages={[]} deliveryState={activeState} onAction={() => {}} />);
    expect(screen.getByRole('button', { name: 'Confirm safe place for parcel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request OTP help' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark parcel as received' })).toBeInTheDocument();
  });

  it('has aria-label on the message transcript region', () => {
    render(<TextModePanel messages={[]} deliveryState={activeState} onAction={() => {}} />);
    expect(screen.getByRole('log')).toHaveAttribute('aria-label', 'Courier message transcript');
  });

  it('has aria-label on the action buttons group', () => {
    render(<TextModePanel messages={[]} deliveryState={activeState} onAction={() => {}} />);
    expect(screen.getByRole('group')).toHaveAttribute('aria-label', 'Delivery action buttons');
  });
});
