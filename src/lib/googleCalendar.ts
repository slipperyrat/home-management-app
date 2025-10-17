import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { logger } from '@/lib/logging/logger';

export interface GoogleCalendarEvent {
  id: string
  summary: string
  description?: string | undefined
  start: {
    dateTime?: string | undefined
    date?: string | undefined
    timeZone?: string | undefined
  }
  end: {
    dateTime?: string | undefined
    date?: string | undefined
    timeZone?: string | undefined
  }
  location?: string | undefined
  attendees?: Array<{
    email?: string | undefined
    displayName?: string | undefined
    responseStatus?: string | undefined
  }> | undefined
  recurrence?: string[] | undefined
  status?: string | undefined
  visibility?: string | undefined
  created?: string | undefined
  updated?: string | undefined
}

export interface GoogleCalendarListEntry {
  id: string
  summary: string
  description?: string | undefined
  accessRole: string
  primary: boolean
  selected: boolean
  timeZone?: string | undefined
  backgroundColor?: string | undefined
  foregroundColor?: string | undefined
}

export class GoogleCalendarService {
  private oauth2Client: OAuth2Client
  private calendar: ReturnType<typeof google.calendar>

  constructor(accessToken: string) {
    this.oauth2Client = new OAuth2Client()
    this.oauth2Client.setCredentials({ access_token: accessToken })
    this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client })
  }

  /**
   * Get list of user's calendars
   */
  async getCalendarList(): Promise<GoogleCalendarListEntry[]> {
    try {
      const response = await this.calendar.calendarList.list({
        maxResults: 100,
        minAccessRole: 'reader',
      })

      const items = response.data.items ?? []

      return items
        .filter((item): item is NonNullable<typeof item> => Boolean(item?.id))
        .map((item): GoogleCalendarListEntry => ({
          id: item.id ?? '',
          summary: item.summary ?? 'Untitled Calendar',
          description: item.description ?? undefined,
          accessRole: item.accessRole ?? 'reader',
          primary: Boolean(item.primary),
          selected: Boolean(item.selected),
          timeZone: item.timeZone ?? undefined,
          backgroundColor: item.backgroundColor ?? undefined,
          foregroundColor: item.foregroundColor ?? undefined,
        }))
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to fetch calendar list')
      logger.error('Error fetching calendar list', err)
      throw new Error('Failed to fetch calendar list')
    }
  }

  /**
   * Get events from a specific calendar
   */
  async getEvents(
    calendarId: string,
    options: {
      timeMin?: string
      timeMax?: string
      maxResults?: number
      singleEvents?: boolean
      orderBy?: string
    } = {},
  ): Promise<GoogleCalendarEvent[]> {
    try {
      const {
        timeMin = new Date().toISOString(),
        timeMax,
        maxResults = 100,
        singleEvents = true,
        orderBy = 'startTime',
      } = options

      const params: calendar_v3.Params$Resource$Events$List = {
        calendarId,
        timeMin,
        maxResults,
        singleEvents,
        orderBy,
      }

      if (timeMax) {
        params.timeMax = timeMax
      }

      const response = await this.calendar.events.list(params)

      const items: calendar_v3.Schema$Event[] = response.data?.items ?? []

      return items
        .filter((item): item is calendar_v3.Schema$Event => Boolean(item?.id))
        .map((item): GoogleCalendarEvent => ({
          id: item.id ?? '',
          summary: item.summary ?? 'No Title',
          description: item.description ?? undefined,
          start: {
            dateTime: item.start?.dateTime ?? undefined,
            date: item.start?.date ?? undefined,
            timeZone: item.start?.timeZone ?? undefined,
          },
          end: {
            dateTime: item.end?.dateTime ?? undefined,
            date: item.end?.date ?? undefined,
            timeZone: item.end?.timeZone ?? undefined,
          },
          location: item.location ?? undefined,
          attendees: item.attendees
            ? item.attendees.map((attendee) => ({
                email: attendee.email ?? undefined,
                displayName: attendee.displayName ?? undefined,
                responseStatus: attendee.responseStatus ?? undefined,
              }))
            : undefined,
          recurrence: item.recurrence ?? undefined,
          status: item.status ?? undefined,
          visibility: item.visibility ?? undefined,
          created: item.created ?? undefined,
          updated: item.updated ?? undefined,
        }))
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Failed to fetch events')
      logger.error('Error fetching events', err)
      throw new Error('Failed to fetch events')
    }
  }

  /**
   * Get events from multiple calendars
   */
  async getEventsFromCalendars(
    calendarIds: string[],
    options: {
      timeMin?: string
      timeMax?: string
      maxResults?: number
    } = {},
  ): Promise<{ calendarId: string; events: GoogleCalendarEvent[] }[]> {
    const results = await Promise.allSettled(
      calendarIds.map(async (calendarId) => {
        const events = await this.getEvents(calendarId, options)
        return { calendarId, events }
      }),
    )

    return results
      .filter((result): result is PromiseFulfilledResult<{ calendarId: string; events: GoogleCalendarEvent[] }> => result.status === 'fulfilled')
      .map((result) => result.value)
  }

  /**
   * Convert Google Calendar event to our internal event format
   */
  static convertToInternalEvent(googleEvent: GoogleCalendarEvent, calendarId: string) {
    const startDate = googleEvent.start.dateTime || googleEvent.start.date;
    const endDate = googleEvent.end.dateTime || googleEvent.end.date;

    if (!startDate) {
      throw new Error('Event must have a start date');
    }

    // Parse dates
    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : new Date(start.getTime() + 60 * 60 * 1000); // Default 1 hour

    // Generate RRULE from recurrence
    let rrule = null;
    if (googleEvent.recurrence && googleEvent.recurrence.length > 0) {
      // Find RRULE in recurrence array
      const rruleLine = googleEvent.recurrence.find(line => line.startsWith('RRULE:'));
      if (rruleLine) {
        rrule = rruleLine.replace('RRULE:', '');
      }
    }

    return {
      title: googleEvent.summary,
      description: googleEvent.description || '',
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      location: googleEvent.location || '',
      is_all_day: !googleEvent.start.dateTime, // All-day if no time component
      rrule,
      visibility: googleEvent.visibility === 'private' ? 'private' : 'public',
      external_id: googleEvent.id,
      external_source: 'google_calendar',
      external_calendar_id: calendarId,
      attendees: googleEvent.attendees?.map((attendee) => ({
        email: attendee.email ?? '',
        name: attendee.displayName || attendee.email || '',
        status: attendee.responseStatus || 'needsAction'
      })) || []
    };
  }
}

/**
 * Create OAuth2 client for Google Calendar API
 */
export function createGoogleOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Missing Google OAuth2 configuration');
  }

  return new OAuth2Client(clientId, clientSecret, redirectUri);
}

/**
 * Generate Google OAuth2 authorization URL
 */
export function getGoogleAuthUrl() {
  const oauth2Client = createGoogleOAuth2Client();
  
  const scopes = [
    'https://www.googleapis.com/auth/calendar.readonly',
    'https://www.googleapis.com/auth/calendar.events.readonly'
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForTokens(code: string) {
  const oauth2Client = createGoogleOAuth2Client();
  
  try {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    throw new Error('Failed to exchange authorization code');
  }
}
