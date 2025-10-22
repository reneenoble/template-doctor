// Grant Managed Identity access to Cosmos DB
// Separated from main.bicep to avoid circular dependency

param cosmosAccountName string
param principalId string

// Reference existing Cosmos DB account
resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-05-15' existing = {
  name: cosmosAccountName
}

// Built-in Cosmos DB MongoDB Data Contributor Role
var cosmosDataContributorRoleId = '00000000-0000-0000-0000-000000000002'

// Role Assignment for Container App Managed Identity
resource roleAssignment 'Microsoft.DocumentDB/databaseAccounts/mongodbRoleAssignments@2024-05-15' = {
  parent: cosmosAccount
  name: guid(cosmosAccount.id, principalId, 'mongo-contributor')
  properties: {
    roleDefinitionId: '${cosmosAccount.id}/mongodbRoleDefinitions/${cosmosDataContributorRoleId}'
    principalId: principalId
    scope: cosmosAccount.id
  }
}

output roleAssignmentId string = roleAssignment.id
