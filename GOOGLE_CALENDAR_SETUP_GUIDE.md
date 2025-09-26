# Google Calendar Integration Setup Guide

## Overview
The Google Calendar integration allows Pro users to import events from their Google Calendar into the household calendar. This requires Google OAuth2 credentials to be set up.

## Prerequisites
- A Google account
- Access to Google Cloud Console
- Pro subscription (for testing)

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID

## Step 2: Enable Google Calendar API

1. In the Google Cloud Console, go to "APIs & Services" > "Library"
2. Search for "Google Calendar API"
3. Click on it and press "Enable"

## Step 3: Create OAuth2 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth 2.0 Client IDs"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" user type
   - Fill in required fields (App name, User support email, Developer contact)
   - Add your email to test users
4. Choose "Web application" as the application type
5. Add these authorized redirect URIs:
   - `http://localhost:3000/api/google-calendar/callback`
   - `http://localhost:3001/api/google-calendar/callback`
   - `https://yourdomain.com/api/google-calendar/callback` (for production)
6. Click "Create"
7. Copy the Client ID and Client Secret

## Step 4: Update Environment Variables

Add these variables to your `.env.local` file:

```bash
# Google Calendar Integration (Pro Feature)
GOOGLE_CLIENT_ID=your_actual_client_id_here
GOOGLE_CLIENT_SECRET=your_actual_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:3000/api/google-calendar/callback
```

## Step 5: Test the Integration

1. Restart your development server
2. Navigate to `/calendar/sync`
3. Click "Connect Google Calendar"
4. You should be redirected to Google's OAuth consent screen
5. After authorization, you'll be redirected back to the app

## Troubleshooting

### Common Issues:

1. **"Missing Google OAuth2 configuration"**
   - Make sure all three environment variables are set
   - Restart the development server after adding them

2. **"redirect_uri_mismatch"**
   - Ensure the redirect URI in Google Cloud Console matches exactly
   - Check for trailing slashes or http vs https

3. **"access_denied"**
   - Make sure your email is added to test users in OAuth consent screen
   - Check that the app is not in "Testing" mode with restricted access

4. **"invalid_client"**
   - Double-check the Client ID and Client Secret
   - Ensure there are no extra spaces or characters

## Security Notes

- Never commit your `.env.local` file to version control
- Use different credentials for development and production
- Regularly rotate your OAuth2 credentials
- Monitor API usage in Google Cloud Console

## Production Deployment

When deploying to production:

1. Update the redirect URI to your production domain
2. Add your production domain to authorized origins
3. Update the OAuth consent screen with production details
4. Consider moving from "Testing" to "In production" status

## API Quotas

- Google Calendar API has quotas and rate limits
- Monitor usage in Google Cloud Console
- Consider implementing caching for frequently accessed data
