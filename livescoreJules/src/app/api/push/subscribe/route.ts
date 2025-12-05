import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Use service key if available, otherwise fall back to anon key for development
// In production, SUPABASE_SERVICE_ROLE_KEY should be set
const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET: Check if a subscription exists
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const matchId = searchParams.get('matchId');
    const deviceId = searchParams.get('deviceId');

    if (!matchId || !deviceId) {
      return NextResponse.json({ subscribed: false });
    }

    const { data, error } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('match_id', matchId)
      .eq('device_id', deviceId)
      .maybeSingle();

    if (error) {
      console.error('Error checking subscription:', error);
      return NextResponse.json({ subscribed: false });
    }

    return NextResponse.json({ subscribed: !!data });
  } catch (error) {
    console.error('Error in GET /api/push/subscribe:', error);
    return NextResponse.json({ subscribed: false });
  }
}

// POST: Create or update a subscription
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { matchId, deviceId, endpoint, p256dh, auth } = body;

    // Validate required fields
    if (!matchId || !deviceId || !endpoint || !p256dh || !auth) {
      return NextResponse.json(
        { error: 'Missing required fields: matchId, deviceId, endpoint, p256dh, auth' },
        { status: 400 }
      );
    }

    // Validate field types
    if (
      typeof matchId !== 'string' ||
      typeof deviceId !== 'string' ||
      typeof endpoint !== 'string' ||
      typeof p256dh !== 'string' ||
      typeof auth !== 'string'
    ) {
      return NextResponse.json(
        { error: 'Invalid field types' },
        { status: 400 }
      );
    }

    // Validate endpoint is a URL
    try {
      new URL(endpoint);
    } catch {
      return NextResponse.json(
        { error: 'Invalid endpoint URL' },
        { status: 400 }
      );
    }

    // Upsert the subscription (update if exists, insert if not)
    const { data, error } = await supabase
      .from('push_subscriptions')
      .upsert(
        {
          match_id: matchId,
          device_id: deviceId,
          endpoint,
          p256dh,
          auth,
        },
        {
          onConflict: 'device_id,match_id',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Error saving subscription:', error);
      return NextResponse.json(
        { error: 'Failed to save subscription' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error('Error in POST /api/push/subscribe:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
