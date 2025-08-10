'use client'

import Link from 'next/link'
import { useAuth, useUser } from '@clerk/nextjs'
import { UserButton } from '@clerk/nextjs'
import { useEffect, useState } from 'react'

interface UserData {
  xp: number;
  coins: number;
}

export default function NavBar() {
  const { isLoaded, isSignedIn } = useAuth()
  const { user } = useUser()
  const [userData, setUserData] = useState<UserData | null>(null)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !user?.id) return;

    async function fetchUserData() {
      try {
        const response = await fetch('/api/user-data');
        const result = await response.json();

        if (response.ok && result.success && result.user) {
          setUserData({
            xp: result.user.xp || 0,
            coins: result.user.coins || 0
          });
        }
      } catch (err) {
        console.error('Error fetching user data in NavBar:', err);
      }
    }

    fetchUserData();
  }, [isLoaded, isSignedIn, user?.id]);

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

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Home Link */}
          <div className="flex items-center">
            <Link 
              href="/" 
              className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
            >
              Home Manager
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:block">
            <div className="ml-10 flex items-baseline space-x-4">
              {isLoaded && isSignedIn && navLinks.map((link) => (
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

          {/* Right side - User info and auth */}
          <div className="flex items-center space-x-4">
            {/* XP/Coins - Hidden on small screens */}
            {isLoaded && isSignedIn && userData && (
              <div className="hidden sm:flex items-center gap-2 text-xs">
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                  XP: {userData.xp}
                </span>
                <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">
                  🪙 {userData.coins}
                </span>
              </div>
            )}

            {/* User Button */}
            {isLoaded && isSignedIn && (
              <UserButton afterSignOutUrl="/" />
            )}

            {/* Sign In Button */}
            {isLoaded && !isSignedIn && (
              <Link 
                href="/sign-in" 
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
              >
                Sign In
              </Link>
            )}

            {/* Mobile menu button */}
            {isLoaded && isSignedIn && (
              <div className="lg:hidden">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-blue-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
                  aria-expanded="false"
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
            )}
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {isLoaded && isSignedIn && isMobileMenuOpen && (
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
    </nav>
  )
} 