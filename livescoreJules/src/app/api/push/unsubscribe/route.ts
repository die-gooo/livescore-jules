import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { matchId, deviceId } = body;

    // Validate required fields
    if (!matchId || !deviceId) {
      return NextResponse.json(
        { error: 'Missing required fields: matchId, deviceId' },
        { status: 400 }
      );
    }

    // Validate field types
    if (typeof matchId !== 'string' || typeof deviceId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid field types' },
        { status: 400 }
      );
    }

    // Delete the subscription
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('match_id', matchId)
      .eq('device_id', deviceId);

    if (error) {
      console.error('Error deleting subscription:', error);
      return NextResponse.json(
        { error: 'Failed to delete subscription' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST /api/push/unsubscribe:', error);
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 }
    );
  }
}
