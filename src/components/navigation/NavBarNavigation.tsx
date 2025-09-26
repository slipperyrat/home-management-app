'use client'

import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'

export default function NavBarNavigation() {
  const { isLoaded, isSignedIn } = useAuth()

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/meal-planner", label: "Meal Planner" },
    { href: "/planner", label: "Planner" },
    { href: "/shopping-lists", label: "Shopping Lists" },
    { href: "/attachments", label: "📄 Receipts" },
    { href: "/bills", label: "Bills" },
    { href: "/chores", label: "Chores" },
    { href: "/rewards", label: "Rewards" },
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/calendar", label: "Calendar" },
    { href: "/calendar/sync", label: "Calendar Sync" },
    { href: "/digest", label: "Daily Digest" },
    { href: "/quiet-hours", label: "Quiet Hours" },
    { href: "/conflicts", label: "Conflicts" },
    { href: "/inbox", label: "Inbox" },
    { href: "/ai-email-dashboard", label: "🤖 AI Email" },
    { href: "/ai-learning-dashboard", label: "🧠 AI Learning" },
    { href: "/test-automation", label: "Test Automation" },
    { href: "/notifications", label: "Notifications" },
    { href: "/reminders", label: "Reminders" },
    { href: "/digest-preferences", label: "Digest Settings" },
  ];

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  return (
    <div className="hidden lg:block">
      <div className="ml-10 flex items-baseline space-x-4">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="text-gray-600 hover:text-blue-600 px-3 py-2 rounded-md text-sm font-medium transition-colors"
          >
            {link.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
