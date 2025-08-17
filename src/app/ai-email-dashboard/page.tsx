'use client';

import { useAuth } from '@clerk/nextjs';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ParsedItem {
  id: string;
  item_type: string;
  confidence_score: number;
  extracted_data: any;
  bill_amount?: number;
  bill_due_date?: string;
  bill_provider?: string;
  bill_category?: string;
  receipt_total?: number;
  receipt_date?: string;
  receipt_store?: string;
  receipt_items?: any[];
  event_title?: string;
  event_date?: string;
  event_location?: string;
  event_description?: string;
  user_confirmed: boolean;
  user_modified: boolean;
  created_at: string;
}

interface AISuggestion {
  id: string;
  suggestion_type: string;
  suggestion_data: any;
  ai_reasoning: string;
  user_feedback: 'accepted' | 'rejected' | 'modified' | 'pending';
  user_notes?: string;
  created_at: string;
}

interface EmailQueueEntry {
  id: string;
  email_subject: string;
  email_from: string;
  email_date: string;
  processing_status: 'pending' | 'processing' | 'completed' | 'failed';
  ai_analysis_result?: any;
  error_message?: string;
  created_at: string;
  processed_at?: string;
}

export default function AIEmailDashboard() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  
  const [emailQueue, setEmailQueue] = useState<EmailQueueEntry[]>([]);
  const [parsedItems, setParsedItems] = useState<ParsedItem[]>([]);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'queue' | 'parsed' | 'suggestions'>('queue');

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    fetchData();
  }, [isLoaded, isSignedIn, router]);

  async function fetchData() {
    try {
      setLoading(true);
      
      // Fetch email queue
      const queueResponse = await fetch('/api/ai/email-queue');
      if (queueResponse.ok) {
        const queueData = await queueResponse.json();
        setEmailQueue(queueData.data || []);
      }

      // Fetch parsed items
      const itemsResponse = await fetch('/api/ai/parsed-items');
      if (itemsResponse.ok) {
        const itemsData = await itemsResponse.json();
        setParsedItems(itemsData.data || []);
      }

      // Fetch suggestions
      const suggestionsResponse = await fetch('/api/ai/suggestions');
      if (suggestionsResponse.ok) {
        const suggestionsData = await suggestionsResponse.json();
        setSuggestions(suggestionsData.data || []);
      }

    } catch (error) {
      console.error('Error fetching AI email data:', error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'completed': return 'text-green-600 bg-green-100';
      case 'processing': return 'text-blue-600 bg-blue-100';
      case 'failed': return 'text-red-600 bg-red-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }

  function getItemTypeIcon(itemType: string) {
    switch (itemType) {
      case 'bill': return '💰';
      case 'receipt': return '🧾';
      case 'event': return '📅';
      case 'appointment': return '🏥';
      case 'delivery': return '📦';
      default: return '📧';
    }
  }

  function getSuggestionIcon(suggestionType: string) {
    switch (suggestionType) {
      case 'bill_action': return '💳';
      case 'shopping_list_update': return '🛒';
      case 'calendar_event': return '📅';
      case 'chore_creation': return '✅';
      default: return '💡';
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function formatCurrency(amount: number) {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading AI Email Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 mb-4 flex items-center"
          >
            ← Back
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🤖 AI Email Processing Dashboard
          </h1>
          <p className="text-gray-600">
            Monitor AI-powered email parsing, extracted data, and smart suggestions
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <span className="text-2xl">📧</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Emails</p>
                <p className="text-2xl font-bold text-gray-900">{emailQueue.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <span className="text-2xl">✅</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {emailQueue.filter(e => e.processing_status === 'completed').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <span className="text-2xl">🔍</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Items Extracted</p>
                <p className="text-2xl font-bold text-gray-900">{parsedItems.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <span className="text-2xl">💡</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">AI Suggestions</p>
                <p className="text-2xl font-bold text-gray-900">{suggestions.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('queue')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'queue'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Email Queue ({emailQueue.length})
              </button>
              <button
                onClick={() => setActiveTab('parsed')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'parsed'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Parsed Items ({parsedItems.length})
              </button>
              <button
                onClick={() => setActiveTab('suggestions')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'suggestions'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                AI Suggestions ({suggestions.length})
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'queue' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Email Processing Queue</h3>
                {emailQueue.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No emails in queue</p>
                ) : (
                  emailQueue.map((email) => (
                    <div key={email.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-medium text-gray-900">{email.email_subject}</h4>
                          <p className="text-sm text-gray-600">From: {email.email_from}</p>
                          <p className="text-sm text-gray-500">{formatDate(email.email_date)}</p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(email.processing_status)}`}>
                            {email.processing_status}
                          </span>
                          {email.error_message && (
                            <span className="text-red-600 text-sm" title={email.error_message}>
                              ⚠️ Error
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'parsed' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">AI Extracted Items</h3>
                {parsedItems.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No items extracted yet</p>
                ) : (
                  parsedItems.map((item) => (
                    <div key={item.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-2xl">{getItemTypeIcon(item.item_type)}</span>
                            <h4 className="font-medium text-gray-900 capitalize">{item.item_type}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              item.confidence_score >= 0.8 ? 'bg-green-100 text-green-800' :
                              item.confidence_score >= 0.6 ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {Math.round(item.confidence_score * 100)}% confidence
                            </span>
                          </div>
                          
                          {/* Display item-specific data */}
                          {item.item_type === 'bill' && (
                            <div className="space-y-1">
                              <p className="text-sm"><strong>Provider:</strong> {item.bill_provider}</p>
                              <p className="text-sm"><strong>Amount:</strong> {item.bill_amount ? formatCurrency(item.bill_amount) : 'N/A'}</p>
                              <p className="text-sm"><strong>Due Date:</strong> {item.bill_due_date || 'N/A'}</p>
                              <p className="text-sm"><strong>Category:</strong> {item.bill_category || 'N/A'}</p>
                            </div>
                          )}
                          
                          {item.item_type === 'receipt' && (
                            <div className="space-y-1">
                              <p className="text-sm"><strong>Store:</strong> {item.receipt_store}</p>
                              <p className="text-sm"><strong>Total:</strong> {item.receipt_total ? formatCurrency(item.receipt_total) : 'N/A'}</p>
                              <p className="text-sm"><strong>Date:</strong> {item.receipt_date || 'N/A'}</p>
                              {item.receipt_items && item.receipt_items.length > 0 && (
                                <p className="text-sm"><strong>Items:</strong> {item.receipt_items.length} items</p>
                              )}
                            </div>
                          )}
                          
                          {item.item_type === 'event' && (
                            <div className="space-y-1">
                              <p className="text-sm"><strong>Title:</strong> {item.event_title}</p>
                              <p className="text-sm"><strong>Date:</strong> {item.event_date || 'N/A'}</p>
                              <p className="text-sm"><strong>Location:</strong> {item.event_location || 'N/A'}</p>
                            </div>
                          )}
                          
                          <p className="text-xs text-gray-500 mt-2">
                            Extracted: {formatDate(item.created_at)}
                          </p>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {item.user_confirmed && (
                            <span className="text-green-600 text-sm">✓ Confirmed</span>
                          )}
                          {item.user_modified && (
                            <span className="text-blue-600 text-sm">✏️ Modified</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'suggestions' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 mb-4">AI Suggestions</h3>
                {suggestions.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No AI suggestions yet</p>
                ) : (
                  suggestions.map((suggestion) => (
                    <div key={suggestion.id} className="border rounded-lg p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-2xl">{getSuggestionIcon(suggestion.suggestion_type)}</span>
                            <h4 className="font-medium text-gray-900 capitalize">
                              {suggestion.suggestion_type.replace('_', ' ')}
                            </h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              suggestion.user_feedback === 'accepted' ? 'bg-green-100 text-green-800' :
                              suggestion.user_feedback === 'rejected' ? 'bg-red-100 text-red-800' :
                              suggestion.user_feedback === 'modified' ? 'bg-blue-100 text-blue-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {suggestion.user_feedback}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-700 mb-2">{suggestion.ai_reasoning}</p>
                          
                          <div className="text-xs text-gray-500">
                            <p><strong>Type:</strong> {suggestion.suggestion_type}</p>
                            <p><strong>Created:</strong> {formatDate(suggestion.created_at)}</p>
                            {suggestion.user_notes && (
                              <p><strong>Notes:</strong> {suggestion.user_notes}</p>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="text-center space-x-4">
          <button
            onClick={fetchData}
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700"
          >
            Refresh Data
          </button>
          
          <a
            href="/ai-email-dashboard/test-email"
            className="inline-block bg-green-600 text-white px-6 py-2 rounded-md hover:bg-green-700"
          >
            🧪 Test Email Processing
          </a>
        </div>
      </div>
    </div>
  );
}
