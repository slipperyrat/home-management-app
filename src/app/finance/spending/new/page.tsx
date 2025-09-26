'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { useUserData } from '@/hooks/useUserData';
import { canAccessFeature } from '@/lib/server/canAccessFeature';
import { fetchWithCSRF } from '@/lib/csrf-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';

interface BudgetEnvelope {
  id: string;
  name: string;
  allocated_amount: number;
  spent_amount: number;
  remaining_amount: number;
}

export default function NewSpendingPage() {
  const router = useRouter();
  const { isSignedIn, isLoaded } = useAuth();
  const { userData, isLoading } = useUserData();
  const [loading, setLoading] = useState(false);
  const [envelopes, setEnvelopes] = useState<BudgetEnvelope[]>([]);
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category: '',
    envelope_id: '',
    transaction_date: new Date().toISOString().split('T')[0],
    merchant: '',
    payment_method: 'other' as 'cash' | 'card' | 'bank_transfer' | 'other',
    source: 'manual' as 'manual' | 'receipt_ocr' | 'bill_payment' | 'import'
  });

  useEffect(() => {
    if (!isLoaded) return;
    
    if (!isSignedIn) {
      router.push('/sign-in');
      return;
    }

    if (userData && userData.household) {
      const householdPlan = userData.household.plan || 'free';
      
      if (!canAccessFeature(householdPlan, 'spending_tracking')) {
        router.push('/upgrade');
        return;
      }

      // Fetch budget envelopes if user has access
      if (canAccessFeature(householdPlan, 'budget_envelopes')) {
        fetchEnvelopes();
      }
    }
  }, [isLoaded, isSignedIn, userData, router]);

  const fetchEnvelopes = async () => {
    try {
      const response = await fetch('/api/finance/budget-envelopes');
      if (response.ok) {
        const data = await response.json();
        setEnvelopes(data.envelopes || []);
      }
    } catch (error) {
      console.error('Error fetching envelopes:', error);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userData?.household) {
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetchWithCSRF('/api/finance/spend-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
          envelope_id: formData.envelope_id || undefined
        })
      });

      if (response.ok) {
        router.push('/finance');
      } else {
        const error = await response.json();
        console.error('Error creating spend entry:', error);
        alert('Failed to create expense. Please try again.');
      }
    } catch (error) {
      console.error('Error creating spend entry:', error);
      alert('Failed to create expense. Please try again.');
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Add New Expense</h1>
          <p className="text-gray-600 mt-2">Record a new spending transaction</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Expense Details</CardTitle>
          <CardDescription>Enter the details for your expense</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="amount">Amount *</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => handleInputChange('amount', e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="transaction_date">Date *</Label>
                <Input
                  id="transaction_date"
                  type="date"
                  value={formData.transaction_date}
                  onChange={(e) => handleInputChange('transaction_date', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description *</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="e.g., Grocery shopping at Coles"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="merchant">Merchant</Label>
              <Input
                id="merchant"
                value={formData.merchant}
                onChange={(e) => handleInputChange('merchant', e.target.value)}
                placeholder="e.g., Coles, Woolworths, Amazon"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="groceries">Groceries</SelectItem>
                    <SelectItem value="utilities">Utilities</SelectItem>
                    <SelectItem value="transportation">Transportation</SelectItem>
                    <SelectItem value="entertainment">Entertainment</SelectItem>
                    <SelectItem value="healthcare">Healthcare</SelectItem>
                    <SelectItem value="dining">Dining Out</SelectItem>
                    <SelectItem value="shopping">Shopping</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_method">Payment Method</Label>
                <Select value={formData.payment_method} onValueChange={(value) => handleInputChange('payment_method', value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {envelopes.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="envelope_id">Budget Envelope (Optional)</Label>
                <Select value={formData.envelope_id} onValueChange={(value) => handleInputChange('envelope_id', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select envelope" />
                  </SelectTrigger>
                  <SelectContent>
                    {envelopes.map((envelope) => (
                      <SelectItem key={envelope.id} value={envelope.id}>
                        {envelope.name} (${envelope.remaining_amount.toFixed(2)} remaining)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-end gap-4 pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Add Expense
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
