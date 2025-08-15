#!/usr/bin/env node

/**
 * Test script to verify all optimizations are working
 * Run with: node scripts/test-optimizations.js
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing Home Management App Optimizations...\n');

const tests = [
  {
    name: 'Custom Hook Creation',
    check: () => {
      const hookPath = path.join(__dirname, '../src/hooks/useUserData.ts');
      return fs.existsSync(hookPath);
    },
    message: '✅ useUserData hook created'
  },
  {
    name: 'UI Components',
    check: () => {
      const components = [
        'src/components/ui/FeatureCard.tsx',
        'src/components/ui/LoadingSpinner.tsx',
        'src/components/ui/ErrorDisplay.tsx'
      ];
      return components.every(comp => fs.existsSync(path.join(__dirname, '..', comp)));
    },
    message: '✅ UI components created'
  },
  {
    name: 'API Helpers',
    check: () => {
      const helperPath = path.join(__dirname, '../src/lib/api-helpers.ts');
      return fs.existsSync(helperPath);
    },
    message: '✅ API helpers created'
  },
  {
    name: 'Performance Monitoring',
    check: () => {
      const perfPath = path.join(__dirname, '../src/lib/performance.ts');
      return fs.existsSync(perfPath);
    },
    message: '✅ Performance monitoring utilities created'
  },
  {
    name: 'Error Boundary',
    check: () => {
      const errorBoundaryPath = path.join(__dirname, '../src/components/ErrorBoundary.tsx');
      return fs.existsSync(errorBoundaryPath);
    },
    message: '✅ Error boundary component created'
  },
  {
    name: 'Configuration Files',
    check: () => {
      const configs = [
        '.prettierrc',
        '.prettierignore',
        'eslint.config.mjs'
      ];
      return configs.every(config => fs.existsSync(path.join(__dirname, '..', config)));
    },
    message: '✅ Configuration files created'
  },
  {
    name: 'Package Scripts',
    check: () => {
      const packagePath = path.join(__dirname, '../package.json');
      if (!fs.existsSync(packagePath)) return false;
      
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const requiredScripts = ['lint:fix', 'type-check', 'analyze', 'format'];
      return requiredScripts.every(script => pkg.scripts && pkg.scripts[script]);
    },
    message: '✅ Package scripts added'
  },
  {
    name: 'TypeScript Config',
    check: () => {
      const tsConfigPath = path.join(__dirname, '../tsconfig.json');
      if (!fs.existsSync(tsConfigPath)) return false;
      
      const tsConfig = JSON.parse(fs.readFileSync(tsConfigPath, 'utf8'));
      return tsConfig.compilerOptions && 
             tsConfig.compilerOptions.target === 'ES2020' &&
             tsConfig.compilerOptions.noUnusedLocals === true;
    },
    message: '✅ TypeScript configuration optimized'
  },
  {
    name: 'Next.js Config',
    check: () => {
      const nextConfigPath = path.join(__dirname, '../next.config.ts');
      if (!fs.existsSync(nextConfigPath)) return false;
      
      const content = fs.readFileSync(nextConfigPath, 'utf8');
      return content.includes('BundleAnalyzerPlugin') && 
             content.includes('optimizePackageImports');
    },
    message: '✅ Next.js configuration optimized'
  }
];

let passedTests = 0;
let totalTests = tests.length;

tests.forEach(test => {
  try {
    if (test.check()) {
      console.log(test.message);
      passedTests++;
    } else {
      console.log(`❌ ${test.name} failed`);
    }
  } catch (error) {
    console.log(`❌ ${test.name} error:`, error.message);
  }
});

console.log(`\n📊 Test Results: ${passedTests}/${totalTests} tests passed`);

if (passedTests === totalTests) {
  console.log('\n🎉 All optimizations are in place! Your app is ready for testing.');
  console.log('\n🚀 Next steps:');
  console.log('1. Run: npm run lint:fix');
  console.log('2. Run: npm run type-check');
  console.log('3. Run: npm run build');
  console.log('4. Test the app locally');
} else {
  console.log('\n⚠️  Some optimizations may be missing. Check the failed tests above.');
}

console.log('\n💡 Performance Tips:');
console.log('- Use React DevTools Profiler to measure component render times');
console.log('- Check browser Network tab for API call optimization');
console.log('- Monitor console for performance metrics');
console.log('- Use Lighthouse for overall performance score');
