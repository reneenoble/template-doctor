#!/usr/bin/env node
/**
 * Standalone test for AZD validation error detection
 * Run with: node test-azd-error-detection.js
 */

// The actual error pattern from azd-validation.ts
const unmatchedPrincipalErrorPattern =
  /UnmatchedPrincipalType[\s\S]*has type[\s\S]*ServicePrincipal[\s\S]*different from[\s\S]*PrinciaplType[\s\S]*User/i;

// Test cases
const tests = [
  {
    name: 'Real error from user report',
    input: `ERROR: error executing step command 'provision': deployment failed: error deploying infrastructure: deploying to subscription:

Deployment Error Details:
UnmatchedPrincipalType: The PrincipalId 'a61472c60dc14425ac1a8ede3955e55f' has type 'ServicePrincipal' , which is different from specified PrinciaplType 'User'.
UnmatchedPrincipalType: The PrincipalId 'a61472c60dc14425ac1a8ede3955e55f' has type 'ServicePrincipal' , which is different from specified PrinciaplType 'User'.
UnmatchedPrincipalType: The PrincipalId 'a61472c60dc14425ac1a8ede3955e55f' has type 'ServicePrincipal' , which is different from specified PrinciaplType 'User'.

TraceID: 7dc0c1710a91ebcbef32dff73560b11d

Failed to list resources: No value for given attribute`,
    expected: true,
  },
  {
    name: 'Variation with different ID',
    input: `UnmatchedPrincipalType: The PrincipalId 'abc123' has type 'ServicePrincipal', which is different from specified PrinciaplType 'User'.`,
    expected: true,
  },
  {
    name: 'Case insensitive match',
    input: `unmatchedprincipaltype: the principalid 'test' has type 'serviceprincipal' , which is different from specified princiapltype 'user'.`,
    expected: true,
  },
  {
    name: 'Multiline with extra spacing',
    input: `
      Multiple errors occurred:
      
      UnmatchedPrincipalType: The PrincipalId 'a61472c60dc14425ac1a8ede3955e55f' 
      has type 'ServicePrincipal' , which is different from 
      specified PrinciaplType 'User'.
      
      Additional context follows...
    `,
    expected: true,
  },
  {
    name: 'Unrelated error - should NOT match',
    input: 'Error: Resource not found',
    expected: false,
  },
  {
    name: 'Similar but different error - should NOT match',
    input: 'PrincipalId mismatch but different error',
    expected: false,
  },
  {
    name: 'ServicePrincipal mentioned but not the right error - should NOT match',
    input: 'ServicePrincipal error without UnmatchedPrincipalType',
    expected: false,
  },
  {
    name: 'Deployment timeout - should NOT match',
    input: 'Deployment failed: timeout exceeded',
    expected: false,
  },
];

// Run tests
console.log('🧪 Testing AZD Validation Error Detection\n');
console.log('Pattern:', unmatchedPrincipalErrorPattern.toString());
console.log('='.repeat(80));

let passed = 0;
let failed = 0;

tests.forEach((test, index) => {
  const result = unmatchedPrincipalErrorPattern.test(test.input);
  const success = result === test.expected;

  if (success) {
    console.log(`✅ Test ${index + 1}: ${test.name}`);
    passed++;
  } else {
    console.log(`❌ Test ${index + 1}: ${test.name}`);
    console.log(`   Expected: ${test.expected}, Got: ${result}`);
    console.log(`   Input: ${test.input.substring(0, 100)}...`);
    failed++;
  }
});

console.log('='.repeat(80));
console.log(`\n📊 Results: ${passed} passed, ${failed} failed out of ${tests.length} tests`);

// Test the fix recommendation logic
console.log('\n🔧 Testing Fix Recommendation Logic');
console.log('='.repeat(80));

const errorSummary = `UnmatchedPrincipalType: The PrincipalId 'a61472c60dc14425ac1a8ede3955e55f' has type 'ServicePrincipal' , which is different from specified PrinciaplType 'User'.`;
const hasError = unmatchedPrincipalErrorPattern.test(errorSummary);

if (hasError) {
  console.log('✅ Error detected correctly');
  console.log('\nExpected fix components:');
  console.log('  - Issue title: [Template Doctor] Fix: Principal Type Mismatch in Role Assignment');
  console.log(
    "  - Bicep param: @description('Flag to decide whether to create OpenAI role for current user')",
  );
  console.log(
    "  - Conditional: module openAiRoleUser 'core/security/role.bicep' = if (createRoleForUser) {",
  );
  console.log("  - Principal type: principalType: 'User'");
  console.log(
    '  - Docs link: https://github.com/Azure-Samples/azd-template-artifacts/.../trouble-shooting.md',
  );
  console.log(
    '  - Example PR: https://github.com/Azure-Samples/azure-openai-assistant-javascript/pull/18/files',
  );
} else {
  console.log('❌ Error NOT detected - FIX REQUIRED');
  failed++;
}

console.log('='.repeat(80));

// Exit with appropriate code
process.exit(failed > 0 ? 1 : 0);
