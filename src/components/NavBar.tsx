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

  return (
    <nav className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-lg font-semibold hover:text-blue-600 transition">Home</Link>
        {isLoaded && isSignedIn && (
          <>
            <Link href="/dashboard" className="text-lg font-semibold hover:text-blue-600 transition">Dashboard</Link>
            <Link href="/shopping-lists" className="text-lg font-semibold hover:text-blue-600 transition">Shopping Lists</Link>
            <Link href="/chores" className="text-lg font-semibold hover:text-blue-600 transition">Chores</Link>
            <Link href="/rewards" className="text-lg font-semibold hover:text-blue-600 transition">Rewards</Link>
            <Link href="/leaderboard" className="text-lg font-semibold hover:text-blue-600 transition">Leaderboard</Link>
            <Link href="/calendar" className="text-lg font-semibold hover:text-blue-600 transition">Calendar</Link>
            <Link href="/reminders" className="text-lg font-semibold hover:text-blue-600 transition">Reminders</Link>
          </>
        )}
      </div>
      
      {isLoaded && isSignedIn && userData && (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-sm">
            <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
              XP: {userData.xp}
            </span>
            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">
              🪙 {userData.coins}
            </span>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      )}
      
      {isLoaded && !isSignedIn && (
        <div>
          <Link href="/sign-in" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition">Sign In</Link>
        </div>
      )}
    </nav>
  )
} 