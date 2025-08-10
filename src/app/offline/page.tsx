"use client";

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="mx-auto w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <span className="text-4xl">📱</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            You're Offline
          </h1>
          <p className="text-gray-600">
            It looks like you're not connected to the internet. Don't worry, you can still use some features of the Home Management App!
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            What you can do offline:
          </h2>
          <ul className="text-left space-y-2 text-gray-600">
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              View your dashboard
            </li>
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Browse cached meal plans
            </li>
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              Check completed chores
            </li>
            <li className="flex items-center">
              <span className="text-green-500 mr-2">✓</span>
              View shopping lists
            </li>
          </ul>
        </div>

        <div className="bg-blue-50 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-700">
            <strong>Tip:</strong> Changes you make offline will sync automatically when you reconnect to the internet.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>

        <p className="text-xs text-gray-500 mt-4">
          This app works best with an internet connection
        </p>
      </div>
    </div>
  );
}
