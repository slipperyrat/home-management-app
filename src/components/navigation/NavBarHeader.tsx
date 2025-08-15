'use client'

import Link from 'next/link'

export default function NavBarHeader() {
  return (
    <div className="flex items-center">
      <Link 
        href="/" 
        className="text-xl font-bold text-gray-900 hover:text-blue-600 transition-colors"
      >
        Home Manager
      </Link>
    </div>
  )
}
