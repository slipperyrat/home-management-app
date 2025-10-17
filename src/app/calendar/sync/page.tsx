'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useUserData } from '@/hooks/useUserData'
import { canAccessFeature, type Entitlements } from '@/lib/entitlements'
import GoogleCalendarImport from '@/components/GoogleCalendarImport'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Info } from 'lucide-react'
import { toast } from 'sonner'

function LoadingFallback() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
              <span className="ml-2 text-gray-600">Loading...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function CalendarSyncPageContent() {
  const { userData, isLoading } = useUserData()
  const searchParams = useSearchParams()
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  const [entitlementsLoading, setEntitlementsLoading] = useState(true)

  useEffect(() => {
    const params = searchParams
    const success = params?.get('success')
    const error = params?.get('error')
    const calendars = params?.get('calendars')

    if (success === 'true') {
      toast.success(`Successfully connected to Google Calendar! Found ${calendars ?? '0'} calendars.`)
    } else if (error === 'authentication_failed') {
      toast.error('Failed to connect to Google Calendar. Please try again.')
    }
  }, [searchParams])

  const loadEntitlements = useCallback(async () => {
    if (!userData?.household_id) {
      setEntitlements(null)
      setEntitlementsLoading(false)
      return
    }

    try {
      setEntitlementsLoading(true)
      const response = await fetch(`/api/entitlements/${userData.household_id}`)
      const data = await response.json()
      if (response.ok) {
        setEntitlements(data as Entitlements)
      } else {
        console.error('Failed to load entitlements:', data.error)
        setEntitlements(null)
      }
    } catch (error) {
      console.error('Error loading entitlements:', error)
      setEntitlements(null)
    } finally {
      setEntitlementsLoading(false)
    }
  }, [userData?.household_id])

  useEffect(() => {
    if (userData?.household_id) {
      void loadEntitlements()
    }
  }, [userData?.household_id, loadEntitlements])

  const canUseSync = useMemo(() => {
    if (!entitlements) return false
    return canAccessFeature(entitlements, 'calendar_templates') || canAccessFeature(entitlements, 'google_import')
  }, [entitlements])

  if (isLoading || entitlementsLoading) {
    return <LoadingFallback />
  }

  if (!userData?.household_id) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                <h2 className="text-xl font-semibold text-gray-900 mb-2">Household Required</h2>
                <p className="text-gray-600">
                  You need to be part of a household to access calendar sync features.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Calendar Sync</h1>
          <p className="text-gray-600">Connect and sync your external calendars with your household calendar.</p>
        </div>

        {canUseSync && entitlements ? (
          <GoogleCalendarImport householdId={userData.household_id} entitlements={entitlements} />
        ) : (
          <Card>
            <CardContent className="p-6">
              <div className="text-center">
                <AlertCircle className="mx-auto mb-4 h-12 w-12 text-yellow-500" />
                <h2 className="mb-2 text-xl font-semibold text-gray-900">Upgrade Required</h2>
                <p className="text-gray-600">
                  Calendar sync is available on the Pro plan. Visit the plan page to upgrade and unlock Google Calendar
                  integrations.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              More Sync Options
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Export Your Calendar</h4>
                <p className="text-sm text-gray-600 mb-3">
                  Share your household calendar with external applications using our public ICS feed.
                </p>
                <Link href="/calendar/sync/export" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                  View Export Options →
                </Link>
              </div>

              <div className="p-4 border rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2">Coming Soon</h4>
                <p className="text-sm text-gray-600">
                  We&apos;re working on additional calendar sync options including Apple Calendar, Outlook, and other popular
                  calendar applications.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function CalendarSyncPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <CalendarSyncPageContent />
    </Suspense>
  )
}