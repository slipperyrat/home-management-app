import { NextRequest, NextResponse } from 'next/server'
import { withAPISecurity } from '@/lib/security/apiProtection'
import { getPendingConfirmations } from '@/lib/server/getPendingConfirmations'
import { getUserAndHouseholdData } from '@/lib/api/database'

export async function GET(req: NextRequest) {
  return withAPISecurity(req, async (request, user) => {
    try {
      console.log('User accessing pending-confirmations:', user?.id);
      const { household, error: userError } = await getUserAndHouseholdData(user.id)
      
      if (userError || !household) {
        return NextResponse.json({ error: 'User not found or no household' }, { status: 404 })
      }
      
      const result = await getPendingConfirmations(household.id)
      
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 500 })
      }

      return NextResponse.json({ 
        ok: true, 
        pendingItems: result.pendingItems,
        count: result.count
      })
    } catch (e: any) {
      console.error('❌ Error in pending-confirmations API:', e)
      return NextResponse.json({ error: e.message }, { status: e.status || 500 })
    }
  }, {
    requireAuth: true,
    requireCSRF: false,
    rateLimitConfig: 'api'
  })
}
