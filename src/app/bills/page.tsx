'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import { toast } from 'sonner';
import { postEventTypes } from '@/lib/postEvent';

interface Bill {
  id: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  due_date: string;
  issued_date: string;
  paid_date?: string;
  status: 'pending' | 'paid' | 'overdue' | 'cancelled';
  category?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  source: string;
  created_at: string;
}

export default function BillsPage() {
  const { user } = useUser();
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingBill, setCreatingBill] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    amount: '',
    due_date: '',
    category: 'General',
    priority: 'medium' as const
  });

  useEffect(() => {
    if (user) {
      fetchBills();
    }
  }, [user]);

  const fetchBills = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/bills');
      
      if (response.ok) {
        const data = await response.json();
        setBills(data.bills || []);
      } else {
        console.error('Failed to fetch bills');
        toast.error('Failed to load bills');
      }
    } catch (error) {
      console.error('Error fetching bills:', error);
      toast.error('Error loading bills');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.amount || !formData.due_date) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      setCreatingBill(true);
      
      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        await response.json();
        toast.success('Bill created successfully!');
        
        // Reset form and refresh bills
        setFormData({
          title: '',
          description: '',
          amount: '',
          due_date: '',
          category: 'General',
          priority: 'medium'
        });
        setShowCreateForm(false);
        fetchBills();
        
        // Trigger automation event
        try {
          await postEventTypes.billCreated({
            title: formData.title,
            amount: parseFloat(formData.amount),
            due_date: formData.due_date,
            category: formData.category
          });
        } catch (error) {
          console.error('Failed to trigger automation event:', error);
        }
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to create bill');
      }
    } catch (error) {
      console.error('Error creating bill:', error);
      toast.error('Something went wrong. Please try again.');
    } finally {
      setCreatingBill(false);
    }
  };

  const handleMarkAsPaid = async (billId: string) => {
    try {
      const response = await fetch(`/api/bills/${billId}/mark-paid`, {
        method: 'POST',
      });

      if (response.ok) {
        toast.success('Bill marked as paid!');
        fetchBills();
        
        // Trigger automation event
        try {
          await postEventTypes.billPaid({ bill_id: billId });
        } catch (error) {
          console.error('Failed to trigger automation event:', error);
        }
      } else {
        toast.error('Failed to mark bill as paid');
      }
    } catch (error) {
      console.error('Error marking bill as paid:', error);
      toast.error('Something went wrong');
    }
  };

  const handleTestAutomation = async () => {
    try {
      // Trigger a test bill event
      await postEventTypes.billEmailReceived({
        subject: 'Test Electricity Bill',
        amount: 89.50,
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        vendor: 'Origin Energy'
      });
      
      toast.success('Test automation event triggered! Check the Inbox for details.');
    } catch (error) {
      console.error('Error triggering test automation:', error);
      toast.error('Failed to trigger test automation');
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

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading bills...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">💰 Bills</h1>
              <p className="text-gray-600">Manage your household bills and automate bill tracking</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={handleTestAutomation}
                className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
              >
                🧪 Test Automation
              </button>
              <button
                onClick={() => setShowCreateForm(!showCreateForm)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                {showCreateForm ? 'Cancel' : '+ Add Bill'}
              </button>
            </div>
          </div>
        </div>

        {/* Create Bill Form */}
        {showCreateForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Create New Bill</h2>
            <form onSubmit={handleCreateBill} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                    Bill Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Electricity Bill - January 2024"
                  />
                </div>
                
                <div>
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                    Amount (AUD) *
                  </label>
                  <input
                    type="number"
                    id="amount"
                    required
                    step="0.01"
                    min="0"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="89.50"
                  />
                </div>
                
                <div>
                  <label htmlFor="due_date" className="block text-sm font-medium text-gray-700 mb-1">
                    Due Date *
                  </label>
                  <input
                    type="date"
                    id="due_date"
                    required
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <select
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="General">General</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Insurance">Insurance</option>
                    <option value="Rent/Mortgage">Rent/Mortgage</option>
                    <option value="Subscriptions">Subscriptions</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                  </label>
                  <select
                    id="priority"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                
                <div className="md:col-span-2">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    id="description"
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Optional description or notes about this bill"
                  />
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingBill}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {creatingBill ? 'Creating...' : 'Create Bill'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Bills List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Your Bills</h2>
            <p className="text-sm text-gray-600 mt-1">
              {bills.length} bill{bills.length !== 1 ? 's' : ''} • 
              {bills.filter(b => b.status === 'pending').length} pending • 
              {bills.filter(b => b.status === 'overdue').length} overdue
            </p>
          </div>
          
          {bills.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <div className="text-gray-400 text-6xl mb-4">💰</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No bills yet</h3>
              <p className="text-gray-600 mb-4">
                Create your first bill to get started with automated bill management.
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Create Your First Bill
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {bills.map((bill) => (
                <div key={bill.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">{bill.title}</h3>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(bill.status)}`}>
                          {bill.status}
                        </span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPriorityColor(bill.priority)}`}>
                          {bill.priority}
                        </span>
                      </div>
                      
                      {bill.description && (
                        <p className="text-gray-600 text-sm mb-2">{bill.description}</p>
                      )}
                      
                      <div className="flex items-center space-x-6 text-sm text-gray-500">
                        <span>Amount: <span className="font-medium text-gray-900">${bill.amount}</span></span>
                        <span>Due: <span className="font-medium text-gray-900">{new Date(bill.due_date).toLocaleDateString()}</span></span>
                        {bill.category && <span>Category: <span className="font-medium text-gray-900">{bill.category}</span></span>}
                        <span>Source: <span className="font-medium text-gray-900">{bill.source}</span></span>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      {bill.status === 'pending' && (
                        <button
                          onClick={() => handleMarkAsPaid(bill.id)}
                          className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors"
                        >
                          Mark Paid
                        </button>
                      )}
                      <button className="px-3 py-1 border border-gray-300 text-gray-700 text-sm rounded-md hover:bg-gray-50 transition-colors">
                        Edit
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Automation Info */}
        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">🤖 Automation Features</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-blue-800">
            <div>
              <h4 className="font-medium mb-1">📧 Email Integration</h4>
              <p>Automatically create bills from email receipts</p>
            </div>
            <div>
              <h4 className="font-medium mb-1">⏰ Smart Reminders</h4>
              <p>Get notified before bills are due</p>
            </div>
            <div>
              <h4 className="font-medium mb-1">📊 Status Tracking</h4>
              <p>Automatically mark bills as overdue</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
