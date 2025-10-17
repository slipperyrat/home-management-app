'use client';

import React, { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { usePendingConfirmations, useConfirmAutoAddedItems } from '@/hooks/useAutoAddedItems';
import { formatDistanceToNow } from 'date-fns';

interface AutoAddedItemsConfirmationProps {
  className?: string;
}

export function AutoAddedItemsConfirmation({ className }: AutoAddedItemsConfirmationProps) {
  const { isSignedIn, isLoaded } = useAuth();
  const { data: pendingItems = [], isLoading, error } = usePendingConfirmations();
  const { mutate: confirmItems, isPending: isConfirming } = useConfirmAutoAddedItems();
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Don't render if user is not authenticated or auth is still loading
  if (!isLoaded || !isSignedIn) {
    return null;
  }

  const handleSelectItem = (itemId: string, checked: boolean) => {
    const newSelected = new Set(selectedItems);
    if (checked) {
      newSelected.add(itemId);
    } else {
      newSelected.delete(itemId);
    }
    setSelectedItems(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(pendingItems.map(item => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleConfirmSelected = async () => {
    const itemIds = Array.from(selectedItems);
    if (itemIds.length === 0) return;

    confirmItems({
      item_ids: itemIds,
      action: 'confirm'
    });
    setSelectedItems(new Set());
  };

  const handleConfirmItem = async (itemId: string) => {
    confirmItems({
      item_ids: [itemId],
      action: 'confirm'
    });
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">🔄 Auto-Added Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="text-lg">🔄 Auto-Added Items</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-red-600 text-sm">
            Failed to load auto-added items: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pendingItems.length === 0) {
    return null; // Don't show the card if there are no pending items
  }

  const allSelected = pendingItems.length > 0 && selectedItems.size === pendingItems.length;
  const someSelected = selectedItems.size > 0 && selectedItems.size < pendingItems.length;

  return (
    <Card className={`border-blue-200 bg-blue-50 ${className}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg text-blue-900">
            🔄 Auto-Added Items ({pendingItems.length})
          </CardTitle>
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Pending Confirmation
          </Badge>
        </div>
        <p className="text-sm text-blue-700">
          Items automatically added from your meal plan. Review and confirm what you want to keep.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Select All Controls */}
        <div className="flex items-center justify-between p-3 bg-blue-100 rounded-lg">
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={someSelected ? true : allSelected}
              onChange={(event) => handleSelectAll(event.target.checked)}
              aria-checked={someSelected ? 'mixed' : allSelected}
            />
            <span className="text-sm font-medium text-blue-900">
              Select All ({selectedItems.size}/{pendingItems.length})
            </span>
          </div>
          
          {selectedItems.size > 0 && (
            <div className="flex space-x-2">
              <Button
                size="sm"
                onClick={handleConfirmSelected}
                disabled={isConfirming}
                className="bg-green-600 hover:bg-green-700"
              >
                ✅ Confirm Selected
              </Button>
            </div>
          )}
        </div>

        {/* Individual Items */}
        <div className="space-y-2">
          {pendingItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-200"
            >
              <div className="flex items-center space-x-3 flex-1">
                <Checkbox
                  checked={selectedItems.has(item.id)}
                  onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                />
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-900">{item.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {item.quantity}
                    </Badge>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    From: {item.recipe_title} • Added {formatDistanceToNow(new Date(item.auto_added_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleConfirmItem(item.id)}
                  disabled={isConfirming}
                  className="text-green-700 border-green-300 hover:bg-green-50"
                >
                  ✅
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="flex justify-center space-x-4 pt-2">
          <Button
            onClick={() => handleConfirmSelected()}
            disabled={selectedItems.size === 0 || isConfirming}
            className="bg-green-600 hover:bg-green-700"
          >
            ✅ Confirm All Selected
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedItems(new Set(pendingItems.map(item => item.id)));
              handleConfirmSelected();
            }}
            disabled={isConfirming}
            className="border-green-600 text-green-700 hover:bg-green-50"
          >
            ✅ Confirm All Items
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
