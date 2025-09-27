import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase environment configuration.');
  process.exit(1);
}

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

type SessionRow = {
  user_id: string;
  session_token: string;
  ip_address: string | null;
  user_agent: string | null;
  last_activity: string;
  created_at: string;
  expires_at: string;
};

type SessionAnomaly = {
  userId: string;
  sessions: SessionRow[];
  type: 'expired' | 'stale' | 'concurrent';
  details: string;
};

function isExpired(session: SessionRow, now: Date) {
  return new Date(session.expires_at) < now;
}

function isStale(session: SessionRow, now: Date) {
  const lastActivity = new Date(session.last_activity);
  const diffHours = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
  return diffHours > 12 && new Date(session.expires_at) > now;
}

function groupByUser(rows: SessionRow[]): Map<string, SessionRow[]> {
  return rows.reduce((map, session) => {
    const existing = map.get(session.user_id) || [];
    existing.push(session);
    map.set(session.user_id, existing);
    return map;
  }, new Map<string, SessionRow[]>());
}

function formatSession(session: SessionRow) {
  return `${session.session_token.slice(0, 8)}… | last=${session.last_activity} | expires=${session.expires_at} | ip=${session.ip_address ?? 'n/a'}`;
}

export async function auditSessions(now: Date = new Date()) {
  console.log('🔎 Running session health audit…');

  const { data, error } = await client
    .from<SessionRow>('user_sessions')
    .select('*')
    .order('user_id')
    .limit(5000);

  if (error) {
    console.error('Failed to fetch user_sessions:', error);
    process.exit(1);
  }

  const anomalies: SessionAnomaly[] = [];
  const grouped = groupByUser(data ?? []);

  for (const [userId, sessions] of grouped.entries()) {
    const expired = sessions.filter((session) => isExpired(session, now));
    const stale = sessions.filter((session) => isStale(session, now));
    const concurrent = sessions.length > 3 ? sessions : [];

    if (expired.length > 0) {
      anomalies.push({
        userId,
        sessions: expired,
        type: 'expired',
        details: `${expired.length} expired session(s)`
      });
    }

    if (stale.length > 0) {
      anomalies.push({
        userId,
        sessions: stale,
        type: 'stale',
        details: `${stale.length} stale session(s) (>12h inactivity)`
      });
    }

    if (concurrent.length > 0) {
      anomalies.push({
        userId,
        sessions,
        type: 'concurrent',
        details: `${sessions.length} simultaneous sessions`
      });
    }
  }

  if (anomalies.length === 0) {
    console.log('✅ No session anomalies detected.');
    return;
  }

  console.log(`⚠️ Detected ${anomalies.length} anomaly group(s)`);

  for (const anomaly of anomalies) {
    console.log(`\nUser: ${anomaly.userId}`);
    console.log(`Type: ${anomaly.type}`);
    console.log(`Details: ${anomaly.details}`);
    anomaly.sessions.forEach((session) => {
      console.log(`  - ${formatSession(session)}`);
    });
  }

  console.log('\nℹ️ Recommendation: consider revoking expired/stale sessions or notifying the user.');
}

if (require.main === module) {
  auditSessions().catch((err) => {
    console.error('Session health audit failed:', err);
    process.exit(1);
  });
}
