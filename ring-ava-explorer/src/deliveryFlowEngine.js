/**
 * deliveryFlowEngine.js
 *
 * Pure state machine for the AccessDrop AI delivery flow.
 * No React, no JSX — just plain logic and state transitions.
 */

/**
 * Creates the default idle delivery state.
 * @returns {DeliveryState}
 */
export function createInitialState() {
  return {
    phase: 'idle',
    mode: 'text',
    messages: [],
    parcelLocation: null,
    otpCode: null,
    safePlace: null,
    startedAt: null,
    completedAt: null,
    useMockData: false,
    error: null,
  };
}

/**
 * Generates a simple 6-digit OTP code.
 * @returns {string}
 */
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Actions valid in each phase.
 */
const VALID_ACTIONS = {
  idle: new Set(['TRIGGER_DOORSTEP', 'SET_MODE', 'SET_MOCK_MODE', 'RESET']),
  active: new Set([
    'CONFIRM_SAFE_PLACE',
    'REQUEST_OTP',
    'MARK_RECEIVED',
    'ACKNOWLEDGE_DELIVERY',
    'SET_MODE',
    'ADD_MESSAGE',
    'SET_ERROR',
  ]),
  completed: new Set(['RESET', 'SET_MODE']),
};

/**
 * Delivery flow reducer — pure function, no side effects.
 *
 * @param {DeliveryState} state  Current state
 * @param {DeliveryAction} action Action to apply
 * @returns {DeliveryState} New state (or same reference if action is invalid)
 */
export function deliveryReducer(state, action) {
  const allowed = VALID_ACTIONS[state.phase];
  if (!allowed || !allowed.has(action.type)) {
    return state;
  }

  switch (action.type) {
    case 'TRIGGER_DOORSTEP':
      return {
        ...state,
        phase: 'active',
        startedAt: Date.now(),
        error: null,
      };

    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.message],
      };

    case 'CONFIRM_SAFE_PLACE': {
      const systemMsg = {
        id: `sys-safe-${Date.now()}`,
        sender: 'system',
        text: `Safe place confirmed: ${action.location}`,
        timestamp: Date.now(),
        isFinal: true,
      };
      return {
        ...state,
        parcelLocation: action.location,
        safePlace: action.location,
        messages: [...state.messages, systemMsg],
      };
    }

    case 'REQUEST_OTP': {
      const otp = generateOtp();
      const otpMsg = {
        id: `sys-otp-${Date.now()}`,
        sender: 'system',
        text: `Your OTP code is: ${otp}`,
        timestamp: Date.now(),
        isFinal: true,
      };
      return {
        ...state,
        otpCode: otp,
        messages: [...state.messages, otpMsg],
      };
    }

    case 'MARK_RECEIVED':
      return {
        ...state,
        phase: 'completed',
        completedAt: Date.now(),
      };

    case 'ACKNOWLEDGE_DELIVERY':
      return {
        ...state,
        phase: 'completed',
        completedAt: Date.now(),
      };

    case 'SET_MODE':
      return {
        ...state,
        mode: action.mode,
      };

    case 'SET_MOCK_MODE':
      return {
        ...state,
        useMockData: action.useMock,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.error,
      };

    case 'RESET':
      return createInitialState();

    default:
      return state;
  }
}
