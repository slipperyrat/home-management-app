'use client';

import { FeatureGatedButton } from './FeatureGatedButton';
import UpgradeModal from './UpgradeModal';
import { useUpgradeModal } from '@/hooks/useUpgradeModal';

interface ExampleFeatureGatedPageProps {
  userPlan: string;
}

export function ExampleFeatureGatedPage({ userPlan }: ExampleFeatureGatedPageProps) {
  const upgradeModal = useUpgradeModal();

  const handleAddEvent = async () => {
    // Simulate opening an event form
    console.log('Opening event form...');
    // In a real app, this would open a modal or navigate to a form
  };

  const handleCreateList = async () => {
    // Simulate creating a new list
    console.log('Creating new list...');
    // In a real app, this would open a form or create the list
  };

  const handleAddReminder = async () => {
    // Simulate adding a reminder
    console.log('Adding reminder...');
    // In a real app, this would open a reminder form
  };

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Feature Examples</h1>
      
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-2">Calendar Features</h2>
          <div className="flex gap-2">
            <FeatureGatedButton
              feature="calendar"
              userPlan={userPlan}
              onClick={handleAddEvent}
            >
              Add Event
            </FeatureGatedButton>
            
            <FeatureGatedButton
              feature="reminders"
              userPlan={userPlan}
              onClick={handleAddReminder}
            >
              Add Reminder
            </FeatureGatedButton>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">Shopping List Features</h2>
          <div className="flex gap-2">
            <FeatureGatedButton
              feature="shopping_list"
              userPlan={userPlan}
              onClick={handleCreateList}
            >
              New List
            </FeatureGatedButton>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-2">XP Rewards (Premium Only)</h2>
          <div className="flex gap-2">
            <FeatureGatedButton
              feature="xp_rewards"
              userPlan={userPlan}
              onClick={() => console.log('Opening XP store...')}
            >
              Open XP Store
            </FeatureGatedButton>
          </div>
        </div>
      </div>

      <UpgradeModal 
        open={upgradeModal.isOpen} 
        onClose={upgradeModal.onClose} 
      />
    </div>
  );
} 