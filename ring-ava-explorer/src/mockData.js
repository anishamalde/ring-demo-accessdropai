/**
 * mockData.js
 *
 * Predefined mock courier message sequences for the AccessDrop AI demo.
 * Simulates a realistic doorstep delivery conversation covering:
 * greeting, safe place discussion, OTP exchange, and delivery confirmation.
 */

/**
 * Returns a mock array of messages simulating a full delivery conversation.
 *
 * Each message: { id, sender, text, timestamp, type }
 *   sender: 'courier' | 'customer'
 *   type: 'greeting' | 'safe-place' | 'otp' | 'delivery-confirmation' | 'info'
 *
 * Timestamps are spaced a few seconds apart so timed playback feels natural.
 *
 * @returns {Array<{id: string, sender: string, text: string, timestamp: number, type: string}>}
 */
export function getMockMessages() {
  const base = Date.now();

  return [
    // --- Greeting ---
    {
      id: 'mock-1',
      sender: 'courier',
      text: 'Hello! I have a parcel delivery for this address.',
      timestamp: base,
      type: 'greeting',
    },
    {
      id: 'mock-2',
      sender: 'customer',
      text: 'Person detected at doorstep. Delivery interaction started.',
      timestamp: base + 2000,
      type: 'info',
    },

    // --- Safe place discussion ---
    {
      id: 'mock-3',
      sender: 'customer',
      text: 'Hi, thanks for coming. Could you leave it in a safe place?',
      timestamp: base + 5000,
      type: 'safe-place',
    },
    {
      id: 'mock-4',
      sender: 'courier',
      text: 'Sure, where would you like me to leave it?',
      timestamp: base + 8000,
      type: 'safe-place',
    },
    {
      id: 'mock-5',
      sender: 'customer',
      text: 'By the front porch, behind the plant pot please.',
      timestamp: base + 12000,
      type: 'safe-place',
    },
    {
      id: 'mock-6',
      sender: 'customer',
      text: 'Safe place confirmed: Front porch, behind the plant pot.',
      timestamp: base + 14000,
      type: 'safe-place',
    },

    // --- OTP exchange ---
    {
      id: 'mock-7',
      sender: 'courier',
      text: 'Got it. I need to verify the OTP before I can leave the parcel. Could you share the code?',
      timestamp: base + 18000,
      type: 'otp',
    },
    {
      id: 'mock-8',
      sender: 'customer',
      text: 'Your OTP code is: 482916',
      timestamp: base + 21000,
      type: 'otp',
    },
    {
      id: 'mock-9',
      sender: 'customer',
      text: 'The code is 4-8-2-9-1-6.',
      timestamp: base + 25000,
      type: 'otp',
    },

    // --- Delivery confirmation ---
    {
      id: 'mock-10',
      sender: 'courier',
      text: 'OTP verified, thank you! Placing the parcel by the front porch now.',
      timestamp: base + 29000,
      type: 'delivery-confirmation',
    },
    {
      id: 'mock-11',
      sender: 'courier',
      text: 'All done! Your parcel has been left behind the plant pot on the front porch. Have a great day!',
      timestamp: base + 33000,
      type: 'delivery-confirmation',
    },
    {
      id: 'mock-12',
      sender: 'customer',
      text: 'Delivery completed successfully.',
      timestamp: base + 35000,
      type: 'delivery-confirmation',
    },
  ];
}

/**
 * Returns a mock parcel location description.
 * @returns {string}
 */
export function getMockParcelLocation() {
  return 'Front porch, behind the plant pot on the left side of the door.';
}
