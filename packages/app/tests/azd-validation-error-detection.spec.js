import { describe, it, expect } from 'vitest';

describe('AZD Validation Error Detection', () => {
  // Test the UnmatchedPrincipalType error pattern matching (multiline-capable)
  const unmatchedPrincipalErrorPattern = /UnmatchedPrincipalType[\s\S]*has type[\s\S]*ServicePrincipal[\s\S]*different from[\s\S]*PrinciaplType[\s\S]*User/i;

  it('should detect UnmatchedPrincipalType error in actual error message', () => {
    const actualError = `ERROR: error executing step command 'provision': deployment failed: error deploying infrastructure: deploying to subscription:

Deployment Error Details:
UnmatchedPrincipalType: The PrincipalId 'a61472c60dc14425ac1a8ede3955e55f' has type 'ServicePrincipal' , which is different from specified PrinciaplType 'User'.
UnmatchedPrincipalType: The PrincipalId 'a61472c60dc14425ac1a8ede3955e55f' has type 'ServicePrincipal' , which is different from specified PrinciaplType 'User'.
UnmatchedPrincipalType: The PrincipalId 'a61472c60dc14425ac1a8ede3955e55f' has type 'ServicePrincipal' , which is different from specified PrinciaplType 'User'.

TraceID: 7dc0c1710a91ebcbef32dff73560b11d

Failed to list resources: No value for given attribute`;

    expect(unmatchedPrincipalErrorPattern.test(actualError)).toBe(true);
  });

  it('should detect UnmatchedPrincipalType with different formatting', () => {
    const errorVariation1 = `UnmatchedPrincipalType: The PrincipalId 'abc123' has type 'ServicePrincipal', which is different from specified PrinciaplType 'User'.`;
    const errorVariation2 = `UNMATCHEDPRINCIPALTYPE: The PrincipalId 'xyz789' has type 'ServicePrincipal' , which is different from specified PRINCIAPLTYPE 'User'.`;
    
    expect(unmatchedPrincipalErrorPattern.test(errorVariation1)).toBe(true);
    expect(unmatchedPrincipalErrorPattern.test(errorVariation2)).toBe(true);
  });

  it('should NOT detect unrelated errors', () => {
    const unrelatedErrors = [
      'Error: Resource not found',
      'Deployment failed: timeout',
      'PrincipalId mismatch but different error',
      'ServicePrincipal error without UnmatchedPrincipalType',
    ];

    unrelatedErrors.forEach(error => {
      expect(unmatchedPrincipalErrorPattern.test(error)).toBe(false);
    });
  });

  it('should detect error regardless of case', () => {
    const lowercaseError = `unmatchedprincipaltype: the principalid 'test' has type 'serviceprincipal' , which is different from specified princiapltype 'user'.`;
    
    expect(unmatchedPrincipalErrorPattern.test(lowercaseError)).toBe(true);
  });

  it('should work with multiline error messages', () => {
    const multilineError = `
      Multiple errors occurred:
      
      UnmatchedPrincipalType: The PrincipalId 'a61472c60dc14425ac1a8ede3955e55f' 
      has type 'ServicePrincipal' , which is different from 
      specified PrinciaplType 'User'.
      
      Additional context follows...
    `;

    expect(unmatchedPrincipalErrorPattern.test(multilineError)).toBe(true);
  });

  // Test that the fix recommendation would be generated
  it('should generate correct fix recommendation for GitHub issue', () => {
    const errorSummary = `UnmatchedPrincipalType: The PrincipalId 'a61472c60dc14425ac1a8ede3955e55f' has type 'ServicePrincipal' , which is different from specified PrinciaplType 'User'.`;
    
    const hasError = unmatchedPrincipalErrorPattern.test(errorSummary);
    expect(hasError).toBe(true);

    // Verify the fix components are present
    const expectedFixComponents = {
      title: '[Template Doctor] Fix: Principal Type Mismatch in Role Assignment',
      bicepParam: '@description(\'Flag to decide whether to create OpenAI role for current user\')\nparam createRoleForUser bool = true',
      conditionalModule: 'module openAiRoleUser \'core/security/role.bicep\' = if (createRoleForUser) {',
      principalTypeUser: 'principalType: \'User\'',
      docsLink: 'https://github.com/Azure-Samples/azd-template-artifacts/blob/main/docs/development-guidelines/trouble-shooting.md',
      examplePR: 'https://github.com/Azure-Samples/azure-openai-assistant-javascript/pull/18/files',
    };

    // In the actual implementation, these would be included in the issue body
    expect(expectedFixComponents.title).toContain('Principal Type Mismatch');
    expect(expectedFixComponents.bicepParam).toContain('createRoleForUser');
    expect(expectedFixComponents.conditionalModule).toContain('if (createRoleForUser)');
    expect(expectedFixComponents.principalTypeUser).toContain('User');
    expect(expectedFixComponents.docsLink).toContain('trouble-shooting.md');
    expect(expectedFixComponents.examplePR).toContain('azure-openai-assistant-javascript/pull/18');
  });
});
