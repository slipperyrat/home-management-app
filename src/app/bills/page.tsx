'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Plus, 
  TrendingUp, 
  AlertTriangle, 
  DollarSign, 
  Calendar,
  Brain,
  Lightbulb,
  BarChart3,
  Target
} from 'lucide-react';

interface Bill {
  id: string;
  title: string;
  amount: number;
  due_date: string;
  category: string;
  provider: string;
  status: 'paid' | 'unpaid' | 'overdue';
  ai_confidence: number;
  ai_category_suggestion?: string;
  ai_amount_prediction?: number;
  created_at: string;
}

interface AIBillInsights {
  total_bills: number;
  monthly_spending: number;
  spending_trend: 'increasing' | 'decreasing' | 'stable';
  top_categories: Array<{ category: string; amount: number; percentage: number }>;
  upcoming_bills: number;
  overdue_risk: number;
  ai_recommendations: string[];
  spending_patterns: Array<{ month: string; amount: number }>;
}

export default function BillsPage() {
  const { isSignedIn, isLoaded } = useAuth();
  const [bills, setBills] = useState<Bill[]>([]);
  const [aiInsights, setAiInsights] = useState<AIBillInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'bills' | 'ai-insights'>('overview');

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    fetchBills();
    fetchAIBillInsights();
  }, [isLoaded, isSignedIn]);

  const fetchBills = async () => {
    try {
      const response = await fetch('/api/bills');
      if (response.ok) {
        const data = await response.json();
        setBills(data.bills || []);
      }
    } catch (error) {
      console.error('Error fetching bills:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAIBillInsights = async () => {
    try {
      const response = await fetch('/api/ai/bill-insights');
      if (response.ok) {
        const data = await response.json();
        setAiInsights(data.insights);
      }
    } catch (error) {
      console.error('Error fetching AI insights:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'unpaid': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'bg-green-100 text-green-800';
    if (confidence >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (!isLoaded || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading Smart Bill Management...</p>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-500" />
              <h1 className="text-3xl font-bold text-gray-900">Smart Bill Management</h1>
            </div>
            <Button className="bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4 mr-2" />
              Add Bill
            </Button>
          </div>
          <p className="text-gray-600 text-lg">
            AI-powered bill tracking, categorization, and spending insights
          </p>
        </div>

        {/* AI Stats Cards */}
        {aiInsights && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
                <DollarSign className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{aiInsights.total_bills}</div>
                <p className="text-xs text-gray-500">Active bills</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Monthly Spending</CardTitle>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(aiInsights.monthly_spending)}</div>
                <p className="text-xs text-gray-500">This month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Upcoming Bills</CardTitle>
                <Calendar className="h-4 w-4 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{aiInsights.upcoming_bills}</div>
                <p className="text-xs text-gray-500">Due soon</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Overdue Risk</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{aiInsights.overdue_risk}%</div>
                <p className="text-xs text-gray-500">Risk level</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              <button
                onClick={() => setActiveTab('overview')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'overview'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Overview
              </button>
              <button
                onClick={() => setActiveTab('bills')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'bills'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                All Bills ({bills.length})
              </button>
              <button
                onClick={() => setActiveTab('ai-insights')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'ai-insights'
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                🧠 AI Insights
              </button>
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                {/* Spending Overview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Spending Overview
                    </CardTitle>
                    <CardDescription>
                      AI-powered spending analysis and trends
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {aiInsights ? (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium">Monthly Spending Trend</span>
                          <Badge variant={
                            aiInsights.spending_trend === 'increasing' ? 'destructive' :
                            aiInsights.spending_trend === 'decreasing' ? 'default' : 'secondary'
                          }>
                            {aiInsights.spending_trend === 'increasing' ? '↗️ Increasing' :
                             aiInsights.spending_trend === 'decreasing' ? '↘️ Decreasing' : '→ Stable'}
                          </Badge>
                        </div>
                        
                        {/* Top Spending Categories */}
                        <div>
                          <h4 className="text-sm font-medium mb-3">Top Spending Categories</h4>
                          <div className="space-y-2">
                            {aiInsights.top_categories.slice(0, 3).map((category, index) => (
                              <div key={index} className="flex items-center justify-between">
                                <span className="text-sm">{category.category}</span>
                                <div className="flex items-center gap-2">
                                  <Progress value={category.percentage} className="w-20" />
                                  <span className="text-sm font-medium">{formatCurrency(category.amount)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">Loading AI insights...</p>
                    )}
                  </CardContent>
                </Card>

                {/* Recent Bills */}
                <Card>
                  <CardHeader>
                    <CardTitle>Recent Bills</CardTitle>
                    <CardDescription>Latest bills with AI insights</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {bills.slice(0, 5).map((bill) => (
                      <div key={bill.id} className="flex items-center justify-between py-3 border-b last:border-b-0">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{bill.title}</h4>
                            {bill.ai_confidence > 0.8 && (
                              <Badge variant="secondary" className="text-xs">
                                🤖 AI Verified
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">{bill.provider}</p>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">{formatCurrency(bill.amount)}</div>
                          <div className="text-sm text-gray-500">{formatDate(bill.due_date)}</div>
                        </div>
                        <Badge className={getStatusColor(bill.status)}>
                          {bill.status}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {activeTab === 'bills' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">All Bills</h3>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">Filter</Button>
                    <Button variant="outline" size="sm">Sort</Button>
                  </div>
                </div>
                
                {bills.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No bills found</p>
                ) : (
                  <div className="grid gap-4">
                    {bills.map((bill) => (
                      <Card key={bill.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="font-medium text-lg">{bill.title}</h4>
                                <Badge className={getStatusColor(bill.status)}>
                                  {bill.status}
                                </Badge>
                                {bill.ai_confidence && (
                                  <Badge className={getConfidenceColor(bill.ai_confidence)}>
                                    AI: {Math.round(bill.ai_confidence * 100)}%
                                  </Badge>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                <div>
                                  <span className="text-gray-500">Provider:</span>
                                  <p className="font-medium">{bill.provider}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Category:</span>
                                  <p className="font-medium">{bill.category}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Due Date:</span>
                                  <p className="font-medium">{formatDate(bill.due_date)}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500">Amount:</span>
                                  <p className="font-medium text-lg text-green-600">{formatCurrency(bill.amount)}</p>
                                </div>
                              </div>

                              {/* AI Suggestions */}
                              {bill.ai_category_suggestion && bill.ai_category_suggestion !== bill.category && (
                                <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                  <div className="flex items-center gap-2">
                                    <Brain className="h-4 w-4 text-blue-500" />
                                    <span className="text-sm text-blue-800">
                                      AI suggests category: <strong>{bill.ai_category_suggestion}</strong>
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            <div className="flex flex-col gap-2 ml-4">
                              <Button size="sm" variant="outline">Edit</Button>
                              <Button size="sm" variant="outline">Pay</Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'ai-insights' && (
              <div className="space-y-6">
                {/* AI Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5" />
                      AI Recommendations
                    </CardTitle>
                    <CardDescription>
                      Smart suggestions to optimize your bill management
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {aiInsights?.ai_recommendations ? (
                      <div className="space-y-3">
                        {aiInsights.ai_recommendations.map((recommendation, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-green-50 rounded-lg border border-green-200">
                            <Target className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-green-800">{recommendation}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No AI recommendations yet</p>
                    )}
                  </CardContent>
                </Card>

                {/* Spending Patterns */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Spending Patterns
                    </CardTitle>
                    <CardDescription>
                      AI-analyzed spending trends over time
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {aiInsights?.spending_patterns ? (
                      <div className="space-y-3">
                        {aiInsights.spending_patterns.map((pattern, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <span className="text-sm font-medium">{pattern.month}</span>
                            <div className="flex items-center gap-3">
                              <Progress value={(pattern.amount / Math.max(...aiInsights.spending_patterns.map(p => p.amount))) * 100} className="w-32" />
                              <span className="text-sm font-medium">{formatCurrency(pattern.amount)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-4">No spending pattern data yet</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
