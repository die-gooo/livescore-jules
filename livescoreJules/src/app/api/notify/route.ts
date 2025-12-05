import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { sendPushNotifications, PushPayload } from '@/lib/webPush';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Admin client for database operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    // 1. Check authentication using SSR client
    const cookieStore = await cookies();
    const supabaseAuth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignore cookie errors in API routes
            }
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // 2. Check user role in user_profiles
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 403 }
      );
    }

    // Check if user has admin role (assuming 'admin' or 'editor' roles can send notifications)
    const allowedRoles = ['admin', 'editor'];
    if (!allowedRoles.includes(profile.role)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      );
    }

    // 3. Parse request body
    const body = await request.json();
    const { matchId, title, body: notificationBody, homeTeam, awayTeam, homeScore, awayScore, status } = body;

    if (!matchId) {
      return NextResponse.json(
        { error: 'matchId is required' },
        { status: 400 }
      );
    }

    // 4. Fetch all subscriptions for this match
    const { data: subscriptions, error: subError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth')
      .eq('match_id', matchId);

    if (subError) {
      console.error('Error fetching subscriptions:', subError);
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions' },
        { status: 500 }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        failed: 0,
        message: 'No subscribers for this match',
      });
    }

    // 5. Build notification payload
    const payload: PushPayload = {
      title: title || `${homeTeam || 'Home'} vs ${awayTeam || 'Away'}`,
      body: notificationBody || buildNotificationBody(homeTeam, awayTeam, homeScore, awayScore, status),
      url: '/',
      matchId,
    };

    // 6. Send notifications (errors are logged but don't break the flow)
    const result = await sendPushNotifications(subscriptions, payload);

    return NextResponse.json({
      success: true,
      sent: result.sent,
      failed: result.failed,
    });
  } catch (error) {
    console.error('Error in POST /api/notify:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function buildNotificationBody(
  homeTeam?: string,
  awayTeam?: string,
  homeScore?: number,
  awayScore?: number,
  status?: string
): string {
  const home = homeTeam || 'Home';
  const away = awayTeam || 'Away';
  
  if (homeScore !== undefined && awayScore !== undefined) {
    const score = `${homeScore} - ${awayScore}`;
    if (status) {
      return `${home} ${score} ${away} • ${status}`;
    }
    return `${home} ${score} ${away}`;
  }
  
  if (status) {
    return `${home} vs ${away} • ${status}`;
  }
  
  return `${home} vs ${away}`;
}
