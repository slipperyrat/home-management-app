'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { useUserData } from '@/hooks/useUserData';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Database } from '@/types/supabase';
import { postEventTypes } from '@/lib/postEvent';
import Link from 'next/link';

interface Bill {
  id: string;
  name: string;
  amount: number;
  currency: string;
  due_date: string;
  status: string;
  category: string;
  description: string;
  source: string;
  created_at: string;
}

export default function BillsPage() {
  const { user } = useUser();
  const { userData } = useUserData();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newBill, setNewBill] = useState({
    name: '',
    amount: '',
    due_date: '',
    category: 'utilities',
    description: ''
  });

  const supabase = createClientComponentClient<Database>();

  useEffect(() => {
    if (userData?.household_id) {
      fetchBills();
    }
  }, [userData?.household_id]);

  const fetchBills = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('bills')
        .select('*')
        .eq('household_id', userData?.household_id)
        .order('due_date', { ascending: true });

      if (error) throw error;
      
      setBills(data || []);
    } catch (err) {
      console.error('Error fetching bills:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch bills');
    } finally {
      setLoading(false);
    }
  };

  const createBill = async () => {
    if (!userData?.household_id || !newBill.name || !newBill.amount || !newBill.due_date) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Create the bill
      const { data, error } = await supabase
        .from('bills')
        .insert({
          household_id: userData.household_id,
          name: newBill.name,
          amount: parseFloat(newBill.amount),
          due_date: newBill.due_date,
          category: newBill.category,
          description: newBill.description,
          source: 'manual',
          created_by: user?.id || ''
        })
        .select()
        .single();

      if (error) throw error;

      // Post an event for the new bill
      await postEventTypes.billReceived(userData.household_id, {
        billId: data.id,
        name: data.name,
        amount: data.amount,
        dueDate: data.due_date
      });

      // Reset form and refresh bills
      setNewBill({
        name: '',
        amount: '',
        due_date: '',
        category: 'utilities',
        description: ''
      });
      setShowCreateForm(false);
      await fetchBills();

    } catch (err) {
      console.error('Error creating bill:', err);
      setError(err instanceof Error ? err.message : 'Failed to create bill');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'text-green-600 bg-green-100';
      case 'overdue': return 'text-red-600 bg-red-100';
      case 'pending': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'utilities': return '⚡';
      case 'rent': return '🏠';
      case 'insurance': return '🛡️';
      case 'internet': return '🌐';
      case 'phone': return '📱';
      default: return '📄';
    }
  };

  if (!user || !userData?.household_id) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bills</h1>
          <p>Please sign in and complete onboarding to view bills.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Bills</h1>
          <p className="text-gray-600">
            Manage your household bills and track due dates
          </p>
        </div>

        {/* Create Bill Button */}
        <div className="mb-6">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            {showCreateForm ? 'Cancel' : 'Add New Bill'}
          </button>
        </div>

        {/* Create Bill Form */}
        {showCreateForm && (
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            <h2 className="text-lg font-medium mb-4">Add New Bill</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bill Name *
                </label>
                <input
                  type="text"
                  value={newBill.name}
                  onChange={(e) => setNewBill({ ...newBill, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Electricity Bill"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount *
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newBill.amount}
                  onChange={(e) => setNewBill({ ...newBill, amount: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date *
                </label>
                <input
                  type="date"
                  value={newBill.due_date}
                  onChange={(e) => setNewBill({ ...newBill, due_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={newBill.category}
                  onChange={(e) => setNewBill({ ...newBill, category: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="utilities">Utilities</option>
                  <option value="rent">Rent</option>
                  <option value="insurance">Insurance</option>
                  <option value="internet">Internet</option>
                  <option value="phone">Phone</option>
                  <option value="other">Other</option>
                </select>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={newBill.description}
                  onChange={(e) => setNewBill({ ...newBill, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Optional description or notes"
                />
              </div>
            </div>
            
            <div className="mt-4 flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={createBill}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Bill'}
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Bills List */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Your Bills</h2>
          </div>
          
          {loading ? (
            <div className="px-6 py-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : bills.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-gray-500">
                No bills found. Create your first bill above!
              </div>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {bills.map((bill) => (
                <div key={bill.id} className="px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="text-2xl">{getCategoryIcon(bill.category)}</span>
                      <div>
                        <h3 className="text-sm font-medium text-gray-900">{bill.name}</h3>
                        <p className="text-sm text-gray-500">
                          {bill.category} • Due {new Date(bill.due_date).toLocaleDateString()}
                        </p>
                        {bill.description && (
                          <p className="text-xs text-gray-400 mt-1">{bill.description}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className="text-lg font-semibold text-gray-900">
                        ${bill.amount.toFixed(2)}
                      </div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(bill.status)}`}>
                        {bill.status}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Automation Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-blue-800 mb-2">Automation Ready</h3>
          <p className="text-sm text-blue-700">
            This bills system is integrated with the automation engine. When you create bills manually or receive them via email, 
            automation rules can trigger actions like notifications, reminders, and more. Check the{' '}
            <Link href="/inbox" className="underline">Inbox</Link> to see automation events in action.
          </p>
        </div>
      </div>
    </div>
  );
}
