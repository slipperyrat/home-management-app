'use client';

import { useState } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Plus, 
  ShoppingCart, 
  Brain, 
  Lightbulb, 
  TrendingUp, 
  Target,
  Clock,
  CheckCircle,
  Sparkles,
  BarChart3,
  Zap,
  X
} from 'lucide-react';
import { 
  useShoppingLists, 
  useCreateShoppingList, 
  useOptimisticShoppingLists 
} from '@/hooks/useShoppingLists';
import { useShoppingListItems } from '@/hooks/useShoppingListItems';
import { AutoAddedItemsConfirmation } from '@/components/shopping/AutoAddedItemsConfirmation';
import { toast } from 'sonner';

// Shopping List Card Component
function ShoppingListCard({ list }: { list: ShoppingList }) {
  const { data: itemsData, isLoading: itemsLoading } = useShoppingListItems(list.id);
  const items = itemsData?.items || [];

  // Debug logging
  console.log(`🔍 ShoppingListCard for ${list.name}:`, {
    listId: list.id,
    itemsData,
    items,
    itemsLoading,
    totalItems: list.total_items
  });
  
  // More detailed items logging
  if (items && items.length > 0) {
    console.log(`🔍 Items details for ${list.name}:`, items.map(item => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      is_complete: item.is_complete,
      auto_added: item.auto_added
    })));
  }

  const getCompletionPercentage = (list: ShoppingList) => {
    if (list.total_items === 0) return 0;
    return Math.round((list.completed_items / list.total_items) * 100);
  };

  const getAIConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="p-4 border rounded-lg bg-white">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-lg">{list.name}</h4>
          {list.ai_suggestions_count > 0 && (
            <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs">
              <Sparkles className="h-3 w-3 mr-1" />
              {list.ai_suggestions_count} AI suggestions
            </Badge>
          )}
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-600 mb-1">Progress</div>
          <Progress value={getCompletionPercentage(list)} className="w-20" />
          <div className="text-xs text-gray-500 mt-1">
            {getCompletionPercentage(list)}%
          </div>
        </div>
      </div>
      
      <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
        <span>{list.total_items} items</span>
        <span>{list.completed_items} completed</span>
        <span className={getAIConfidenceColor(list.ai_confidence)}>
          AI Confidence: {list.ai_confidence}%
        </span>
      </div>

      {/* Items List */}
      {(() => {
        console.log(`🔍 Render check for ${list.name}:`, {
          itemsLoading,
          itemsLength: items.length,
          items: items
        });
        return null;
      })()}
      {itemsLoading ? (
        <div className="flex items-center justify-center py-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="ml-2 text-sm text-gray-600">Loading items...</span>
        </div>
      ) : items.length > 0 ? (
        <div className="space-y-2">
          <h5 className="text-sm font-medium text-gray-700 mb-2">Items:</h5>
          <div className="space-y-1">
            {items.slice(0, 5).map((item) => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${item.is_complete ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className={item.is_complete ? 'line-through text-gray-500' : 'text-gray-900'}>
                    {item.name}
                  </span>
                  {item.quantity && (
                    <Badge variant="outline" className="text-xs">
                      {item.quantity}
                    </Badge>
                  )}
                  {item.auto_added && (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                      AI
                    </Badge>
                  )}
                </div>
              </div>
            ))}
            {items.length > 5 && (
              <div className="text-xs text-gray-500">
                +{items.length - 5} more items
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-500 italic">
          No items in this list yet
        </div>
      )}
    </div>
  );
}

interface ShoppingList {
  id: string;
  name: string;
  household_id: string;
  created_by: string;
  created_at: string;
  is_completed: boolean;
  total_items: number;
  completed_items: number;
  ai_suggestions_count: number;
  ai_confidence: number;
}

interface AIShoppingInsights {
  total_lists: number;
  completed_lists: number;
  average_items_per_list: number;
  most_common_categories: string[];
  shopping_frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  suggested_improvements: string[];
  ai_learning_progress: number;
  next_shopping_prediction: string;
}

