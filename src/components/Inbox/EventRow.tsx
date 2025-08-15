'use client';

import { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface HouseholdEvent {
  id: string;
  type: string;
  source: string;
  payload: Record<string, any>;
  occurred_at: string;
  created_at: string;
}

interface EventRowProps {
  event: HouseholdEvent;
}

export default function EventRow({ event }: EventRowProps) {
  const [showPayload, setShowPayload] = useState(false);

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
    <div className="px-6 py-4 hover:bg-gray-50 transition-colors">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <span className="text-2xl">{getEventIcon(event.type)}</span>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getEventColor(event.type)}`}>
                {formatEventType(event.type)}
              </span>
              <span className="text-sm text-gray-500">
                from {formatSource(event.source)}
              </span>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">
                {formatDistanceToNow(new Date(event.occurred_at), { addSuffix: true })}
              </span>
              
              <button
                onClick={() => setShowPayload(!showPayload)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showPayload ? 'Hide' : 'Show'} Details
              </button>
              
              <Link
                href={`/inbox/${event.id}`}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                View Full
              </Link>
            </div>
          </div>
          
          {showPayload && Object.keys(event.payload).length > 0 && (
            <div className="mt-3 p-3 bg-gray-50 rounded-md">
              <pre className="text-xs text-gray-700 whitespace-pre-wrap">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </div>
          )}
          
          {Object.keys(event.payload).length === 0 && (
            <div className="mt-1 text-sm text-gray-500">
              No additional data
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
