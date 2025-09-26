#!/usr/bin/env node

/**
 * Finance API Test Script
 * Tests the finance module endpoints
 */

const BASE_URL = 'http://localhost:3000';

// Mock authentication token (you'll need to replace this with a real token)
const AUTH_TOKEN = 'test-token';

async function makeRequest(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
      ...options.headers
    },
    ...options
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    console.log(`\n🔍 ${options.method || 'GET'} ${endpoint}`);
    console.log(`Status: ${response.status} ${response.statusText}`);
    
    if (response.ok) {
      console.log('✅ Success:', JSON.stringify(data, null, 2));
    } else {
      console.log('❌ Error:', JSON.stringify(data, null, 2));
    }
    
    return { response, data };
  } catch (error) {
    console.log(`❌ Network Error: ${error.message}`);
    return { error };
  }
}

async function testFinanceAPI() {
  console.log('🚀 Testing Finance API Endpoints\n');
  
  // Test 1: Get Bills
  console.log('='.repeat(50));
  console.log('TEST 1: Get Bills');
  console.log('='.repeat(50));
  await makeRequest('/api/finance/bills');
  
  // Test 2: Create a Bill
  console.log('='.repeat(50));
  console.log('TEST 2: Create Bill');
  console.log('='.repeat(50));
  const billData = {
    title: 'Test Electricity Bill',
    description: 'Monthly electricity bill for testing',
    amount: 89.50,
    currency: 'AUD',
    due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
    category: 'utilities',
    priority: 'medium'
  };
  
  const billResult = await makeRequest('/api/finance/bills', {
    method: 'POST',
    body: JSON.stringify(billData)
  });
  
  // Test 3: Get Budget Envelopes
  console.log('='.repeat(50));
  console.log('TEST 3: Get Budget Envelopes');
  console.log('='.repeat(50));
  await makeRequest('/api/finance/budget-envelopes');
  
  // Test 4: Create Budget Envelope
  console.log('='.repeat(50));
  console.log('TEST 4: Create Budget Envelope');
  console.log('='.repeat(50));
  const envelopeData = {
    name: 'Test Groceries Budget',
    description: 'Monthly grocery budget for testing',
    allocated_amount: 400.00,
    period_start: new Date().toISOString().split('T')[0],
    period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days from now
    category: 'groceries',
    color: '#10B981'
  };
  
  const envelopeResult = await makeRequest('/api/finance/budget-envelopes', {
    method: 'POST',
    body: JSON.stringify(envelopeData)
  });
  
  // Test 5: Get Spending Entries
  console.log('='.repeat(50));
  console.log('TEST 5: Get Spending Entries');
  console.log('='.repeat(50));
  await makeRequest('/api/finance/spend-entries');
  
  // Test 6: Create Spending Entry
  console.log('='.repeat(50));
  console.log('TEST 6: Create Spending Entry');
  console.log('='.repeat(50));
  const spendingData = {
    amount: 45.67,
    description: 'Test grocery shopping at Coles',
    category: 'groceries',
    transaction_date: new Date().toISOString().split('T')[0],
    merchant: 'Coles',
    payment_method: 'card'
  };
  
  const spendingResult = await makeRequest('/api/finance/spend-entries', {
    method: 'POST',
    body: JSON.stringify(spendingData)
  });
  
  // Test 7: Get Receipt to Spending
  console.log('='.repeat(50));
  console.log('TEST 7: Get Receipt to Spending');
  console.log('='.repeat(50));
  await makeRequest('/api/finance/receipt-to-spending');
  
  console.log('\n🎉 Finance API Testing Complete!');
  console.log('\nNote: Some tests may fail due to authentication or database setup.');
  console.log('This is expected if the database schema hasn\'t been applied yet.');
}

// Run the tests
testFinanceAPI().catch(console.error);
