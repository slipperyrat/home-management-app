'use client'

import Link from 'next/link'
import { useAuth, UserButton } from '@clerk/nextjs'
import { useUserData } from '@/hooks/useUserData'

export default function NavBarUserSection() {
  const { isLoaded, isSignedIn } = useAuth()
  const { userData } = useUserData()

  if (!isLoaded) {
    return null;
  }

  return (
    <div className="flex items-center space-x-4">
      {/* XP/Coins - Hidden on small screens */}
      {isSignedIn && userData ? (
        <div className="hidden sm:flex items-center gap-2 text-xs">
          <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
            XP: {userData.xp}
          </span>
          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">
            Coins: {userData.coins}
          </span>
        </div>
      ) : null}

      {/* User Button */}
      {isSignedIn ? (
        <UserButton />
      ) : (
        <Link 
          href="/sign-in" 
          className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          Sign In
        </Link>
      )}
    </div>
  )
}
