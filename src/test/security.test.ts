import { describe, it, expect } from 'vitest'
import { sanitizeText, sanitizeRich, sanitizeDeep } from '@/lib/security/sanitize'

describe('Security - Input Sanitization', () => {
  describe('sanitizeText', () => {
    it('should remove script tags', () => {
      const maliciousInput = '<script>alert("xss")</script>Hello'
      const result = sanitizeText(maliciousInput)
      expect(result).toBe('Hello')
    })

    it('should remove event handlers', () => {
      const maliciousInput = '<div onclick="alert(\'xss\')">Hello</div>'
      const result = sanitizeText(maliciousInput)
      expect(result).toBe('Hello')
    })

    it('should preserve safe text', () => {
      const safeInput = 'Hello World 123!'
      const result = sanitizeText(safeInput)
      expect(result).toBe('Hello World 123!')
    })

    it('should handle empty strings', () => {
      const result = sanitizeText('')
      expect(result).toBe('')
    })

    it('should handle null and undefined', () => {
      expect(sanitizeText(null as unknown as string)).toBe('')
      expect(sanitizeText(undefined as unknown as string)).toBe('')
    })
  })

  describe('sanitizeRich', () => {
    it('should allow safe HTML tags', () => {
      const input = '<p>Hello <strong>world</strong></p>'
      const result = sanitizeRich(input)
      expect(result).toContain('<p>')
      expect(result).toContain('<strong>')
      expect(result).toContain('Hello')
      expect(result).toContain('world')
    })

    it('should remove dangerous tags', () => {
      const maliciousInput = '<p>Hello</p><script>alert("xss")</script>'
      const result = sanitizeRich(maliciousInput)
      expect(result).toContain('Hello')
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert')
    })

    it('should remove dangerous attributes', () => {
      const maliciousInput = '<p onclick="alert(\'xss\')">Hello</p>'
      const result = sanitizeRich(maliciousInput)
      expect(result).toContain('Hello')
      expect(result).not.toContain('onclick')
      expect(result).not.toContain('alert')
    })
  })

  describe('sanitizeDeep', () => {
    it('should sanitize nested object properties', () => {
      const input = {
        title: '<script>alert("xss")</script>Safe Title',
        description: '<p>Safe content</p><script>bad</script>',
        nested: {
          field: '<div onclick="bad()">Content</div>'
        }
      }

      const result = sanitizeDeep(input, {
        description: 'rich'
      })

      expect(result.title).toBe('Safe Title')
      expect(result.description).toContain('<p>')
      expect(result.description).not.toContain('<script>')
      expect(result.nested.field).toBe('Content')
    })

    it('should handle arrays', () => {
      const input = {
        items: ['<script>bad</script>Good', 'Another <b>item</b>']
      }

      const result = sanitizeDeep(input)
      expect(result.items[0]).toBe('Good')
      expect(result.items[1]).toBe('Another item')
    })

    it('should preserve non-string values', () => {
      const testDate = new Date('2023-01-01')
      const input = {
        number: 123,
        boolean: true,
        date: testDate,
        nullValue: null
      }

      const result = sanitizeDeep(input)
      expect(result.number).toBe(123)
      expect(result.boolean).toBe(true)
      expect(result.date).toEqual(testDate)
      expect(result.nullValue).toBe(null)
    })
  })
})
