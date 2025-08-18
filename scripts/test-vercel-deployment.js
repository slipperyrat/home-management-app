const fetch = require('node-fetch');

async function testVercelDeployment() {
  const baseUrl = 'https://home-management-app-two.vercel.app';
  
  console.log('🧪 Testing Vercel Deployment...');
  console.log('📍 Base URL:', baseUrl);
  console.log('');

  // Test 1: Check if the main page loads
  console.log('🔍 Test 1: Main Page Accessibility...');
  try {
    const response = await fetch(`${baseUrl}/ai-email-dashboard`);
    console.log(`  Status: ${response.status} ${response.statusText}`);
    if (response.ok) {
      console.log('  ✅ Main page accessible');
    } else {
      console.log('  ❌ Main page not accessible');
    }
  } catch (error) {
    console.log('  ❌ Error accessing main page:', error.message);
  }

  // Test 2: Check if the API endpoint exists
  console.log('\n🔍 Test 2: API Endpoint Check...');
  try {
    const response = await fetch(`${baseUrl}/api/ai/process-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        emailData: {
          subject: 'Test Email',
          body: 'This is a test email body',
          from: 'test@example.com',
          date: new Date().toISOString()
        }
      })
    });
    
    console.log(`  Status: ${response.status} ${response.statusText}`);
    
    if (response.status === 401) {
      console.log('  ✅ API endpoint exists (401 Unauthorized expected)');
    } else if (response.status === 500) {
      console.log('  ⚠️  API endpoint exists but returns 500 error');
      const errorText = await response.text();
      console.log('  Error details:', errorText.substring(0, 200));
    } else {
      console.log('  ❌ Unexpected response');
    }
  } catch (error) {
    console.log('  ❌ Error testing API:', error.message);
  }

  // Test 3: Check environment variables (indirectly)
  console.log('\n🔍 Test 3: Environment Check...');
  console.log('  💡 Check Vercel dashboard for these environment variables:');
  console.log('    - OPENAI_API_KEY');
  console.log('    - SUPABASE_SERVICE_ROLE_KEY');
  console.log('    - NEXT_PUBLIC_APP_URL (should be https://home-management-app-two.vercel.app)');
  console.log('    - NEXT_PUBLIC_SUPABASE_URL');
  console.log('    - NEXT_PUBLIC_SUPABASE_ANON_KEY');

  console.log('\n🎯 Next Steps:');
  console.log('  1. Update environment variables in Vercel dashboard');
  console.log('  2. Redeploy the application');
  console.log('  3. Test again');
}

// Run the test
testVercelDeployment();
