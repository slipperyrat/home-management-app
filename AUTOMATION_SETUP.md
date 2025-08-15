# Automation System Setup Guide

This guide will help you set up and test the AI automation system for your home management app.

## Overview

The automation system consists of:
- **Events**: A log of all household activities and system events
- **Rules**: Configurable automation triggers that respond to events
- **Jobs**: Queued actions that get executed by the automation worker
- **Actions**: Specific operations like creating bills, sending notifications, etc.

## Database Setup

### 1. Run the Schema

First, run the automation schema in your Supabase SQL editor:

```sql
-- Copy and paste the contents of supabase/automation_core_schema.sql
```

This will create:
- `household_events` - Event log table
- `automation_rules` - Automation rule definitions
- `automation_jobs` - Queued automation jobs
- `bills` - Bills management table
- `notifications` - System notifications table

### 2. Verify RLS Policies

The schema includes Row Level Security (RLS) policies that ensure:
- Users can only see events from their household
- Only household owners can create/modify automation rules
- Automation jobs are visible to household members

## Edge Functions Setup

### 1. Deploy the Dispatcher

Deploy the automation dispatcher function:

```bash
supabase functions deploy automation-dispatcher
```

### 2. Deploy the Worker

Deploy the automation worker function:

```bash
supabase functions deploy automation-worker
```

### 3. Set Environment Variables

Ensure these environment variables are set in your Supabase project:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Testing the System

### 1. Access the Test Page

Navigate to `/test-automation` in your app to access the testing interface.

### 2. Create a Test Rule

1. Click "Create Test Rule"
2. The default rule will trigger on heartbeat events
3. It will create a notification when triggered

### 3. Trigger Events

1. Click "Trigger Heartbeat Event" to manually create an event
2. The system will automatically create automation jobs
3. Check the Inbox to see the events

### 4. Monitor Automation Jobs

1. Click "Check Automation Jobs" to see queued jobs
2. Jobs will be processed by the automation worker
3. Check the Inbox for automation outputs

## How It Works

### Event Flow

1. **Event Creation**: Events are created via `postEvent()` calls
2. **Rule Matching**: The dispatcher finds rules that match the event type
3. **Job Creation**: Matching rules create automation jobs
4. **Job Processing**: The worker processes jobs and executes actions
5. **Results**: Actions create notifications, bills, or other outputs

### Event Types

- `heartbeat` - App activity events (automatic)
- `bill.email.received` - Email bill notifications
- `chore.completed` - Chore completion events
- `shopping_list.updated` - Shopping list changes

### Action Types

- `create_bill` - Creates a new bill record
- `notify` - Sends a notification to a user
- `update_shopping_list` - Updates shopping list items
- `assign_chore` - Assigns chores to household members

## Integration Points

### Bills System

The bills system demonstrates automation in action:
- Manual bill creation triggers events
- Events can trigger automation rules
- Rules can create notifications or other actions

### Inbox

The Inbox provides visibility into:
- All automation events
- Event details and payloads
- Automation job status

### Heartbeat System

Automatic heartbeat events:
- Run every 15 minutes while the app is active
- Trigger when the app becomes visible
- Provide a foundation for time-based automations

## Next Steps

### Phase 2: Email Integration

1. Set up email webhooks (Mailgun/Resend)
2. Parse incoming emails for bills
3. Automatically create bill records
4. Send notifications to household members

### Phase 3: Advanced Rules

1. Add conditional logic to rules
2. Implement time-based triggers
3. Add user preference-based automation
4. Create rule templates for common scenarios

### Phase 4: External Integrations

1. Grocery store APIs for shopping automation
2. Smart home device integration
3. Calendar conflict resolution
4. Payment processing integration

## Troubleshooting

### Common Issues

1. **Events not appearing**: Check RLS policies and user authentication
2. **Jobs not processing**: Verify Edge Function deployment and environment variables
3. **Rules not triggering**: Ensure rule trigger types match event types exactly
4. **Permission errors**: Verify user has owner role in household

### Debug Tools

- Use the Test Automation page to verify system components
- Check the Inbox for event visibility
- Monitor Edge Function logs in Supabase dashboard
- Use browser console to see client-side errors

### Testing Checklist

- [ ] Database schema deployed successfully
- [ ] Edge Functions deployed and accessible
- [ ] Test rule creation works
- [ ] Heartbeat events are generated
- [ ] Automation jobs are created
- [ ] Notifications appear in the system
- [ ] Bills can be created manually
- [ ] Events appear in the Inbox

## Support

If you encounter issues:
1. Check the browser console for errors
2. Verify Edge Function logs in Supabase
3. Ensure all environment variables are set
4. Test with the provided test automation page

The automation system is designed to be robust and provide clear visibility into all operations. Use the Inbox and test tools to debug any issues.
