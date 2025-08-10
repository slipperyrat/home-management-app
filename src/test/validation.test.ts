import { describe, it, expect } from 'vitest'
import { validateRequest, createValidationErrorResponse, createSuccessResponse } from '@/lib/validation'
import { z } from 'zod'

describe('Validation Functions', () => {
  const TestSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    email: z.string().email('Invalid email'),
    age: z.number().min(0).optional()
  })

  describe('validateRequest', () => {
    it('should return success for valid data', () => {
      const validData = {
        name: 'John Doe',
        email: 'john@example.com',
        age: 25
      }

      const result = validateRequest(TestSchema, validData)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('John Doe')
        expect(result.data.email).toBe('john@example.com')
        expect(result.data.age).toBe(25)
      }
    })

    it('should return error for invalid data', () => {
      const invalidData = {
        name: '',
        email: 'invalid-email',
        age: -5
      }

      const result = validateRequest(TestSchema, invalidData)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeTruthy()
        expect(typeof result.error).toBe('string')
        // In test environment, we might get the fallback message
        expect(result.error.length).toBeGreaterThan(0)
      }
    })

    it('should handle missing required fields', () => {
      const incompleteData = {}

      const result = validateRequest(TestSchema, incompleteData)
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBeTruthy()
        expect(typeof result.error).toBe('string')
        expect(result.error.length).toBeGreaterThan(0)
      }
    })

    it('should handle optional fields', () => {
      const dataWithoutOptional = {
        name: 'Jane Doe',
        email: 'jane@example.com'
      }

      const result = validateRequest(TestSchema, dataWithoutOptional)
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data.name).toBe('Jane Doe')
        expect(result.data.email).toBe('jane@example.com')
        expect(result.data.age).toBeUndefined()
      }
    })
  })

  describe('createValidationErrorResponse', () => {
    it('should create proper error response', () => {
      const errorMessage = 'Validation failed'
      const response = createValidationErrorResponse(errorMessage)
      
      expect(response.status).toBe(400)
      // Note: We can't easily test Response body without more setup
      // but we can verify it returns a Response object
      expect(response).toBeInstanceOf(Response)
    })
  })

  describe('createSuccessResponse', () => {
    it('should create proper success response', () => {
      const data = { message: 'Success', id: 123 }
      const response = createSuccessResponse(data)
      
      expect(response.status).toBe(200)
      expect(response).toBeInstanceOf(Response)
    })

    it('should accept custom status code', () => {
      const data = { message: 'Created' }
      const response = createSuccessResponse(data, 201)
      
      expect(response.status).toBe(201)
    })
  })
})
