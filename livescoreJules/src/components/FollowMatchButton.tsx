'use client';

import { useState, useEffect } from 'react';
import {
  isPushSupported,
  getDeviceId,
  subscribeToPush,
  requestNotificationPermission,
  getNotificationPermission,
} from '@/lib/pushNotifications';

interface FollowMatchButtonProps {
  matchId: string;
  homeTeam: string;
  awayTeam: string;
}

type FollowState = 'idle' | 'loading' | 'followed' | 'unsupported' | 'denied';

export default function FollowMatchButton({
  matchId,
  homeTeam,
  awayTeam,
}: FollowMatchButtonProps) {
  const [state, setState] = useState<FollowState>('idle');
  const [error, setError] = useState<string | null>(null);

  // Check initial state on mount
  useEffect(() => {
    const checkState = async () => {
      if (!isPushSupported()) {
        setState('unsupported');
        return;
      }

      const permission = getNotificationPermission();
      if (permission === 'denied') {
        setState('denied');
        return;
      }

      // Check if already following this match
      const deviceId = getDeviceId();
      try {
        const res = await fetch(`/api/push/subscribe?matchId=${matchId}&deviceId=${deviceId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.subscribed) {
            setState('followed');
          }
        }
      } catch {
        // Ignore errors, assume not following
      }
    };

    checkState();
  }, [matchId]);

  const handleFollow = async () => {
    if (state === 'unsupported' || state === 'denied') {
      return;
    }

    setState('loading');
    setError(null);

    try {
      // Request permission if needed
      const permission = await requestNotificationPermission();
      if (permission === 'denied') {
        setState('denied');
        return;
      }

      if (permission !== 'granted') {
        setState('idle');
        return;
      }

      // Subscribe to push
      const subscription = await subscribeToPush();
      if (!subscription) {
        setError('Unable to subscribe');
        setState('idle');
        return;
      }

      const deviceId = getDeviceId();
      const subJson = subscription.toJSON();

      // Save subscription to server
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          deviceId,
          endpoint: subJson.endpoint,
          p256dh: subJson.keys?.p256dh,
          auth: subJson.keys?.auth,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to subscribe');
        setState('idle');
        return;
      }

      setState('followed');
    } catch (err) {
      console.error('Error following match:', err);
      setError('An error occurred');
      setState('idle');
    }
  };

  const handleUnfollow = async () => {
    setState('loading');
    setError(null);

    try {
      const deviceId = getDeviceId();

      const res = await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matchId,
          deviceId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to unsubscribe');
        setState('followed');
        return;
      }

      setState('idle');
    } catch (err) {
      console.error('Error unfollowing match:', err);
      setError('An error occurred');
      setState('followed');
    }
  };

  // Render based on state
  if (state === 'unsupported') {
    return (
      <button
        disabled
        className="p-2 rounded-full text-gray-600 cursor-not-allowed"
        title="Push notifications not supported in this browser"
      >
        <BellOffIcon />
      </button>
    );
  }

  if (state === 'denied') {
    return (
      <button
        disabled
        className="p-2 rounded-full text-gray-600 cursor-not-allowed"
        title="Notification permissions denied. Enable in browser settings."
      >
        <BellOffIcon />
      </button>
    );
  }

  if (state === 'loading') {
    return (
      <button
        disabled
        className="p-2 rounded-full text-gray-400 animate-pulse"
      >
        <BellIcon />
      </button>
    );
  }

  if (state === 'followed') {
    return (
      <button
        onClick={handleUnfollow}
        className="p-2 rounded-full text-sky-400 hover:text-sky-300 hover:bg-sky-400/10 transition-colors"
        title={`Stop following ${homeTeam} vs ${awayTeam}`}
      >
        <BellFilledIcon />
        {error && <span className="sr-only">{error}</span>}
      </button>
    );
  }

  return (
    <button
      onClick={handleFollow}
      className="p-2 rounded-full text-gray-400 hover:text-sky-400 hover:bg-sky-400/10 transition-colors"
      title={`Get notifications for ${homeTeam} vs ${awayTeam}`}
    >
      <BellIcon />
      {error && <span className="sr-only">{error}</span>}
    </button>
  );
}

// Bell icon (outline)
function BellIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

// Bell icon (filled)
function BellFilledIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

// Bell off icon (disabled)
function BellOffIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5" />
      <path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </svg>
  );
}
