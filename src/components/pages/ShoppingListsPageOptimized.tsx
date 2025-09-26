'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormInput } from '@/components/ui/FormInput';
import { useFocusManagement } from '@/hooks/useFocusManagement';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { useFormValidation } from '@/hooks/useFormValidation';
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

// Memoized components for better performance
const ShoppingListCard = React.memo(({ 
  list, 
  onView, 
  onAddItems 
}: { 
  list: ShoppingList; 
  onView: (id: string) => void;
  onAddItems: (id: string) => void;
}) => {
  const getCompletionPercentage = useCallback((list: ShoppingList) => {
    if (list.total_items === 0) return 0;
    return Math.round((list.completed_items / list.total_items) * 100);
  }, []);

  const getAIConfidenceBadge = useCallback((confidence: number) => {
    if (confidence >= 80) return 'bg-green-100 text-green-800';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  }, []);

  const completionPercentage = useMemo(() => getCompletionPercentage(list), [list, getCompletionPercentage]);
  const confidenceBadge = useMemo(() => getAIConfidenceBadge(list.ai_confidence), [list.ai_confidence, getAIConfidenceBadge]);

  return (
    <Card 
      className="hover:shadow-lg transition-shadow cursor-pointer"
      onClick={() => onView(list.id)}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-lg mb-2">{list.name}</CardTitle>
          </div>
          <div className="flex flex-col items-end gap-2">
            {list.ai_suggestions_count > 0 && (
              <Badge variant="secondary" className={confidenceBadge}>
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
            <span>{completionPercentage}%</span>
          </div>
          <Progress value={completionPercentage} />
          
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
                onAddItems(list.id);
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
                onView(list.id);
              }}
            >
              View
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

ShoppingListCard.displayName = 'ShoppingListCard';

const CreateListModal = React.memo(({ 
  isOpen, 
  onClose, 
  onCreate 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  onCreate: (data: { name: string; description: string }) => void;
}) => {
  const { modalRef } = useFocusManagement({ isOpen, onClose });
  const [formData, setFormData] = useState({ name: '', description: '' });
  const { errors, isValid, validateForm, clearErrors } = useFormValidation();

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    
    // Simple validation
    if (!formData.name.trim()) {
      return;
    }
    
    onCreate(formData);
    setFormData({ name: '', description: '' });
    clearErrors();
    onClose();
  }, [formData, onCreate, onClose, clearErrors]);

  const handleClose = useCallback(() => {
    setFormData({ name: '', description: '' });
    clearErrors();
    onClose();
  }, [onClose, clearErrors]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" role="dialog" aria-modal="true">
      <div 
        ref={modalRef}
        className="bg-white rounded-lg p-6 w-full max-w-md mx-4"
        aria-labelledby="modal-title"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="modal-title" className="text-xl font-semibold">Create New Shopping List</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormInput
            label="List Name"
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Groceries for this week"
            required
            error={errors.find(e => e.field === 'name')?.message}
          />
          
          <FormInput
            label="Description (optional)"
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="e.g., Weekly grocery shopping for family of 4"
            multiline
            rows={3}
          />
          
          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={!formData.name.trim()}
              className="flex-1"
            >
              Create List
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
});

CreateListModal.displayName = 'CreateListModal';

export default function ShoppingListsPageOptimized() {
  const { userId } = useAuth();
  const router = useRouter();
  const [aiInsights] = useState<AIShoppingInsights | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { error, handleError, clearError } = useErrorHandler();

  // React Query hooks
  const { 
    data: shoppingListsData, 
    isLoading: loading, 
    error: shoppingListsError 
  } = useShoppingLists();
  
  const createShoppingList = useCreateShoppingList();
  const { addOptimisticList, removeOptimisticList } = useOptimisticShoppingLists();

  // Extract data from React Query
  const shoppingLists = useMemo(() => shoppingListsData?.shoppingLists || [], [shoppingListsData?.shoppingLists]);

  // Memoized handlers
  const handleCreateList = useCallback(async (data: { name: string; description: string }) => {
    if (!data.name.trim()) return;
    
    try {
      // Add optimistic update
      addOptimisticList({
        name: data.name.trim(),
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
        name: data.name.trim(),
        household_id: '', // Will be filled by the API
      });

      // Clear form and close modal
      setShowCreateModal(false);
    } catch (error) {
      // Remove optimistic update on error
      removeOptimisticList(`temp-${Date.now()}`);
      handleError(error as Error);
    }
  }, [addOptimisticList, createShoppingList, removeOptimisticList, userId, handleError]);

  const handleViewList = useCallback((id: string) => {
    router.push(`/shopping-lists/${id}`);
  }, [router]);

  const handleAddItems = useCallback((id: string) => {
    router.push(`/shopping-lists/${id}`);
  }, [router]);

  // Memoized computed values
  const recentLists = useMemo(() => shoppingLists.slice(0, 3), [shoppingLists]);

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

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between">
            <p className="text-red-800">{error}</p>
            <Button variant="ghost" size="sm" onClick={clearError}>
              <X className="h-4 w-4" />
            </Button>
          </div>
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
              {recentLists.length > 0 ? (
                <div className="space-y-4">
                  {recentLists.map((list) => (
                    <div key={list.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-medium">{list.name}</h4>
                          {list.ai_suggestions_count > 0 && (
                            <Badge variant="secondary" className="bg-purple-100 text-purple-800 text-xs">
                              <Sparkles className="h-3 w-3 mr-1" />
                              {list.ai_suggestions_count} AI suggestions
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>{list.total_items} items</span>
                          <span>{list.completed_items} completed</span>
                          <span className={list.ai_confidence >= 80 ? 'text-green-600' : list.ai_confidence >= 60 ? 'text-yellow-600' : 'text-red-600'}>
                            AI Confidence: {list.ai_confidence}%
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600 mb-1">Progress</div>
                        <Progress value={list.total_items > 0 ? Math.round((list.completed_items / list.total_items) * 100) : 0} className="w-20" />
                        <div className="text-xs text-gray-500 mt-1">
                          {list.total_items > 0 ? Math.round((list.completed_items / list.total_items) * 100) : 0}%
                        </div>
                      </div>
                    </div>
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
            <Button 
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              New List
            </Button>
          </div>

          {shoppingLists.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {shoppingLists.map((list) => (
                <ShoppingListCard
                  key={list.id}
                  list={list}
                  onView={handleViewList}
                  onAddItems={handleAddItems}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No shopping lists yet</h3>
                <p className="text-gray-600 mb-4">
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
                    <p className="text-gray-600 text-sm">
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
                <p className="text-gray-600">
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
                  <p className="text-gray-600">
                    Create more shopping lists to get personalized AI recommendations
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Shopping List Modal */}
      <CreateListModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateList}
      />
    </div>
  );
}
