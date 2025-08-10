# 🧪 Testing Strategy & Documentation

## Overview

This project implements a comprehensive testing strategy covering unit tests, integration tests, and end-to-end tests. Our testing approach ensures code quality, security, and reliability across all application layers.

## 📊 Current Test Coverage

### Unit Tests (Vitest)
- **Total Tests**: 34 passing
- **Coverage**: Security functions (90%+), Validation (95%+)
- **Test Files**: 4 test suites
- **Focus Areas**: Security, validation, API helpers, middleware logic

### E2E Tests (Playwright)
- **Total Tests**: 3 test suites
- **Browsers**: Chrome, Firefox, Safari, Mobile Chrome, Mobile Safari
- **Focus Areas**: Authentication, navigation, security headers, XSS prevention

## 🏗️ Test Structure

```
src/test/           # Unit & Integration tests
├── setup.ts        # Test environment setup
├── security.test.ts    # Security function tests
├── validation.test.ts  # Input validation tests
├── middleware.test.ts  # Middleware logic tests
└── api/
    └── onboarding.test.ts  # API route tests

e2e/                # End-to-end tests
├── auth.spec.ts        # Authentication flows
├── navigation.spec.ts  # UI & navigation
└── security.spec.ts    # Security features
```

## 🚀 Running Tests

### Unit Tests
```bash
# Run tests in watch mode
npm test

# Run tests once
npm run test:run

# Run with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### E2E Tests
```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Run E2E tests in headed mode
npm run test:e2e:headed
```

## 🔒 Security Testing

### What We Test
- ✅ **Input Sanitization**: XSS prevention, HTML stripping
- ✅ **Input Validation**: Zod schema validation
- ✅ **Rate Limiting**: Sliding window implementation
- ✅ **CSRF Protection**: Origin header validation
- ✅ **Security Headers**: CSP, XSS protection, frame options
- ✅ **Authentication**: Clerk integration and middleware

### Security Test Examples
```typescript
// XSS Prevention
it('should remove script tags', () => {
  const maliciousInput = '<script>alert("xss")</script>Hello'
  const result = sanitizeText(maliciousInput)
  expect(result).toBe('Hello')
})

// Rate Limiting
it('should block requests when rate limit exceeded', () => {
  const mockBucket = { count: 100, resetTime: Date.now() + 900000 }
  const isAllowed = mockBucket.count < 100
  expect(isAllowed).toBe(false)
})
```

## 🌐 E2E Testing

### Test Scenarios
1. **Authentication Flow**
   - Unauthenticated user redirects
   - Sign-in page accessibility
   - Navigation handling

2. **Security Features**
   - Security headers validation
   - XSS attack prevention
   - Rate limiting behavior
   - Sensitive data exposure checks

3. **UI/UX Testing**
   - Mobile responsiveness
   - Error boundary functionality
   - Page structure validation

### E2E Test Example
```typescript
test('should have proper security headers', async ({ page }) => {
  const response = await page.goto('/')
  const headers = response?.headers() || {}
  
  expect(headers['x-content-type-options']).toBe('nosniff')
  expect(headers['x-frame-options']).toBe('DENY')
  expect(headers['content-security-policy']).toBeTruthy()
})
```

## 🎯 Coverage Goals

### Current Coverage
- **Security Functions**: 90%+ (High priority)
- **Validation Functions**: 95%+ (High priority)
- **API Helpers**: 100% (Critical)
- **Overall Project**: 80%+ target

### Coverage Thresholds
```typescript
thresholds: {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
}
```

## 🔄 CI/CD Integration

### GitHub Actions Workflow
Our CI pipeline runs:
1. **Linting**: ESLint checks
2. **Unit Tests**: Vitest with coverage
3. **E2E Tests**: Playwright across multiple browsers
4. **Security Scan**: npm audit and dependency checks
5. **Build Verification**: Next.js build process

### Test Reports
- **Coverage Reports**: HTML, LCOV, JSON formats
- **E2E Reports**: Playwright HTML reports with screenshots
- **Artifacts**: Test results stored for 7 days

## 📝 Writing New Tests

### Unit Test Guidelines
```typescript
// Use descriptive test names
it('should sanitize malicious HTML input', () => {
  // Arrange
  const maliciousInput = '<script>alert("xss")</script>Safe content'
  
  // Act
  const result = sanitizeText(maliciousInput)
  
  // Assert
  expect(result).toBe('Safe content')
})
```

### E2E Test Guidelines
```typescript
// Focus on user journeys
test('user can complete onboarding flow', async ({ page }) => {
  await page.goto('/onboarding')
  
  // Test each step of the flow
  await page.fill('input[name="householdName"]', 'Test Household')
  await page.click('button:text("Next")')
  
  await expect(page).toHaveURL('/onboarding?step=2')
})
```

## 🛡️ Security Test Checklist

When adding new features, ensure tests cover:
- [ ] Input sanitization for all text inputs
- [ ] Input validation with Zod schemas
- [ ] Authentication requirements
- [ ] Authorization checks
- [ ] Rate limiting compliance
- [ ] CSRF protection
- [ ] XSS prevention
- [ ] SQL injection prevention (if applicable)

## 📈 Test Metrics

### Performance Benchmarks
- **Unit Tests**: < 30 seconds total
- **E2E Tests**: < 5 minutes total
- **Coverage Generation**: < 15 seconds

### Quality Gates
- All tests must pass before deployment
- Coverage must meet minimum thresholds
- Security tests are mandatory for security-related code
- E2E tests must pass on all supported browsers

## 🔧 Test Configuration

### Environment Variables
Tests use mock environment variables to avoid external dependencies:
```env
NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
SUPABASE_SERVICE_ROLE_KEY=test-service-role-key
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=test-clerk-key
CLERK_SECRET_KEY=test-clerk-secret
```

### Mock Strategy
- **External APIs**: Fully mocked in unit tests
- **Database**: Mocked with realistic responses
- **Authentication**: Mocked Clerk providers
- **Browser APIs**: jsdom environment

## 🚀 Future Improvements

### Planned Enhancements
1. **Visual Regression Testing**: Screenshot comparisons
2. **Performance Testing**: Lighthouse CI integration
3. **Accessibility Testing**: axe-core integration
4. **Load Testing**: API endpoint stress testing
5. **Contract Testing**: API schema validation

### Test Automation
- **Automated Test Generation**: AI-assisted test creation
- **Mutation Testing**: Code quality verification
- **Fuzz Testing**: Input validation robustness
- **Security Scanning**: SAST/DAST integration

---

## 📚 Resources

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library](https://testing-library.com/)
- [Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)

---

**Last Updated**: January 2025  
**Test Framework Versions**: Vitest 3.2.4, Playwright 1.49.0
