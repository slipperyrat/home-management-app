'use client'

import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import { useUserData } from '@/hooks/useUserData'

interface NavBarMobileMenuProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (open: boolean) => void;
}

export default function NavBarMobileMenu({ isMobileMenuOpen, setIsMobileMenuOpen }: NavBarMobileMenuProps) {
  const { isLoaded, isSignedIn } = useAuth()
  const { userData } = useUserData()

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/meal-planner", label: "Meal Planner" },
    { href: "/planner", label: "Planner" },
    { href: "/shopping-lists", label: "Shopping Lists" },
    { href: "/chores", label: "Chores" },
    { href: "/rewards", label: "Rewards" },
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/calendar", label: "Calendar" },
    { href: "/notifications", label: "Notifications" },
    { href: "/reminders", label: "Reminders" },
  ];

  if (!isLoaded || !isSignedIn) {
    return null;
  }

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden">
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-blue-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
          aria-expanded={isMobileMenuOpen}
          aria-label="Toggle mobile menu"
        >
          <span className="sr-only">Open main menu</span>
          {!isMobileMenuOpen ? (
            <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          ) : (
            <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-white border-t border-gray-200">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-600 hover:text-blue-600 block px-3 py-2 rounded-md text-base font-medium transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            
            {/* Mobile XP/Coins */}
            {userData && (
              <div className="px-3 py-2 border-t border-gray-200 mt-2 pt-4">
                <div className="flex items-center gap-2 text-sm">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                    XP: {userData.xp}
                  </span>
                  <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">
                    🪙 {userData.coins}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
