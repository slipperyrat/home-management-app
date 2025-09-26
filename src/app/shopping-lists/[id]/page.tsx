'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, 
  Plus, 
  ShoppingCart, 
  Brain, 
  CheckCircle, 
  Clock,
  Edit,
  Trash2,
  X,
  Sparkles
} from 'lucide-react';
import { fetchWithCSRF } from '@/lib/csrf-client';

interface ShoppingItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: string;
  is_completed: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
}

interface ShoppingList {
  id: string;
  name: string;
  description?: string;
  household_id: string;
  created_by: string;
  created_at: string;
  is_completed: boolean;
  total_items: number;
  completed_items: number;
  ai_suggestions_count: number;
  ai_confidence: number;
}

export default function ShoppingListDetailPage() {
  const { userId } = useAuth();
  const router = useRouter();
  const params = useParams();
  const listId = params.id as string;
  
  const [list, setList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [showEditListModal, setShowEditListModal] = useState(false);
  const [newItem, setNewItem] = useState({
    name: '',
    quantity: 1,
    unit: '',
    category: 'general',
    notes: ''
  });
  const [editListData, setEditListData] = useState({
    name: '',
    description: ''
  });

  const categories = [
    'general', 'produce', 'dairy', 'meat', 'pantry', 'frozen', 'bakery', 'beverages', 'snacks', 'health', 'household'
  ];

  useEffect(() => {
    if (listId) {
      fetchListDetails();
    }
  }, [listId]);

  const fetchListDetails = async () => {
    try {
      // Fetch list details
      const listResponse = await fetch(`/api/shopping-lists/${listId}`);
      if (listResponse.ok) {
        const listData = await listResponse.json();
        // Handle the correct API response structure
        const list = listData.data?.list || listData.list;
        if (list) {
          setList(list);
          setEditListData({
            name: list.name || list.title, // Handle both 'name' and 'title' fields
            description: list.description || ''
          });
        } else {
          console.error('List not found in response:', listData);
          setError('List not found');
        }
      } else {
        setError('Failed to load shopping list');
      }

      // Fetch items
      const itemsResponse = await fetch(`/api/shopping-lists/${listId}/items`);
      if (itemsResponse.ok) {
        const itemsData = await itemsResponse.json();
        setItems(itemsData.items || []);
      }
    } catch (error) {
      console.error('Error fetching list details:', error);
      toast.error('Failed to load shopping list');
    } finally {
      setLoading(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim()) return;

    try {
      const response = await fetch(`/api/shopping-lists/${listId}/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newItem),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast.success('Item added successfully!');
          setItems(prev => [...prev, result.item]);
          setNewItem({ name: '', quantity: 1, unit: '', category: 'general', notes: '' });
          setShowAddItemModal(false);
          fetchListDetails(); // Refresh list stats
        } else {
          toast.error(`Failed to add item: ${result.error || 'Unknown error'}`);
        }
      } else {
        const error = await response.json();
        toast.error(`Failed to add item: ${error.error || error.message || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error('Failed to add item. Please try again.');
      console.error('Error adding item:', error);
    }
  };

  const handleToggleItem = async (itemId: string, isCompleted: boolean) => {
    try {
      const response = await fetch(`/api/shopping-items/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ itemId, isCompleted }),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setItems(prev => prev.map(item => 
            item.id === itemId ? { ...item, is_completed: isCompleted } : item
          ));
          fetchListDetails(); // Refresh list stats
        } else {
          toast.error(`Failed to update item: ${result.error || 'Unknown error'}`);
        }
      } else {
        const error = await response.json();
        toast.error(`Failed to update item: ${error.error || error.message || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error('Failed to update item. Please try again.');
      console.error('Error updating item:', error);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;

    try {
      const response = await fetchWithCSRF(`/api/shopping-lists/${listId}/items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast.success('Item deleted successfully!');
          setItems(prev => prev.filter(item => item.id !== itemId));
          fetchListDetails(); // Refresh list stats
        } else {
          toast.error(`Failed to delete item: ${result.error || 'Unknown error'}`);
        }
      } else {
        const error = await response.json();
        toast.error(`Failed to delete item: ${error.error || error.message || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error('Failed to delete item. Please try again.');
      console.error('Error deleting item:', error);
    }
  };

  const handleEditList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editListData.name.trim()) return;

    try {
      const response = await fetch(`/api/shopping-lists/${listId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editListData),
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          toast.success('List updated successfully!');
          setList(prev => prev ? { ...prev, ...editListData } : null);
          setShowEditListModal(false);
        } else {
          toast.error(`Failed to update list: ${result.error || 'Unknown error'}`);
        }
      } else {
        const error = await response.json();
        toast.error(`Failed to update list: ${error.error || error.message || 'Unknown error'}`);
      }
    } catch (error) {
      toast.error('Failed to update list. Please try again.');
      console.error('Error updating list:', error);
    }
  };

  const getCompletionPercentage = () => {
    if (items.length === 0) return 0;
    const completed = items.filter(item => item.is_completed).length;
    return Math.round((completed / items.length) * 100);
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      produce: 'bg-green-100 text-green-800',
      dairy: 'bg-blue-100 text-blue-800',
      meat: 'bg-red-100 text-red-800',
      pantry: 'bg-yellow-100 text-yellow-800',
      frozen: 'bg-purple-100 text-purple-800',
      bakery: 'bg-orange-100 text-orange-800',
      beverages: 'bg-cyan-100 text-cyan-800',
      snacks: 'bg-pink-100 text-pink-800',
      health: 'bg-indigo-100 text-indigo-800',
      household: 'bg-gray-100 text-gray-800',
      general: 'bg-gray-100 text-gray-800'
    };
    return colors[category] || colors.general;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ShoppingCart className="h-12 w-12 animate-pulse mx-auto mb-4 text-blue-500" />
          <p className="text-lg text-gray-600">Loading shopping list...</p>
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ShoppingCart className="h-16 w-16 mx-auto mb-6 text-red-500" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">List Not Found</h2>
          <p className="text-gray-600 mb-6">
            The shopping list you're looking for doesn't exist or you don't have access to it.
          </p>
          <Button onClick={() => router.push('/shopping-lists')}>
            Back to Shopping Lists
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={() => router.push('/shopping-lists')}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Lists
              </Button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{list.name}</h1>
                {list.description && (
                  <p className="text-gray-600 mt-2">{list.description}</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => setShowEditListModal(true)}
                className="flex items-center gap-2"
              >
                <Edit className="h-4 w-4" />
                Edit List
              </Button>
              <Button
                onClick={() => setShowAddItemModal(true)}
                className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </div>
          </div>
        </div>

        {/* Progress Card */}
        <Card className="mb-8">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium">Progress</h3>
                <p className="text-sm text-gray-600">
                  {items.filter(item => item.is_completed).length} of {items.length} items completed
                </p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-blue-600">{getCompletionPercentage()}%</div>
                <div className="text-sm text-gray-500">Complete</div>
              </div>
            </div>
            <Progress value={getCompletionPercentage()} className="h-2" />
          </CardContent>
        </Card>

        {/* Items List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Items ({items.length})
            </CardTitle>
            <CardDescription>
              Manage your shopping list items
            </CardDescription>
          </CardHeader>
          <CardContent>
            {items.length > 0 ? (
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-4 p-4 border rounded-lg ${
                      item.is_completed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
                    }`}
                  >
                    <button
                      onClick={() => handleToggleItem(item.id, !item.is_completed)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        item.is_completed
                          ? 'bg-green-500 border-green-500 text-white'
                          : 'border-gray-300 hover:border-green-500'
                      }`}
                    >
                      {item.is_completed && <CheckCircle className="h-4 w-4" />}
                    </button>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className={`font-medium ${item.is_completed ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {item.name}
                        </h4>
                        <Badge className={getCategoryColor(item.category)}>
                          {item.category}
                        </Badge>
                        {item.quantity > 1 && (
                          <span className="text-sm text-gray-600">
                            {item.quantity} {item.unit}
                          </span>
                        )}
                      </div>
                      {item.notes && (
                        <p className="text-sm text-gray-600">{item.notes}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteItem(item.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No items yet</h3>
                <p className="text-gray-500 mb-6">
                  Add your first item to get started with this shopping list
                </p>
                <Button
                  onClick={() => setShowAddItemModal(true)}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Item
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add Item Modal */}
        {showAddItemModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Add New Item</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddItemModal(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <form onSubmit={handleAddItem} className="space-y-4">
                <div>
                  <Label htmlFor="item-name">Item Name *</Label>
                  <Input
                    id="item-name"
                    value={newItem.name}
                    onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Milk"
                    className="mt-1"
                    required
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quantity">Quantity</Label>
                    <Input
                      id="quantity"
                      type="number"
                      min="1"
                      value={newItem.quantity}
                      onChange={(e) => setNewItem(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="unit">Unit</Label>
                    <Input
                      id="unit"
                      value={newItem.unit}
                      onChange={(e) => setNewItem(prev => ({ ...prev, unit: e.target.value }))}
                      placeholder="e.g., liters"
                      className="mt-1"
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="category">Category</Label>
                  <select
                    id="category"
                    value={newItem.category}
                    onChange={(e) => setNewItem(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {categories.map((category) => (
                      <option key={category} value={category}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={newItem.notes}
                    onChange={(e) => setNewItem(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any additional notes..."
                    className="mt-1"
                    rows={2}
                  />
                </div>
                
                <div className="flex gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={!newItem.name.trim()}
                    className="flex-1"
                  >
                    Add Item
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowAddItemModal(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit List Modal */}
        {showEditListModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Edit List</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowEditListModal(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <form onSubmit={handleEditList} className="space-y-4">
                <div>
                  <Label htmlFor="list-name">List Name *</Label>
                  <Input
                    id="list-name"
                    value={editListData.name}
                    onChange={(e) => setEditListData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Groceries for this week"
                    className="mt-1"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="list-description">Description</Label>
                  <Textarea
                    id="list-description"
                    value={editListData.description}
                    onChange={(e) => setEditListData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="e.g., Weekly grocery shopping for family of 4"
                    className="mt-1"
                    rows={3}
                  />
                </div>
                
                <div className="flex gap-3 pt-2">
                  <Button
                    type="submit"
                    disabled={!editListData.name.trim()}
                    className="flex-1"
                  >
                    Update List
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowEditListModal(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}