interface ErrorDisplayProps {
  error: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorDisplay({ error, onRetry, className = '' }: ErrorDisplayProps) {
  return (
    <div className={`bg-white shadow rounded-lg p-6 max-w-md w-full mx-4 ${className}`}>
      <div className="text-center">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">Error</h1>
        <p className="text-gray-600 mb-4">{error}</p>
        {onRetry ? <button 
            onClick={onRetry}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button> : null}
      </div>
    </div>
  );
}
