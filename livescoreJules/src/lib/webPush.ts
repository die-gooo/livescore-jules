import webpush from 'web-push';

// Configure VAPID details for web push
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
const vapidEmail = process.env.VAPID_EMAIL || 'mailto:admin@example.com';

if (!vapidPublicKey || !vapidPrivateKey) {
  console.warn(
    'VAPID keys not configured. Push notifications will not work. ' +
    'Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY environment variables.'
  );
}

// Only set VAPID details if keys are available
if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(vapidEmail, vapidPublicKey, vapidPrivateKey);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  matchId?: string;
}

export interface PushSubscriptionData {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

/**
 * Send a push notification to a single subscription
 * Returns true if successful, false if failed (subscription may be invalid)
 */
export async function sendPushNotification(
  subscription: PushSubscriptionData,
  payload: PushPayload
): Promise<boolean> {
  if (!vapidPublicKey || !vapidPrivateKey) {
    console.error('VAPID keys not configured');
    return false;
  }

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      JSON.stringify(payload)
    );
    return true;
  } catch (error: unknown) {
    // Handle expired or invalid subscriptions
    const webPushError = error as { statusCode?: number };
    if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
      // Subscription is no longer valid
      console.log('Subscription expired or invalid:', subscription.endpoint);
    } else {
      console.error('Error sending push notification:', error);
    }
    return false;
  }
}

/**
 * Send push notifications to multiple subscriptions
 * Returns count of successful sends
 */
export async function sendPushNotifications(
  subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const success = await sendPushNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        payload
      );
      return success;
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      sent++;
    } else {
      failed++;
    }
  }

  return { sent, failed };
}

export { vapidPublicKey };
