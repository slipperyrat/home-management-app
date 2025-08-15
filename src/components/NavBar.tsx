'use client'

import { useState } from 'react'
import NavBarHeader from './navigation/NavBarHeader'
import NavBarNavigation from './navigation/NavBarNavigation'
import NavBarUserSection from './navigation/NavBarUserSection'
import NavBarMobileMenu from './navigation/NavBarMobileMenu'

export default function NavBar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <NavBarHeader />
          <NavBarNavigation />
          <div className="flex items-center space-x-4">
            <NavBarUserSection />
            <NavBarMobileMenu 
              isMobileMenuOpen={isMobileMenuOpen}
              setIsMobileMenuOpen={setIsMobileMenuOpen}
            />
          </div>
        </div>
      </div>
    </nav>
  )
} 