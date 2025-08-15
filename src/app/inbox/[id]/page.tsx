import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import Link from 'next/link';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

interface PageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EventDetailPage({ params }: PageProps) {
  const { userId } = await auth();
  const resolvedParams = await params;
  
  if (!userId) {
    redirect('/sign-in');
  }

  const supabase = createServerComponentClient({ cookies });
  
  // Get user's household
  const { data: userData } = await supabase
    .from('users')
    .select('household_id')
    .eq('clerk_id', userId)
    .single();

  if (!userData?.household_id) {
    redirect('/onboarding');
  }

  // Get the specific event
  const { data: event, error } = await supabase
    .from('household_events')
    .select('*')
    .eq('id', resolvedParams.id)
    .eq('household_id', userData.household_id)
    .single();

  if (error || !event) {
    notFound();
  }

  const formatEventType = (type: string) => {
    return type.split('.').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatSource = (source: string) => {
    if (source === 'app') return 'App';
    if (source.startsWith('webhook:')) return source.replace('webhook:', 'Webhook: ');
    if (source === 'automation') return 'Automation';
    return source;
  };

  const getEventIcon = (type: string) => {
    if (type.includes('bill')) return '💰';
    if (type.includes('chore')) return '✅';
    if (type.includes('shopping')) return '🛒';
    if (type.includes('heartbeat')) return '💓';
    if (type.includes('notify')) return '🔔';
    return '📋';
  };

  const getEventColor = (type: string) => {
    if (type.includes('bill')) return 'text-blue-600 bg-blue-100';
    if (type.includes('chore')) return 'text-green-600 bg-green-100';
    if (type.includes('shopping')) return 'text-purple-600 bg-purple-100';
    if (type.includes('heartbeat')) return 'text-gray-600 bg-gray-100';
    if (type.includes('notify')) return 'text-orange-600 bg-orange-100';
    return 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/inbox"
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800 mb-4"
          >
            <ArrowLeftIcon className="h-4 w-4 mr-1" />
            Back to Inbox
          </Link>
          
          <div className="flex items-center space-x-3">
            <span className="text-3xl">{getEventIcon(event.type)}</span>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {formatEventType(event.type)}
              </h1>
              <p className="text-gray-600">
                Event details and metadata
              </p>
            </div>
          </div>
        </div>

        {/* Event Summary */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Event Summary</h2>
          </div>
          
          <div className="px-6 py-4">
            <dl className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-sm font-medium text-gray-500">Event Type</dt>
                <dd className="mt-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEventColor(event.type)}`}>
                    {formatEventType(event.type)}
                  </span>
                </dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Source</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatSource(event.source)}</dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Occurred At</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(event.occurred_at).toLocaleString()}
                </dd>
              </div>
              
              <div>
                <dt className="text-sm font-medium text-gray-500">Created At</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {new Date(event.created_at).toLocaleString()}
                </dd>
              </div>
              
              <div className="sm:col-span-2">
                <dt className="text-sm font-medium text-gray-500">Event ID</dt>
                <dd className="mt-1 text-sm text-gray-900 font-mono">{event.id}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Event Payload */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Event Data</h2>
          </div>
          
          <div className="px-6 py-4">
            {Object.keys(event.payload).length > 0 ? (
              <pre className="bg-gray-50 p-4 rounded-md text-sm text-gray-700 overflow-x-auto">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            ) : (
              <div className="text-gray-500 text-center py-8">
                No additional data for this event
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
