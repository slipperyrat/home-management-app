# Responsive UI Rollout

- Introduced `ResponsiveNav` shell with desktop sidebar and mobile tab bar.
- Primary modules: Dashboard, Calendar, Meal Planner, Shopping Lists, Planner, Quiet Hours.
- More menu includes secondary modules (Events, Templates, Goals, Automations, Reports, Rewards, Settings, Notifications, Reminders, Attachments, Bills, Security, Monitoring, Leaderboard, Inbox).
- Placeholder pages created for modules awaiting redesign, each noting legacy access paths.
- Dark-first theme uses Tailwind tokens `--background` and `--foreground` with shadcn primitives.
- Layout uses server `RootLayout` with client `Shell` to keep navigation responsive and lint-clean.
- Next steps: replace placeholders with live data widgets, re-enable module-specific lint rules post-redesign.
