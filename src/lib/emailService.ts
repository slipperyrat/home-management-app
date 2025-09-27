import { Resend } from 'resend';

import { logger } from '@/lib/logging/logger';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface DigestData {
  household_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  household_name: string;
  date: string;
  type: 'daily' | 'weekly';
  
  // Content data
  chores?: {
    pending: Array<{
      id: string;
      title: string;
      description?: string;
      priority: 'low' | 'medium' | 'high';
      due_date?: string;
      assigned_to?: string;
    }>;
    completed: Array<{
      id: string;
      title: string;
      completed_at: string;
      completed_by: string;
    }>;
  };
  
  meals?: {
    today: Array<{
      id: string;
      name: string;
      meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
      time?: string;
    }>;
    this_week: Array<{
      id: string;
      name: string;
      meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
      date: string;
    }>;
  };
  
  shopping?: {
    pending: Array<{
      id: string;
      name: string;
      quantity?: number;
      unit?: string;
      category?: string;
    }>;
    completed: Array<{
      id: string;
      name: string;
      completed_at: string;
    }>;
  };
  
  events?: {
    today: Array<{
      id: string;
      title: string;
      start_time: string;
      end_time: string;
      location?: string;
    }>;
    upcoming: Array<{
      id: string;
      title: string;
      start_time: string;
      end_time: string;
      location?: string;
    }>;
  };
  
  achievements?: Array<{
    id: string;
    title: string;
    description: string;
    earned_at: string;
    xp: number;
  }>;
  
  insights?: Array<{
    type: string;
    title: string;
    description: string;
    confidence: number;
  }>;
}