export default function ShoppingListsPage() {
  const { userId } = useAuth();
  const router = useRouter();
  const [aiInsights] = useState<AIShoppingInsights | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCleaningUp, setIsCleaningUp] = useState(false);

  // Cleanup function to merge duplicate items
  const handleCleanupDuplicates = async (listId: string) => {
    setIsCleaningUp(true);
    try {
      const response = await fetch('/api/shopping-lists/merge-duplicates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ listId }),
        credentials: 'include'
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(`✅ Cleaned up ${data.mergedItems} duplicate items! Total items: ${data.totalItems}`);
        // Refresh the page to show updated data
        window.location.reload();
      } else {
        toast.error(`❌ Cleanup failed: ${data.error}`);
      }
    } catch (error) {
      console.error('Cleanup error:', error);
      toast.error('❌ Cleanup failed. Please try again.');
    } finally {
      setIsCleaningUp(false);
    }
  };
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');

  // React Query hooks
  const { 
    data: shoppingListsData, 
    isLoading: loading, 
    error: shoppingListsError 
  } = useShoppingLists();
  
  const createShoppingList = useCreateShoppingList();
  const { addOptimisticList, removeOptimisticList } = useOptimisticShoppingLists();

  // Extract data from React Query
  const shoppingLists = shoppingListsData?.data?.shoppingLists || [];






  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    
    try {
      // Add optimistic update
      addOptimisticList({
        name: newListName.trim(),
        household_id: '', // Will be filled by the API
        created_by: userId || '',
        is_completed: false,
        total_items: 0,
        completed_items: 0,
        ai_suggestions_count: 0,
        ai_confidence: 0,
      });

      // Create the shopping list
      await createShoppingList.mutateAsync({
        name: newListName.trim(),
        household_id: '', // Will be filled by the API
      });

      // Clear form and close modal
      setShowCreateModal(false);
      setNewListName('');
      setNewListDescription('');
    } catch (error) {
      // Remove optimistic update on error
      if (error) {
        removeOptimisticList(`temp-${Date.now()}`);
      }
      
      console.error('Error creating shopping list:', error);
      alert('Failed to create shopping list. Please try again.');
    }
  };

  const getCompletionPercentage = (list: ShoppingList) => {
    if (list.total_items === 0) return 0;
    return Math.round((list.completed_items / list.total_items) * 100);
  };

  const getAIConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600';
    if (confidence >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getAIConfidenceBadge = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-100 text-green-800';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ShoppingCart className="h-12 w-12 animate-pulse mx-auto mb-4 text-blue-500" />
          <p className="text-lg text-gray-600">Loading Smart Shopping Lists...</p>
        </div>
      </div>
    );
  }

  // Handle errors
  if (shoppingListsError) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <ShoppingCart className="h-16 w-16 mx-auto mb-6 text-red-500" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Lists</h2>
          <p className="text-gray-600 mb-6">
            {shoppingListsError.message || 'Failed to load shopping lists'}
          </p>
          <Button onClick={() => window.location.reload()}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }



  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <ShoppingCart className="h-8 w-8 text-blue-500" />
          <h1 className="text-3xl font-bold text-gray-900">Smart Shopping Lists</h1>
          <Badge variant="secondary" className="bg-purple-100 text-purple-800">
            <Brain className="h-4 w-4 mr-1" />
            AI-Powered
          </Badge>
        </div>
        <p className="text-gray-600 text-lg">
          Intelligent shopping lists that learn from your habits and suggest items automatically
        </p>
      </div>

      {/* Auto-Added Items Confirmation */}
      <AutoAddedItemsConfirmation className="mb-8" />

      {/* AI Insights Summary */}
      {aiInsights && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Lists</CardTitle>
              <ShoppingCart className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{aiInsights.total_lists}</div>
              <p className="text-xs text-gray-500">Shopping lists created</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{aiInsights.completed_lists}</div>
              <p className="text-xs text-gray-500">Lists finished</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Learning</CardTitle>
              <Brain className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{aiInsights.ai_learning_progress}%</div>
              <p className="text-xs text-gray-500">Pattern recognition</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Next Shopping</CardTitle>
              <Clock className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold">{aiInsights.next_shopping_prediction}</div>
              <p className="text-xs text-gray-500">AI prediction</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="all-lists">All Lists</TabsTrigger>
          <TabsTrigger value="ai-insights">AI Insights</TabsTrigger>
          <TabsTrigger value="suggestions">Smart Suggestions</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                Quick Actions
              </CardTitle>
              <CardDescription>
                Create new lists or get AI-powered suggestions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <Button 
                  className="bg-blue-600 hover:bg-blue-700"
                  onClick={() => setShowCreateModal(true)}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create New List
                </Button>
                <Button variant="outline" className="border-purple-200 text-purple-700 hover:bg-purple-50">
                  <Brain className="h-4 w-4 mr-2" />
                  AI Suggestions
                </Button>
                <Button variant="outline" className="border-green-200 text-green-700 hover:bg-green-50">
                  <Target className="h-4 w-4 mr-2" />
                  Smart Templates
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Lists */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Recent Lists
              </CardTitle>
              <CardDescription>
                Your most recent shopping lists with AI insights
              </CardDescription>
            </CardHeader>
            <CardContent>
              {shoppingLists.slice(0, 3).length > 0 ? (
                <div className="space-y-4">
                  {shoppingLists.slice(0, 3).map((list) => (
                    <ShoppingListCard key={list.id} list={list} />
                  ))}
                </div>
              ) : (
                <p className="text-gray-600 text-center py-8">
                  No shopping lists yet. Create your first one to get started!
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* All Lists Tab */}
        <TabsContent value="all-lists" className="space-y-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold">All Shopping Lists</h2>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                onClick={() => {
                  const groceriesList = shoppingLists.find(list => list.name === 'Groceries');
                  if (groceriesList) {
                    handleCleanupDuplicates(groceriesList.id);
                  } else {
                    toast.error('Groceries list not found');
                  }
                }}
                disabled={isCleaningUp}
                className="text-orange-600 border-orange-200 hover:bg-orange-50"
              >
                {isCleaningUp ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-600 mr-2" />
                    Cleaning...
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Clean Duplicates
                  </>
                )}
              </Button>
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                New List
              </Button>
            </div>
          </div>

          {shoppingLists.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {shoppingLists.map((list) => (
                <Card 
                  key={list.id} 
                  className="hover:shadow-lg transition-shadow cursor-pointer"
                  onClick={() => router.push(`/shopping-lists/${list.id}`)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg mb-2">{list.name}</CardTitle>

                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {list.ai_suggestions_count > 0 && (
                          <Badge variant="secondary" className={getAIConfidenceBadge(list.ai_confidence)}>
                            <Brain className="h-3 w-3 mr-1" />
                            AI {list.ai_confidence}%
                          </Badge>
                        )}
                        <Badge variant={list.is_completed ? "default" : "secondary"}>
                          {list.is_completed ? "Completed" : "Active"}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>{getCompletionPercentage(list)}%</span>
                      </div>
                      <Progress value={getCompletionPercentage(list)} />
                      
                      <div className="flex justify-between text-sm text-gray-600">
                        <span>{list.completed_items} of {list.total_items} items</span>
                        <span>{new Date(list.created_at).toLocaleDateString()}</span>
                      </div>
                      
                      <div className="flex gap-2 pt-2">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          className="flex-1 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/shopping-lists/${list.id}`);
                          }}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Add Items
                        </Button>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/shopping-lists/${list.id}`);
                          }}
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No shopping lists yet</h3>
                <p className="text-gray-500 mb-4">
                  Create your first shopping list to start organizing your shopping trips
                </p>
                <Button className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-4 w-4 mr-2" />
                  Create First List
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* AI Insights Tab */}
        <TabsContent value="ai-insights" className="space-y-6">
          {aiInsights ? (
            <>
              {/* Shopping Patterns */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                    Shopping Patterns
                  </CardTitle>
                  <CardDescription>
                    AI analysis of your shopping behavior and habits
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium mb-3">Shopping Frequency</h4>
                      <Badge variant="secondary" className="text-lg px-4 py-2">
                        {aiInsights.shopping_frequency}
                      </Badge>
                    </div>
                    <div>
                      <h4 className="font-medium mb-3">Average Items per List</h4>
                      <div className="text-2xl font-bold text-blue-600">
                        {aiInsights.average_items_per_list}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Top Categories */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-green-500" />
                    Most Common Categories
                  </CardTitle>
                  <CardDescription>
                    What you shop for most frequently
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {aiInsights.most_common_categories.length > 0 ? (
                    <div className="space-y-3">
                      {aiInsights.most_common_categories.map((category, index) => (
                        <div key={index} className="flex items-center gap-3">
                          <Badge variant="secondary" className="w-16 justify-center">
                            #{index + 1}
                          </Badge>
                          <span className="text-sm">{category}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 text-sm">
                      Categories will appear as you create more shopping lists
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* AI Learning Progress */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-500" />
                    AI Learning Progress
                  </CardTitle>
                  <CardDescription>
                    How well the AI understands your shopping patterns
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                      <span>Pattern Recognition</span>
                      <span>{aiInsights.ai_learning_progress}%</span>
                    </div>
                    <Progress value={aiInsights.ai_learning_progress} />
                    <p className="text-sm text-gray-600">
                      The AI is learning from your shopping habits to provide better suggestions
                    </p>
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Brain className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">AI Insights Loading</h3>
                <p className="text-gray-500">
                  Creating your first shopping list to generate AI insights
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Smart Suggestions Tab */}
        <TabsContent value="suggestions" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5 text-yellow-500" />
                Smart Suggestions
              </CardTitle>
              <CardDescription>
                AI-powered recommendations to improve your shopping experience
              </CardDescription>
            </CardHeader>
            <CardContent>
              {aiInsights?.suggested_improvements && aiInsights.suggested_improvements.length > 0 ? (
                <div className="space-y-4">
                  {aiInsights.suggested_improvements.map((suggestion, index) => (
                    <div key={index} className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-3">
                        <Lightbulb className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                        <p className="text-sm text-blue-800">{suggestion}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Lightbulb className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No suggestions yet</h3>
                  <p className="text-gray-500">
                    Create more shopping lists to get personalized AI recommendations
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Shopping List Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Create New Shopping List</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateModal(false)}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="list-name">List Name *</Label>
                <Input
                  id="list-name"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="e.g., Groceries for this week"
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label htmlFor="list-description">Description (optional)</Label>
                <Textarea
                  id="list-description"
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  placeholder="e.g., Weekly grocery shopping for family of 4"
                  className="mt-1"
                  rows={3}
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleCreateList}
                  disabled={!newListName.trim() || createShoppingList.isPending}
                  className="flex-1"
                >
                  {createShoppingList.isPending ? 'Creating...' : 'Create List'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  disabled={createShoppingList.isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 