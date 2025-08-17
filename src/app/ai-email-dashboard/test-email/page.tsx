'use client';

import { useAuth } from '@clerk/nextjs';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TestEmailPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const router = useRouter();
  
  const [emailData, setEmailData] = useState({
    subject: '',
    body: '',
    from: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }
  }, [isLoaded, isSignedIn, router]);

  async function processTestEmail() {
    try {
      setLoading(true);
      setError(null);
      setResult(null);

      const response = await fetch('/api/ai/process-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailData })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to process email');
      }

      setResult(data);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }

  function loadSampleEmail(type: 'bill' | 'receipt' | 'appointment') {
    switch (type) {
      case 'bill':
        setEmailData({
          subject: 'Your Origin Energy Bill - Due 15 Feb 2024',
          body: `Dear Customer,

Your Origin Energy bill is now available.

Account Number: 12345678
Bill Period: 15 Dec 2023 - 15 Jan 2024
Due Date: 15 Feb 2024
Amount Due: $125.50

This bill covers your electricity usage for the period shown above. Please ensure payment is received by the due date to avoid any late payment fees.

You can pay online at originenergy.com.au or call us on 13 24 61.

Thank you for choosing Origin Energy.

Best regards,
Origin Energy Team`,
          from: 'billing@originenergy.com.au',
          date: new Date().toISOString().split('T')[0]
        });
        break;

      case 'receipt':
        setEmailData({
          subject: 'Your Coles Online Order Receipt',
          body: `Thank you for your Coles Online order!

Order Number: CO123456789
Order Date: 15 Jan 2024
Delivery Date: 16 Jan 2024

Items:
- Milk (2L) x2 - $7.00
- Bread (Wholemeal) x1 - $4.20
- Eggs (12 pack) x1 - $6.50
- Bananas (1kg) x1 - $3.80
- Chicken Breast (500g) x1 - $8.50

Subtotal: $30.00
Delivery Fee: $2.00
Total: $32.00

Your order will be delivered between 2:00 PM - 6:00 PM on 16 Jan 2024.

Thank you for shopping with Coles!`,
          from: 'receipts@coles.com.au',
          date: new Date().toISOString().split('T')[0]
        });
        break;

      case 'appointment':
        setEmailData({
          subject: 'Dentist Appointment Confirmation - 20 Feb 2024',
          body: `Dear Patient,

Your dental appointment has been confirmed.

Appointment Details:
Date: 20 Feb 2024
Time: 2:00 PM
Duration: 45 minutes
Type: Regular Checkup & Clean

Location: 123 Dental Clinic
Address: 123 Main Street, Melbourne VIC 3000
Phone: (03) 9123 4567

Please arrive 10 minutes before your appointment time. If you need to reschedule or cancel, please call us at least 24 hours in advance.

What to bring:
- Medicare card
- Any relevant medical history
- List of current medications

We look forward to seeing you!

Best regards,
123 Dental Clinic Team`,
          from: 'appointments@123dental.com.au',
          date: new Date().toISOString().split('T')[0]
        });
        break;
    }
  }

  if (!isLoaded) {
    return <div>Loading...</div>;
  }

  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => router.back()}
            className="text-blue-600 hover:text-blue-700 mb-4 flex items-center"
          >
            ← Back to AI Dashboard
          </button>
          
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            🧪 Test AI Email Processing
          </h1>
          <p className="text-gray-600">
            Submit test emails to see how the AI processes and extracts information
          </p>
        </div>

        {/* Sample Email Buttons */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Load Sample Emails</h3>
          <div className="flex space-x-4">
            <button
              onClick={() => loadSampleEmail('bill')}
              className="bg-blue-100 text-blue-700 px-4 py-2 rounded-md hover:bg-blue-200"
            >
              💰 Sample Bill
            </button>
            <button
              onClick={() => loadSampleEmail('receipt')}
              className="bg-green-100 text-green-700 px-4 py-2 rounded-md hover:bg-green-200"
            >
              🧾 Sample Receipt
            </button>
            <button
              onClick={() => loadSampleEmail('appointment')}
              className="bg-purple-100 text-purple-700 px-4 py-2 rounded-md hover:bg-purple-200"
            >
              📅 Sample Appointment
            </button>
          </div>
        </div>

        {/* Email Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Email Data</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject
              </label>
              <input
                type="text"
                value={emailData.subject}
                onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Email subject..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                From
              </label>
              <input
                type="email"
                value={emailData.from}
                onChange={(e) => setEmailData({ ...emailData, from: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="sender@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date
              </label>
              <input
                type="date"
                value={emailData.date}
                onChange={(e) => setEmailData({ ...emailData, date: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Body
              </label>
              <textarea
                value={emailData.body}
                onChange={(e) => setEmailData({ ...emailData, body: e.target.value })}
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Email body content..."
              />
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={processTestEmail}
              disabled={loading || !emailData.subject || !emailData.body}
              className="bg-blue-600 text-white px-6 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : '🚀 Process with AI'}
            </button>
          </div>
        </div>

        {/* Results */}
        {result && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">✅ Processing Results</h3>
            
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-green-800">
                  <strong>Success!</strong> Email processed in {result.data.processingTime}ms
                </p>
                <p className="text-green-700 text-sm mt-1">
                  Queue ID: {result.data.queueId}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                  <h4 className="font-medium text-blue-900 mb-2">📊 Parsed Items</h4>
                  <p className="text-blue-800 text-2xl font-bold">{result.data.parsedItems}</p>
                  <p className="text-blue-700 text-sm">Items extracted from email</p>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                  <h4 className="font-medium text-yellow-900 mb-2">💡 AI Suggestions</h4>
                  <p className="text-yellow-800 text-2xl font-bold">{result.data.suggestions}</p>
                  <p className="text-yellow-700 text-sm">Smart suggestions generated</p>
                </div>
              </div>

              <div className="mt-4">
                <a
                  href="/ai-email-dashboard"
                  className="text-blue-600 hover:text-blue-700 underline"
                >
                  View results in AI Dashboard →
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <h3 className="text-lg font-medium text-red-900 mb-2">❌ Error</h3>
            <p className="text-red-800">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