export class EmailService {
  /**
   * Send daily digest email
   */
  static async sendDailyDigest(data: DigestData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const html = this.generateDailyDigestHTML(data);
      const text = this.generateDailyDigestText(data);
      
      const result = await resend.emails.send({
        from: 'Home Management App <noreply@home-management-app.com>',
        to: [data.user_email],
        subject: `📅 Daily Digest - ${data.date}`,
        html,
        text,
      });

      return {
        success: true,
        messageId: result.data?.id,
      };
    } catch (error) {
      logger.error('Error sending daily digest', error as Error, {
        userId: data.user_id,
        householdId: data.household_id,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Send weekly digest email
   */
  static async sendWeeklyDigest(data: DigestData): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const html = this.generateWeeklyDigestHTML(data);
      const text = this.generateWeeklyDigestText(data);
      
      const result = await resend.emails.send({
        from: 'Home Management App <noreply@home-management-app.com>',
        to: [data.user_email],
        subject: `📊 Weekly Digest - ${data.household_name}`,
        html,
        text,
      });

      return {
        success: true,
        messageId: result.data?.id,
      };
    } catch (error) {
      logger.error('Error sending weekly digest', error as Error, {
        userId: data.user_id,
        householdId: data.household_id,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate HTML for daily digest
   */
  private static generateDailyDigestHTML(data: DigestData): string {
    const { user_name, household_name, date, chores, meals, shopping, events } = data;
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Daily Digest - ${date}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
            .header p { margin: 10px 0 0 0; opacity: 0.9; }
            .section { background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
            .section h2 { margin: 0 0 15px 0; color: #495057; font-size: 18px; display: flex; align-items: center; }
            .section h2::before { content: ''; width: 4px; height: 20px; background: #667eea; margin-right: 10px; border-radius: 2px; }
            .item { background: white; border-radius: 6px; padding: 15px; margin-bottom: 10px; border-left: 4px solid #e9ecef; }
            .item:last-child { margin-bottom: 0; }
            .item-title { font-weight: 600; color: #212529; margin-bottom: 5px; }
            .item-meta { font-size: 14px; color: #6c757d; }
            .priority-high { border-left-color: #dc3545; }
            .priority-medium { border-left-color: #ffc107; }
            .priority-low { border-left-color: #28a745; }
            .completed { opacity: 0.7; }
            .stats { display: flex; justify-content: space-around; text-align: center; margin: 20px 0; }
            .stat { flex: 1; }
            .stat-number { font-size: 24px; font-weight: 600; color: #667eea; }
            .stat-label { font-size: 14px; color: #6c757d; }
            .footer { text-align: center; margin-top: 30px; padding: 20px; color: #6c757d; font-size: 14px; }
            .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📅 Daily Digest</h1>
            <p>Good morning, ${user_name}! Here's what's happening in ${household_name} today.</p>
          </div>

          <div class="stats">
            <div class="stat">
              <div class="stat-number">${chores?.pending?.length || 0}</div>
              <div class="stat-label">Pending Chores</div>
            </div>
            <div class="stat">
              <div class="stat-number">${events?.today?.length || 0}</div>
              <div class="stat-label">Today's Events</div>
            </div>
            <div class="stat">
              <div class="stat-number">${shopping?.pending?.length || 0}</div>
              <div class="stat-label">Shopping Items</div>
            </div>
          </div>

          ${chores ? `
            <div class="section">
              <h2>🧹 Chores</h2>
              ${chores.pending?.length > 0 ? `
                ${chores.pending.map(chore => `
                  <div class="item priority-${chore.priority}">
                    <div class="item-title">${chore.title}</div>
                    <div class="item-meta">
                      Priority: ${chore.priority} ${chore.due_date ? `• Due: ${new Date(chore.due_date).toLocaleDateString()}` : ''}
                      ${chore.assigned_to ? `• Assigned to: ${chore.assigned_to}` : ''}
                    </div>
                  </div>
                `).join('')}
              ` : '<p style="color: #6c757d; font-style: italic;">No pending chores today!</p>'}
              
              ${chores.completed?.length > 0 ? `
                <h3 style="margin: 20px 0 10px 0; color: #28a745;">✅ Completed Today</h3>
                ${chores.completed.map(chore => `
                  <div class="item completed">
                    <div class="item-title">${chore.title}</div>
                    <div class="item-meta">Completed by ${chore.completed_by} at ${new Date(chore.completed_at).toLocaleTimeString()}</div>
                  </div>
                `).join('')}
              ` : ''}
            </div>
          ` : ''}

          ${events ? `
            <div class="section">
              <h2>📅 Today's Events</h2>
              ${events.today?.length > 0 ? `
                ${events.today.map(event => `
                  <div class="item">
                    <div class="item-title">${event.title}</div>
                    <div class="item-meta">
                      ${new Date(event.start_time).toLocaleTimeString()} - ${new Date(event.end_time).toLocaleTimeString()}
                      ${event.location ? `• ${event.location}` : ''}
                    </div>
                  </div>
                `).join('')}
              ` : '<p style="color: #6c757d; font-style: italic;">No events scheduled for today.</p>'}
            </div>
          ` : ''}

          ${meals ? `
            <div class="section">
              <h2>🍽️ Today's Meals</h2>
              ${meals.today?.length > 0 ? `
                ${meals.today.map(meal => `
                  <div class="item">
                    <div class="item-title">${meal.name}</div>
                    <div class="item-meta">${meal.meal_type} ${meal.time ? `• ${meal.time}` : ''}</div>
                  </div>
                `).join('')}
              ` : '<p style="color: #6c757d; font-style: italic;">No meals planned for today.</p>'}
            </div>
          ` : ''}

          ${shopping ? `
            <div class="section">
              <h2>🛒 Shopping List</h2>
              ${shopping.pending?.length > 0 ? `
                ${shopping.pending.map(item => `
                  <div class="item">
                    <div class="item-title">${item.name}</div>
                    <div class="item-meta">
                      ${item.quantity ? `${item.quantity} ${item.unit || ''}` : ''}
                      ${item.category ? `• ${item.category}` : ''}
                    </div>
                  </div>
                `).join('')}
              ` : '<p style="color: #6c757d; font-style: italic;">Shopping list is empty!</p>'}
            </div>
          ` : ''}

          <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" class="cta-button">View Full Dashboard</a>
          </div>

          <div class="footer">
            <p>This digest was generated for ${household_name} on ${date}.</p>
            <p>You can manage your digest preferences in the app settings.</p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate HTML for weekly digest
   */
  private static generateWeeklyDigestHTML(data: DigestData): string {
    const { user_name, household_name, date, chores, meals, shopping, events, achievements, insights } = data;
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Weekly Digest - ${date}</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px; text-align: center; margin-bottom: 30px; }
            .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
            .header p { margin: 10px 0 0 0; opacity: 0.9; }
            .section { background: #f8f9fa; border-radius: 8px; padding: 20px; margin-bottom: 20px; }
            .section h2 { margin: 0 0 15px 0; color: #495057; font-size: 18px; display: flex; align-items: center; }
            .section h2::before { content: ''; width: 4px; height: 20px; background: #667eea; margin-right: 10px; border-radius: 2px; }
            .item { background: white; border-radius: 6px; padding: 15px; margin-bottom: 10px; }
            .item:last-child { margin-bottom: 0; }
            .item-title { font-weight: 600; color: #212529; margin-bottom: 5px; }
            .item-meta { font-size: 14px; color: #6c757d; }
            .stats { display: flex; justify-content: space-around; text-align: center; margin: 20px 0; }
            .stat { flex: 1; }
            .stat-number { font-size: 24px; font-weight: 600; color: #667eea; }
            .stat-label { font-size: 14px; color: #6c757d; }
            .footer { text-align: center; margin-top: 30px; padding: 20px; color: #6c757d; font-size: 14px; }
            .cta-button { display: inline-block; background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
            .achievement { border-left: 4px solid #ffc107; }
            .insight { border-left: 4px solid #17a2b8; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>📊 Weekly Digest</h1>
            <p>Here's your weekly summary for ${household_name}, ${user_name}!</p>
          </div>

          <div class="stats">
            <div class="stat">
              <div class="stat-number">${chores?.completed?.length || 0}</div>
              <div class="stat-label">Chores Completed</div>
            </div>
            <div class="stat">
              <div class="stat-number">${events?.upcoming?.length || 0}</div>
              <div class="stat-label">Upcoming Events</div>
            </div>
            <div class="stat">
              <div class="stat-number">${achievements?.length || 0}</div>
              <div class="stat-label">Achievements</div>
            </div>
          </div>

          ${achievements && achievements.length > 0 ? `
            <div class="section">
              <h2>🏆 Achievements</h2>
              ${achievements.map(achievement => `
                <div class="item achievement">
                  <div class="item-title">${achievement.title}</div>
                  <div class="item-meta">${achievement.description} • +${achievement.xp} XP</div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${insights && insights.length > 0 ? `
            <div class="section">
              <h2>🤖 AI Insights</h2>
              ${insights.map(insight => `
                <div class="item insight">
                  <div class="item-title">${insight.title}</div>
                  <div class="item-meta">${insight.description} (${insight.confidence}% confidence)</div>
                </div>
              `).join('')}
            </div>
          ` : ''}

          ${chores ? `
            <div class="section">
              <h2>🧹 Chore Summary</h2>
              <p><strong>Completed this week:</strong> ${chores.completed?.length || 0} chores</p>
              <p><strong>Still pending:</strong> ${chores.pending?.length || 0} chores</p>
              ${chores.pending?.length > 0 ? `
                <h3 style="margin: 15px 0 10px 0;">Pending Chores</h3>
                ${chores.pending.map(chore => `
                  <div class="item">
                    <div class="item-title">${chore.title}</div>
                    <div class="item-meta">Priority: ${chore.priority} ${chore.due_date ? `• Due: ${new Date(chore.due_date).toLocaleDateString()}` : ''}</div>
                  </div>
                `).join('')}
              ` : ''}
            </div>
          ` : ''}

          ${events ? `
            <div class="section">
              <h2>📅 Upcoming Events</h2>
              ${events.upcoming?.length > 0 ? `
                ${events.upcoming.map(event => `
                  <div class="item">
                    <div class="item-title">${event.title}</div>
                    <div class="item-meta">
                      ${new Date(event.start_time).toLocaleDateString()} at ${new Date(event.start_time).toLocaleTimeString()}
                      ${event.location ? `• ${event.location}` : ''}
                    </div>
                  </div>
                `).join('')}
              ` : '<p style="color: #6c757d; font-style: italic;">No upcoming events this week.</p>'}
            </div>
          ` : ''}

          <div style="text-align: center;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" class="cta-button">View Full Dashboard</a>
          </div>

          <div class="footer">
            <p>This weekly digest was generated for ${household_name} on ${date}.</p>
            <p>You can manage your digest preferences in the app settings.</p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate plain text for daily digest
   */
  private static generateDailyDigestText(data: DigestData): string {
    const { user_name, household_name, date, chores, meals, shopping, events } = data;
    
    let text = `Daily Digest - ${date}\n`;
    text += `Good morning, ${user_name}! Here's what's happening in ${household_name} today.\n\n`;
    
    if (chores?.pending?.length > 0) {
      text += `CHORES (${chores.pending.length} pending):\n`;
      chores.pending.forEach(chore => {
        text += `- ${chore.title} (${chore.priority} priority)\n`;
      });
      text += '\n';
    }
    
    if (events?.today?.length > 0) {
      text += `TODAY'S EVENTS (${events.today.length}):\n`;
      events.today.forEach(event => {
        text += `- ${event.title} at ${new Date(event.start_time).toLocaleTimeString()}\n`;
      });
      text += '\n';
    }
    
    if (meals?.today?.length > 0) {
      text += `TODAY'S MEALS (${meals.today.length}):\n`;
      meals.today.forEach(meal => {
        text += `- ${meal.name} (${meal.meal_type})\n`;
      });
      text += '\n';
    }
    
    if (shopping?.pending?.length > 0) {
      text += `SHOPPING LIST (${shopping.pending.length} items):\n`;
      shopping.pending.forEach(item => {
        text += `- ${item.name}${item.quantity ? ` (${item.quantity} ${item.unit || ''})` : ''}\n`;
      });
      text += '\n';
    }
    
    text += `View your full dashboard: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard\n`;
    text += `\nThis digest was generated for ${household_name} on ${date}.`;
    
    return text;
  }

  /**
   * Generate plain text for weekly digest
   */
  private static generateWeeklyDigestText(data: DigestData): string {
    const { user_name, household_name, date, chores, meals, shopping, events, achievements, insights } = data;
    
    let text = `Weekly Digest - ${date}\n`;
    text += `Here's your weekly summary for ${household_name}, ${user_name}!\n\n`;
    
    if (achievements?.length > 0) {
      text += `ACHIEVEMENTS (${achievements.length}):\n`;
      achievements.forEach(achievement => {
        text += `- ${achievement.title}: ${achievement.description} (+${achievement.xp} XP)\n`;
      });
      text += '\n';
    }
    
    if (chores) {
      text += `CHORE SUMMARY:\n`;
      text += `- Completed this week: ${chores.completed?.length || 0} chores\n`;
      text += `- Still pending: ${chores.pending?.length || 0} chores\n\n`;
    }
    
    if (events?.upcoming?.length > 0) {
      text += `UPCOMING EVENTS (${events.upcoming.length}):\n`;
      events.upcoming.forEach(event => {
        text += `- ${event.title} on ${new Date(event.start_time).toLocaleDateString()}\n`;
      });
      text += '\n';
    }
    
    text += `View your full dashboard: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard\n`;
    text += `\nThis weekly digest was generated for ${household_name} on ${date}.`;
    
    return text;
  }
}
