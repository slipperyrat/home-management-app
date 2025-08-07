'use client';

import { useState } from 'react';
import { useAuth, useUser } from '@clerk/nextjs';

type GameMode = 'single' | 'couple' | 'family' | 'roommates' | 'custom';

interface GameModeOption {
  value: GameMode;
  label: string;
  description: string;
}

const gameModeOptions: GameModeOption[] = [
  {
    value: 'single',
    label: 'Single',
    description: 'Living alone and managing your own space'
  },
  {
    value: 'couple',
    label: 'Couple',
    description: 'Living with a partner or significant other'
  },
  {
    value: 'family',
    label: 'Family',
    description: 'Living with children and/or extended family'
  },
  {
    value: 'roommates',
    label: 'Roommates',
    description: 'Sharing space with friends or acquaintances'
  },
  {
    value: 'custom',
    label: 'Custom',
    description: 'Other household arrangement'
  }
];

export function GameModeSelector() {
  const { isSignedIn, isLoaded } = useAuth();
  const { user } = useUser();
  const [selectedGameMode, setSelectedGameMode] = useState<GameMode | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedGameMode) {
      setError('Please select a household type');
      return;
    }

    if (!isSignedIn || !user?.id) {
      setError('You must be signed in to update household settings');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/update-game-mode', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ game_mode: selectedGameMode }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to update household type');
        return;
      }

      setSuccess(true);
      console.log('Successfully updated game mode to:', selectedGameMode);
    } catch (err) {
      console.error('Error updating game mode:', err);
      setError('An unexpected error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800">Please sign in to configure your household settings.</p>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <p className="text-green-800 font-medium">✅ Household type updated successfully!</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            What type of household is this?
          </h2>
          <p className="text-gray-600 mb-6">
            This helps us customize your experience and provide relevant features.
          </p>
        </div>

        <div className="space-y-3">
          {gameModeOptions.map((option) => (
            <label
              key={option.value}
              className={`flex items-start p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedGameMode === option.value
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <input
                type="radio"
                name="gameMode"
                value={option.value}
                checked={selectedGameMode === option.value}
                onChange={(e) => setSelectedGameMode(e.target.value as GameMode)}
                className="mt-1 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
              />
              <div className="ml-3 flex-1">
                <div className="font-medium text-gray-900">{option.label}</div>
                <div className="text-sm text-gray-500">{option.description}</div>
              </div>
            </label>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!selectedGameMode || isSubmitting}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${
              selectedGameMode && !isSubmitting
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? 'Updating...' : 'Save Household Type'}
          </button>
        </div>
      </form>
    </div>
  );
} 