import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import * as apiProtection from '@/lib/security/apiProtection'
import { POST } from '@/app/api/analytics/track/route'
import { getDatabaseClient } from '@/lib/api/database'

vi.mock('@/lib/api/database', () => ({
  getDatabaseClient: vi.fn()
}))

vi.mock('@/lib/security/apiProtection', () => ({
  withAPISecurity: vi.fn()
}))

vi.mock('@/lib/logging/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}))

const mockClient = {
  from: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
}

describe('POST /api/analytics/track', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    ;(getDatabaseClient as unknown as vi.Mock).mockReturnValue(mockClient)
    mockClient.from.mockReturnThis()
    mockClient.insert.mockReturnThis()
  })

  it('stores analytics event with valid payload', async () => {
    const user = { id: 'user-123' }
    const payload = {
      event: 'test.event',
      timestamp: new Date().toISOString(),
      properties: { foo: 'bar' }
    }

    ;(apiProtection.withAPISecurity as unknown as vi.Mock).mockImplementation(async (_req, handler) => handler(new NextRequest('https://example.com'), user))
    mockClient.insert.mockResolvedValue({ error: null })

    const request = new Request('https://example.com/api/analytics/track', {
      method: 'POST',
      body: JSON.stringify(payload)
    }) as unknown as NextRequest

    ;(request as any).json = async () => payload

    const response = await POST(request)
    expect(response.status).toBe(200)
    const json = await response.json()
    expect(json.success).toBe(true)
    expect(mockClient.from).toHaveBeenCalledWith('analytics_events')
    expect(mockClient.insert).toHaveBeenCalled()
  })

  it('rejects invalid payload', async () => {
    const user = { id: 'user-123' }
    const payload = { event: '' }

    ;(apiProtection.withAPISecurity as unknown as vi.Mock).mockImplementation(async (_req, handler) => handler(new NextRequest('https://example.com'), user))

    const request = new Request('https://example.com/api/analytics/track', {
      method: 'POST',
      body: JSON.stringify(payload)
    }) as unknown as NextRequest

    ;(request as any).json = async () => payload

    const response = await POST(request)
    expect(response.status).toBe(400)
    const json = await response.json()
    expect(json.error).toBe('Invalid analytics payload')
  })
})
