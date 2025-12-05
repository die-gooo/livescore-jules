import { NextResponse } from 'next/server';
import webpush from 'web-push';

/**
 * Temporary API route to generate VAPID keys.
 * 
 * IMPORTANT: After generating keys, save them to your environment variables
 * and DELETE this file - do not leave it in production!
 * 
 * Usage: GET /api/generate-vapid
 * Returns: { publicKey: string, privateKey: string }
 */
export async function GET() {
  try {
    const vapidKeys = webpush.generateVAPIDKeys();
    
    return NextResponse.json({
      publicKey: vapidKeys.publicKey,
      privateKey: vapidKeys.privateKey,
      instructions: [
        "1. Copy these keys and save them securely",
        "2. Add to your .env.local file:",
        "   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<publicKey>",
        "   VAPID_PRIVATE_KEY=<privateKey>",
        "   VAPID_EMAIL=mailto:your@email.com",
        "3. Add the same variables to Vercel Environment Variables",
        "4. DELETE this file (src/app/api/generate-vapid/route.ts) after use!"
      ]
    });
  } catch (error) {
    console.error('Error generating VAPID keys:', error);
    return NextResponse.json(
      { error: 'Failed to generate VAPID keys' },
      { status: 500 }
    );
  }
}
