'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useUserData } from '@/hooks/useUserData';
import { canAccessFeature } from '@/lib/server/canAccessFeature';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  CreditCard, 
  PiggyBank, 
  TrendingUp, 
  Plus,
  AlertCircle,
  CheckCircle,
  Clock,
  Calendar
} from 'lucide-react';

interface Bill {
  id: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  due_date: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  category?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
}

interface BudgetEnvelope {
  id: string;
  name: string;
  description?: string;
  allocated_amount: number;
  spent_amount: number;
  remaining_amount: number;
  spent_percentage: number;
  period_start: string;
  period_end: string;
  category: string;
  color: string;
}

interface SpendEntry {
  id: string;
  amount: number;
  description: string;
  category?: string;
  transaction_date: string;
  merchant?: string;
  payment_method: string;
  envelope_id?: string;
  bill_id?: string;
  budget_envelopes?: { name: string; color: string };
  bills?: { title: string; amount: number };
}

export default function FinancePage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { userData, isLoading, isError } = useUserData();
  const [activeTab, setActiveTab] = useState('overview');
  const [bills, setBills] = useState<Bill[]>([]);
  const [envelopes, setEnvelopes] = useState<BudgetEnvelope[]>([]);
  const [spendEntries, setSpendEntries] = useState<SpendEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isLoaded) return;
    
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    if (userData && userData.household) {
      const householdPlan = userData.household.plan || 'free';
      
      // Check if user has access to any finance features
      const hasBillAccess = canAccessFeature(householdPlan, 'bill_management');
      const hasEnvelopeAccess = canAccessFeature(householdPlan, 'budget_envelopes');
      const hasSpendingAccess = canAccessFeature(householdPlan, 'spending_tracking');
      
      if (!hasBillAccess && !hasEnvelopeAccess && !hasSpendingAccess) {
        router.push('/upgrade');
        return;
      }

      fetchFinanceData();
    }
  }, [isLoaded, isSignedIn, userData, router]);

  const fetchFinanceData = async () => {
    try {
      setLoading(true);
      
      // Fetch bills if user has access
      if (canAccessFeature(userData?.household?.plan || 'free', 'bill_management')) {
        const billsResponse = await fetch('/api/finance/bills');
        console.log('Bills response status:', billsResponse.status);
        if (billsResponse.ok) {
          const billsData = await billsResponse.json();
          console.log('Bills data received:', billsData);
          setBills(billsData.bills || []);
        } else {
          console.error('Failed to fetch bills:', billsResponse.status, billsResponse.statusText);
        }
      }

      // Fetch budget envelopes if user has access
      if (canAccessFeature(userData?.household?.plan || 'free', 'budget_envelopes')) {
        const envelopesResponse = await fetch('/api/finance/budget-envelopes');
        if (envelopesResponse.ok) {
          const envelopesData = await envelopesResponse.json();
          setEnvelopes(envelopesData.envelopes || []);
        }
      }

      // Fetch spend entries if user has access
      if (canAccessFeature(userData?.household?.plan || 'free', 'spending_tracking')) {
        const spendResponse = await fetch('/api/finance/spend-entries');
        if (spendResponse.ok) {
          const spendData = await spendResponse.json();
          setSpendEntries(spendData.spend_entries || []);
        }
      }
    } catch (error) {
      console.error('Error fetching finance data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isLoaded || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  if (isError || !userData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Finance Data</h1>
          <p className="text-gray-600">Please try refreshing the page or contact support if the issue persists.</p>
        </div>
      </div>
    );
  }

  const householdPlan = userData.household?.plan || 'free';
  const hasBillAccess = canAccessFeature(householdPlan, 'bill_management');
  const hasEnvelopeAccess = canAccessFeature(householdPlan, 'budget_envelopes');
  const hasSpendingAccess = canAccessFeature(householdPlan, 'spending_tracking');

  // Calculate overview statistics
  const totalBills = bills.length;
  const pendingBills = bills.filter(bill => bill.status === 'pending').length;
  const overdueBills = bills.filter(bill => bill.status === 'overdue').length;
  const totalBillAmount = bills
    .filter(bill => bill.status === 'pending')
    .reduce((sum, bill) => sum + bill.amount, 0);

  const totalEnvelopes = envelopes.length;
  const totalAllocated = envelopes.reduce((sum, env) => sum + env.allocated_amount, 0);
  const totalSpent = envelopes.reduce((sum, env) => sum + env.spent_amount, 0);
  const totalRemaining = totalAllocated - totalSpent;

  const recentSpending = spendEntries.slice(0, 5);
  const totalSpentToday = spendEntries
    .filter(entry => entry.transaction_date === new Date().toISOString().split('T')[0])
    .reduce((sum, entry) => sum + entry.amount, 0);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'overdue': return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      default: return <Calendar className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      paid: 'bg-green-100 text-green-800',
      overdue: 'bg-red-100 text-red-800',
      pending: 'bg-yellow-100 text-yellow-800',
      cancelled: 'bg-gray-100 text-gray-800'
    };
    return variants[status as keyof typeof variants] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Finance</h1>
          <p className="text-gray-600 mt-2">Manage your household finances, bills, and budgets</p>
        </div>
        <div className="flex gap-2">
          {hasBillAccess && (
            <Button onClick={() => router.push('/finance/bills/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Bill
            </Button>
          )}
          {hasSpendingAccess && (
            <Button variant="outline" onClick={() => router.push('/finance/spending/new')}>
              <Plus className="h-4 w-4 mr-2" />
              Add Expense
            </Button>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          {hasBillAccess && <TabsTrigger value="bills">Bills</TabsTrigger>}
          {hasEnvelopeAccess && <TabsTrigger value="envelopes">Budgets</TabsTrigger>}
          {hasSpendingAccess && <TabsTrigger value="spending">Spending</TabsTrigger>}
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Overview Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {hasBillAccess && (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Bills</CardTitle>
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalBills}</div>
                    <p className="text-xs text-muted-foreground">
                      {pendingBills} pending, {overdueBills} overdue
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Amount Due</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${totalBillAmount.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">
                      From {pendingBills} pending bills
                    </p>
                  </CardContent>
                </Card>
              </>
            )}

            {hasEnvelopeAccess && (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Budget Envelopes</CardTitle>
                    <PiggyBank className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalEnvelopes}</div>
                    <p className="text-xs text-muted-foreground">
                      ${totalRemaining.toFixed(2)} remaining
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Spent This Period</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${totalSpent.toFixed(2)}</div>
                    <p className="text-xs text-muted-foreground">
                      of ${totalAllocated.toFixed(2)} allocated
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          {/* Recent Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {hasBillAccess && (
              <Card>
                <CardHeader>
                  <CardTitle>Upcoming Bills</CardTitle>
                  <CardDescription>Bills due in the next 7 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {bills
                      .filter(bill => bill.status === 'pending')
                      .slice(0, 5)
                      .map((bill) => (
                        <div key={bill.id} className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {getStatusIcon(bill.status)}
                            <div>
                              <p className="font-medium">{bill.title}</p>
                              <p className="text-sm text-gray-500">
                                Due {new Date(bill.due_date).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">${bill.amount.toFixed(2)}</p>
                            <Badge className={getStatusBadge(bill.status)}>
                              {bill.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    {bills.filter(bill => bill.status === 'pending').length === 0 && (
                      <p className="text-gray-500 text-center py-4">No upcoming bills</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {hasSpendingAccess && (
              <Card>
                <CardHeader>
                  <CardTitle>Recent Spending</CardTitle>
                  <CardDescription>Latest transactions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentSpending.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{entry.description}</p>
                          <p className="text-sm text-gray-500">
                            {entry.merchant && `${entry.merchant} • `}
                            {new Date(entry.transaction_date).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">-${entry.amount.toFixed(2)}</p>
                          {entry.budget_envelopes && (
                            <Badge variant="outline" className="text-xs">
                              {entry.budget_envelopes.name}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                    {recentSpending.length === 0 && (
                      <p className="text-gray-500 text-center py-4">No recent spending</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {hasBillAccess && (
          <TabsContent value="bills" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>All Bills</CardTitle>
                <CardDescription>Manage your household bills and payments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {bills.map((bill) => (
                    <div key={bill.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center space-x-4">
                        {getStatusIcon(bill.status)}
                        <div>
                          <p className="font-medium">{bill.title}</p>
                          <p className="text-sm text-gray-500">
                            {bill.description && `${bill.description} • `}
                            Due {new Date(bill.due_date).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <p className="font-medium">${bill.amount.toFixed(2)}</p>
                          <Badge className={getStatusBadge(bill.status)}>
                            {bill.status}
                          </Badge>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/finance/bills/${bill.id}`)}
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  ))}
                  {bills.length === 0 && (
                    <div className="text-center py-8">
                      <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 mb-4">No bills yet</p>
                      <Button onClick={() => router.push('/finance/bills/new')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Bill
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {hasEnvelopeAccess && (
          <TabsContent value="envelopes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Budget Envelopes</CardTitle>
                <CardDescription>Track your spending with envelope budgeting</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {envelopes.map((envelope) => (
                    <div key={envelope.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <div 
                            className="w-4 h-4 rounded-full"
                            style={{ backgroundColor: envelope.color }}
                          />
                          <h3 className="font-medium">{envelope.name}</h3>
                        </div>
                        <div className="text-right">
                          <p className="font-medium">${envelope.remaining_amount.toFixed(2)}</p>
                          <p className="text-sm text-gray-500">remaining</p>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                        <div 
                          className="h-2 rounded-full transition-all duration-300"
                          style={{ 
                            backgroundColor: envelope.color,
                            width: `${Math.min(envelope.spent_percentage, 100)}%`
                          }}
                        />
                      </div>
                      <div className="flex justify-between text-sm text-gray-500">
                        <span>${envelope.spent_amount.toFixed(2)} of ${envelope.allocated_amount.toFixed(2)}</span>
                        <span>{envelope.spent_percentage.toFixed(1)}% spent</span>
                      </div>
                    </div>
                  ))}
                  {envelopes.length === 0 && (
                    <div className="text-center py-8">
                      <PiggyBank className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 mb-4">No budget envelopes yet</p>
                      <Button onClick={() => router.push('/finance/envelopes/new')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Your First Envelope
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {hasSpendingAccess && (
          <TabsContent value="spending" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Spending History</CardTitle>
                <CardDescription>Track your expenses and transactions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {spendEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div>
                        <p className="font-medium">{entry.description}</p>
                        <p className="text-sm text-gray-500">
                          {entry.merchant && `${entry.merchant} • `}
                          {new Date(entry.transaction_date).toLocaleDateString()}
                          {entry.budget_envelopes && ` • ${entry.budget_envelopes.name}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-red-600">-${entry.amount.toFixed(2)}</p>
                        <Badge variant="outline" className="text-xs">
                          {entry.payment_method}
                        </Badge>
                      </div>
                    </div>
                  ))}
                  {spendEntries.length === 0 && (
                    <div className="text-center py-8">
                      <TrendingUp className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500 mb-4">No spending recorded yet</p>
                      <Button onClick={() => router.push('/finance/spending/new')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Your First Expense
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
