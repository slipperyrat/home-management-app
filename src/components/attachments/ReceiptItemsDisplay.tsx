'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  ShoppingCart,
  CheckCircle,
  AlertCircle,
  Receipt,
  Calendar,
  MapPin,
  DollarSign,
  Wallet
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@clerk/nextjs';

interface ReceiptItem {
  id: string;
  item_name: string;
  item_price: number;
  item_quantity: number;
  item_category?: string;
  item_brand?: string;
  item_unit?: string;
  confidence_score: number;
  added_to_shopping_list: boolean;
  added_to_spending: boolean;
  spend_entry_id?: string;
  user_confirmed: boolean;
  user_modified: boolean;
  attachment: {
    id: string;
    file_name: string;
    receipt_store?: string;
    receipt_date?: string;
  };
}

interface ReceiptItemsDisplayProps {
  attachmentId: string;
  className?: string;
}

export function ReceiptItemsDisplay({ attachmentId, className }: ReceiptItemsDisplayProps) {
  const { getToken } = useAuth();
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [addingToShoppingList, setAddingToShoppingList] = useState(false);
  const [addingToSpending, setAddingToSpending] = useState(false);
  const [showSpendingOptions, setShowSpendingOptions] = useState(false);
  const [spendingOptions, setSpendingOptions] = useState({
    create_single_entry: false,
    payment_method: 'card' as 'cash' | 'card' | 'bank_transfer' | 'other'
  });

  // Fetch receipt items
  React.useEffect(() => {
    const fetchItems = async () => {
      try {
        const token = await getToken();
        const response = await fetch(`/api/receipt-items?attachment_id=${attachmentId}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        
        if (data.success) {
          setItems(data.receipt_items || []);
        } else {
          toast.error('Failed to load receipt items');
        }
      } catch (error) {
        console.error('❌ Error fetching receipt items:', error);
        toast.error('Failed to load receipt items');
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [attachmentId, getToken]);

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
      setSelectedItems(new Set(items.map(item => item.id)));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleAddToShoppingList = async () => {
    if (selectedItems.size === 0) {
      toast.error('Please select items to add to shopping list');
      return;
    }

    setAddingToShoppingList(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/receipt-items', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          item_ids: Array.from(selectedItems)
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(data.message);
        
        // Update items to mark as added
        setItems(prev => prev.map(item => 
          selectedItems.has(item.id)
            ? { ...item, added_to_shopping_list: true }
            : item
        ));
        
        setSelectedItems(new Set());
      } else {
        toast.error(data.error || 'Failed to add items to shopping list');
      }
    } catch (error) {
      console.error('❌ Error adding to shopping list:', error);
      toast.error('Failed to add items to shopping list');
    } finally {
      setAddingToShoppingList(false);
    }
  };

  const handleAddToSpending = async () => {
    if (selectedItems.size === 0) {
      toast.error('Please select items to add to spending');
      return;
    }

    setAddingToSpending(true);
    try {
      const token = await getToken();
      const response = await fetch('/api/finance/receipt-to-spending', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          receipt_item_ids: Array.from(selectedItems),
          ...spendingOptions
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(data.message);
        
        // Update items to mark as added to spending
        setItems(prev => prev.map(item => 
          selectedItems.has(item.id)
            ? { ...item, added_to_spending: true }
            : item
        ));
        
        setSelectedItems(new Set());
        setShowSpendingOptions(false);
      } else {
        toast.error(data.error || 'Failed to add items to spending');
      }
    } catch (error) {
      console.error('❌ Error adding to spending:', error);
      toast.error('Failed to add items to spending');
    } finally {
      setAddingToSpending(false);
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800';
    if (score >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getCategoryColor = (category?: string) => {
    const colors: Record<string, string> = {
      'dairy': 'bg-blue-100 text-blue-800',
      'produce': 'bg-green-100 text-green-800',
      'meat': 'bg-red-100 text-red-800',
      'bakery': 'bg-yellow-100 text-yellow-800',
      'pantry': 'bg-orange-100 text-orange-800',
      'beverages': 'bg-cyan-100 text-cyan-800',
      'snacks': 'bg-purple-100 text-purple-800',
      'household': 'bg-gray-100 text-gray-800',
      'health': 'bg-pink-100 text-pink-800'
    };
    
    return colors[category || 'other'] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2 text-gray-600">Loading receipt items...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (items.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Receipt Items
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-600">No items found in this receipt</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const allSelected = items.length > 0 && selectedItems.size === items.length;
  const someSelected = selectedItems.size > 0 && selectedItems.size < items.length;

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Receipt Items ({items.length})
          </CardTitle>
          
          {items.length > 0 && items[0]?.attachment && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {items[0].attachment?.receipt_date
                  ? format(new Date(items[0].attachment.receipt_date), 'MMM dd, yyyy')
                  : 'Unknown date'}
              </Badge>
              {items[0].attachment?.receipt_store && (
                <Badge variant="outline" className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  <span>{items[0].attachment.receipt_store}</span>
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Select All Controls */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <Checkbox
              checked={allSelected}
              onCheckedChange={handleSelectAll}
              indeterminate={someSelected}
            />
            <span className="text-sm font-medium text-gray-900">
              Select All ({selectedItems.size}/{items.length})
            </span>
          </div>
          
          {selectedItems.size > 0 && (
            <div className="flex items-center gap-2">
              <Button
                onClick={handleAddToShoppingList}
                disabled={addingToShoppingList}
                className="bg-green-600 hover:bg-green-700"
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                {addingToShoppingList ? 'Adding...' : `Add ${selectedItems.size} to Shopping List`}
              </Button>
              
              <Button
                onClick={() => setShowSpendingOptions(!showSpendingOptions)}
                disabled={addingToSpending}
                variant="outline"
                className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                {addingToSpending ? 'Adding...' : `Add ${selectedItems.size} to Spending`}
              </Button>
            </div>
          )}
        </div>

        {/* Spending Options */}
        {showSpendingOptions && selectedItems.size > 0 && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-4">
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-blue-600" />
              <h3 className="font-medium text-blue-900">Spending Options</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="single-entry"
                  checked={spendingOptions.create_single_entry}
                  onCheckedChange={(checked) => 
                    setSpendingOptions(prev => ({ ...prev, create_single_entry: checked as boolean }))
                  }
                />
                <Label htmlFor="single-entry" className="text-sm">
                  Create single spend entry for all items (recommended for receipt totals)
                </Label>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="payment-method" className="text-sm font-medium">
                  Payment Method
                </Label>
                <select
                  id="payment-method"
                  value={spendingOptions.payment_method}
                  onChange={(e) => 
                    setSpendingOptions(prev => ({ 
                      ...prev, 
                      payment_method: e.target.value as 'cash' | 'card' | 'bank_transfer' | 'other'
                    }))
                  }
                  className="w-full p-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="card">Card</option>
                  <option value="cash">Cash</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setShowSpendingOptions(false)}
                className="text-sm"
              >
                Cancel
              </Button>
              <Button
                onClick={handleAddToSpending}
                disabled={addingToSpending}
                className="bg-blue-600 hover:bg-blue-700 text-sm"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                {addingToSpending ? 'Adding...' : 'Add to Spending'}
              </Button>
            </div>
          </div>
        )}

        {/* Items List */}
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className={`flex items-center justify-between p-3 border rounded-lg ${
                item.added_to_shopping_list ? 'bg-green-50 border-green-200' : 'bg-white'
              }`}
            >
              <div className="flex items-center space-x-3 flex-1">
                <Checkbox
                  checked={selectedItems.has(item.id)}
                  onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                  disabled={item.added_to_shopping_list}
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-gray-900 truncate">
                      {item.item_name}
                    </span>
                    {item.item_brand && (
                      <Badge variant="outline" className="text-xs">
                        {item.item_brand}
                      </Badge>
                    )}
                    {item.item_category && (
                      <Badge className={`text-xs ${getCategoryColor(item.item_category)}`}>
                        {item.item_category}
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <span className="font-medium">${item.item_price.toFixed(2)}</span>
                    {item.item_quantity > 1 && (
                      <span>× {item.item_quantity}</span>
                    )}
                    {item.item_unit && (
                      <span>per {item.item_unit}</span>
                    )}
                    <Badge className={`text-xs ${getConfidenceColor(item.confidence_score)}`}>
                      {(item.confidence_score * 100).toFixed(0)}% confidence
                    </Badge>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {item.added_to_shopping_list && (
                  <Badge variant="outline" className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" aria-hidden="true" />
                    <span>Added to shopping list</span>
                  </Badge>
                )}
                {item.added_to_spending && (
                  <Badge variant="secondary" className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600" aria-hidden="true" />
                    <span>Added to spending</span>
                  </Badge>
                )}
                {item.user_modified && (
                  <Badge variant="outline" className="text-xs">
                    Modified
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="flex justify-between items-center pt-4 border-t">
          <div className="text-sm text-gray-600">
            Total: ${items.reduce((sum, item) => sum + (item.item_price * item.item_quantity), 0).toFixed(2)}
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <ShoppingCart className="h-4 w-4 text-green-600" />
              {items.filter(item => item.added_to_shopping_list).length} shopping
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="h-4 w-4 text-blue-600" />
              {items.filter(item => item.added_to_spending).length} spending
            </span>
            <span>of {items.length} items</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
