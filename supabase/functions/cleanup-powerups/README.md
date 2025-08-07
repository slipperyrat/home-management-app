# Cleanup Power-ups Edge Function

This Supabase Edge Function automatically removes expired power-ups from the database.

## 🚀 Deployment

### Prerequisites
- Supabase CLI installed
- Access to your Supabase project

### Deploy the Function

```bash
# Navigate to your project root
cd /path/to/your/project

# Deploy the function
supabase functions deploy cleanup-powerups
```

### Set Environment Variables

The function requires these environment variables to be set in your Supabase project:

```bash
supabase secrets set SUPABASE_URL=your_supabase_url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 📋 Usage

### Endpoint
```
POST https://your-project-ref.supabase.co/functions/v1/cleanup-powerups
```

### Headers
```
Content-Type: application/json
Authorization: Bearer your_anon_key_or_service_role_key
```

### Request Body
No body required - the function operates without input parameters.

### Response

**Success (200):**
```json
{
  "success": true,
  "deletedCount": 5,
  "message": "Cleaned up 5 expired power-ups",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

**Error (500):**
```json
{
  "error": "Failed to delete expired power-ups",
  "details": "Error message from Supabase"
}
```

## 🔧 How It Works

1. **Validates Request**: Only accepts POST requests
2. **Environment Check**: Verifies required environment variables
3. **Database Cleanup**: Deletes all power-ups where:
   - `expires_at` is not null (excludes permanent power-ups)
   - `expires_at` is less than current timestamp
4. **Returns Results**: Provides count of deleted records

## 🛡️ Security

- Uses service role key for elevated database permissions
- Includes CORS headers for cross-origin requests
- Validates request method
- Comprehensive error handling

## 📊 Monitoring

The function logs:
- Start of cleanup process
- Current timestamp
- Number of deleted records
- Any errors encountered

Check your Supabase dashboard logs to monitor function execution.

## 🔄 Scheduling

You can call this function:
- Manually via API
- Using a cron job
- Through Supabase's scheduled functions (if available)
- As part of your application's maintenance routine

## 🧪 Testing

Test the function locally:

```bash
# Start Supabase locally
supabase start

# Test the function
curl -X POST http://localhost:54321/functions/v1/cleanup-powerups \
  -H "Content-Type: application/json"
``` 