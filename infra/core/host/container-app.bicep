// Container App with Docker image deployment

param name string
param location string = resourceGroup().location
param tags object = {}

@description('Name of the Container Apps Environment')
param containerAppsEnvironmentName string

@description('Name of the Container Registry')
param containerRegistryName string

@description('Environment variables for the container')
param env array = []

@description('Secrets for the container (will be merged with registry password)')
param secrets array = []

@description('GitHub Client ID for OAuth')
@secure()
param githubClientId string = ''

@description('GitHub Client Secret for OAuth')
@secure()
param githubClientSecret string = ''

@description('GitHub Personal Access Token')
@secure()
param githubToken string = ''

@description('GitHub Workflow Token for workflow dispatch')
@secure()
param ghWorkflowToken string = ''

@description('Target port for the container')
param targetPort int = 3000

@description('Enable ingress')
param enableIngress bool = true

@description('External ingress')
param external bool = true

@description('CPU cores - Bicep requires string for decimal values (0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0)')
@allowed(['0.25', '0.5', '0.75', '1.0', '1.25', '1.5', '1.75', '2.0'])
param containerCpuCoreCount string = '0.5'

@description('Memory in Gi (0.5, 1.0, 1.5, 2.0, 3.0, 3.5, 4.0)')
param containerMemory string = '1.0Gi'

@description('Minimum number of replicas')
param minReplicas int = 1

@description('Maximum number of replicas')
param maxReplicas int = 3

// Reference existing resources
resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2023-05-01' existing = {
  name: containerAppsEnvironmentName
}

resource containerRegistry 'Microsoft.ContainerRegistry/registries@2023-01-01-preview' existing = {
  name: containerRegistryName
}

// Container App with Managed Identity
resource containerApp 'Microsoft.App/containerApps@2023-05-01' = {
  name: name
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: enableIngress ? {
        external: external
        targetPort: targetPort
        transport: 'auto'
        allowInsecure: false
      } : null
      registries: [
        {
          server: containerRegistry.properties.loginServer
          identity: 'system'
        }
      ]
      secrets: concat(githubClientId != '' ? [{
        name: 'github-client-id'
        value: githubClientId
      }] : [], githubClientSecret != '' ? [{
        name: 'github-client-secret'
        value: githubClientSecret
      }] : [], githubToken != '' ? [{
        name: 'github-token'
        value: githubToken
      }] : [], ghWorkflowToken != '' ? [{
        name: 'gh-workflow-token'
        value: ghWorkflowToken
      }] : [], secrets)
    }
    template: {
      containers: [
        {
          name: 'main'
          image: 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest' // Placeholder, will be updated by azd deploy
          resources: {
            // Note: Bicep does not support 'number' or 'numeric' types (only int, string, bool, object, array)
            // json() is the correct way to convert string decimal values to numbers for Azure resources
            cpu: json(containerCpuCoreCount)
            memory: containerMemory
          }
          env: env
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '100'
              }
            }
          }
        ]
      }
    }
  }
}

// Role assignment for Container App to access Container Registry
resource acrPullRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(containerApp.id, containerRegistry.id, 'acrpull')
  scope: containerRegistry
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', '7f951dda-4ed3-4680-a7ca-43fe172d538d') // AcrPull role
    principalId: containerApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output id string = containerApp.id
output name string = containerApp.name
output uri string = enableIngress ? 'https://${containerApp.properties.configuration.ingress.fqdn}' : ''
output fqdn string = enableIngress ? containerApp.properties.configuration.ingress.fqdn : ''
output principalId string = containerApp.identity.principalId
