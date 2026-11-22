// supabase/functions/_shared/google.ts
// Google OAuth & Calendar API Client

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

export interface GoogleEventPayload {
  id?: string;
  summary: string;
  description?: string;
  start: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  extendedProperties?: {
    private?: Record<string, string>;
  };
}

/**
 * Exchanges an authorization code for access & refresh tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<GoogleTokens> {
  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token exchange failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Refreshes an expired Google access token using a refresh token.
 */
export async function refreshGoogleAccessToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number }> {
  const params = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (errorData.error === 'invalid_grant') {
      throw new Error('TOKEN_REVOKED: Refresh token is invalid or revoked by user.');
    }
    throw new Error(`Google token refresh failed (${response.status}): ${JSON.stringify(errorData)}`);
  }

  return response.json();
}

/**
 * Retrieves the Google account email from userinfo API.
 */
export async function getGoogleAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.ok) {
      const data = await response.json();
      return data.email || null;
    }
  } catch (err) {
    console.warn('Failed to fetch userinfo email from Google:', err);
  }
  return null;
}

/**
 * Revokes Google OAuth access/refresh token.
 */
export async function revokeGoogleToken(token: string): Promise<boolean> {
  try {
    const response = await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.ok;
  } catch (err) {
    console.warn('Google token revocation error:', err);
    return false;
  }
}

/**
 * Formats a task into a Google Calendar event resource matching Cases A, B, C, D, E.
 */
export function formatCalendarEvent(
  task: {
    title: string;
    description?: string | null;
    scheduled_date: string | null;
    scheduled_start_time?: string | null;
    planned_duration_minutes?: number | null;
  },
  timezone: string = 'Asia/Kolkata',
  defaultDurationMinutes: number = 60
): GoogleEventPayload | null {
  if (!task.scheduled_date) {
    return null; // Case E: Inbox task has no scheduled date -> no event
  }

  const summary = task.title.trim();
  const description = task.description ? task.description.trim() : undefined;

  // Case A: Date only (no start time) -> All-day event
  if (!task.scheduled_start_time) {
    // Exclusive end date: next calendar day
    const [y, m, d] = task.scheduled_date.split('-').map(Number);
    const nextDate = new Date(y, m - 1, d + 1);
    const nextY = nextDate.getFullYear();
    const nextM = String(nextDate.getMonth() + 1).padStart(2, '0');
    const nextD = String(nextDate.getDate()).padStart(2, '0');
    const endDateIso = `${nextY}-${nextM}-${nextD}`;

    return {
      summary,
      description,
      start: { date: task.scheduled_date },
      end: { date: endDateIso },
    };
  }

  // Case B, C, D: Timed event
  const startTime = task.scheduled_start_time.slice(0, 5); // HH:mm
  const [sh, sm] = startTime.split(':').map(Number);

  // Duration in minutes: Case C (planned duration) or Case D (default duration)
  const durationMinutes =
    task.planned_duration_minutes && task.planned_duration_minutes > 0
      ? task.planned_duration_minutes
      : defaultDurationMinutes > 0
        ? defaultDurationMinutes
        : 60;

  // Calculate end time by adding duration minutes
  const totalStartMinutes = sh * 60 + sm;
  const totalEndMinutes = totalStartMinutes + durationMinutes;

  const endH = Math.floor(totalEndMinutes / 60) % 24;
  const endM = totalEndMinutes % 60;
  const daysAdded = Math.floor(totalEndMinutes / 1440);

  const [y, m, d] = task.scheduled_date.split('-').map(Number);
  const endDateObj = new Date(y, m - 1, d + daysAdded);
  const endY = endDateObj.getFullYear();
  const endMonth = String(endDateObj.getMonth() + 1).padStart(2, '0');
  const endDay = String(endDateObj.getDate()).padStart(2, '0');

  const startIso = `${task.scheduled_date}T${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}:00`;
  const endIso = `${endY}-${endMonth}-${endDay}T${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}:00`;

  return {
    summary,
    description,
    start: {
      dateTime: startIso,
      timeZone: timezone,
    },
    end: {
      dateTime: endIso,
      timeZone: timezone,
    },
  };
}

/**
 * Creates a new event in Google Calendar.
 * Supports custom deterministic event ID (base32hex, 5-1024 chars).
 * Returns status 409 Conflict if an event with that ID already exists.
 */
export async function createGoogleCalendarEvent(
  accessToken: string,
  calendarId: string = 'primary',
  event: GoogleEventPayload
): Promise<{ id: string; alreadyExists?: boolean }> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (response.status === 409) {
    // Event with this custom ID already exists in Google Calendar
    return { id: event.id || '', alreadyExists: true };
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Calendar create event failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Lists events from Google Calendar within an optional time range or search query.
 */
export async function listGoogleCalendarEvents(
  accessToken: string,
  calendarId: string = 'primary',
  options?: { timeMin?: string; timeMax?: string; q?: string }
): Promise<Array<{
  id: string;
  summary?: string;
  description?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
  extendedProperties?: { private?: Record<string, string> };
}>> {
  const params = new URLSearchParams();
  if (options?.timeMin) params.set('timeMin', options.timeMin);
  if (options?.timeMax) params.set('timeMax', options.timeMax);
  if (options?.q) params.set('q', options.q);
  params.set('singleEvents', 'true');
  params.set('maxResults', '250');

  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params.toString()}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Calendar list events failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return data.items || [];
}

/**
 * Updates an existing event in Google Calendar.
 */
export async function updateGoogleCalendarEvent(
  accessToken: string,
  calendarId: string = 'primary',
  eventId: string,
  event: GoogleEventPayload
): Promise<{ id: string }> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(event),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google Calendar update event failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

/**
 * Deletes an event in Google Calendar.
 * Handles 404/410 as successful deletion (already removed).
 */
export async function deleteGoogleCalendarEvent(
  accessToken: string,
  calendarId: string = 'primary',
  eventId: string
): Promise<boolean> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`;
  const response = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (response.status === 404 || response.status === 410 || response.status === 204 || response.ok) {
    return true;
  }

  const errorText = await response.text();
  throw new Error(`Google Calendar delete event failed (${response.status}): ${errorText}`);
}
