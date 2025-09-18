const gitHubApiVersion = "2022-11-28"; // GitHub API version for headers
const fetchTimeout = 30000; // 30 seconds for fetch requests

function createGitHubHeaders() {

  const workflowToken = process.env.GH_WORKFLOW_TOKEN;
  if (!workflowToken) throw new Error("Missing GH_WORKFLOW_TOKEN app setting");

  return {
    "Authorization": `Bearer ${workflowToken}`,
    "Accept": 'application/vnd.github+json',
    "X-GitHub-Api-Version": gitHubApiVersion,
    "Content-Type": "application/json"
  };
}

async function getRunList(workflowOwner, workflowRepo, workflowId, context = null) {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
  const isoDate = tenMinutesAgo.toISOString();

  const workflowUrl = `https://api.github.com/repos/${encodeURIComponent(workflowOwner)}/${encodeURIComponent(workflowRepo)}/actions/workflows/${encodeURIComponent(workflowId)}/runs?event=workflow_dispatch&per_page=100&branch=main&created:>=${encodeURIComponent(isoDate)}`;

  return fetchWithGitHubAuth(workflowUrl, {}, context);
}

async function triggerAction(workflowOwner, workflowRepo, workflowId, workflowInput, context = null) {
  const workflowUrl = `https://api.github.com/repos/${workflowOwner}/${workflowRepo}/actions/workflows/${encodeURIComponent(workflowId)}/dispatches`;

  const body = {
    ref: 'main',
    inputs: workflowInput
  };

  return fetchWithGitHubAuth(workflowUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  }, context);
}
async function fetchWithGitHubAuth(url, options = {}, context = null) {
  const requestOptions = {
    ...options,
    headers: {
      ...createGitHubHeaders(),
      ...(options.headers || {})
    },
    signal: AbortSignal.timeout(options.timeout || fetchTimeout)
  };

  if (context && context.log) {
    context.log(`Making GitHub API request`, {
      operation: 'fetchWithGitHubAuth',
      url,
      method: options.method || 'GET'
    });
  }

  try {
    return await fetch(url, requestOptions);
  } catch (err) {
    if (context && context.log && context.log.error) {
      context.log.error(`Error in GitHub API request`, {
        operation: 'fetchWithGitHubAuth',
        url,
        method: options.method || 'GET',
        error: err.message,
        stack: err.stack
      });
    }
    throw err;
  }
}
async function triggerWorkflow(workflowOwner, workflowRepo, workflowId, workflowInput, runIdInputProperty, context) {
    // Generate a correlation ID for this workflow trigger
    const correlationId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (context && context.log) {
        context.log(`Triggering workflow`, {
            operation: 'triggerWorkflow',
            workflowOwner,
            workflowRepo,
            workflowId,
            correlationId
        });
    }

    // Trigger workflow
    const rawResponse = await triggerAction(workflowOwner, workflowRepo, workflowId, workflowInput, context);

    if (context && context.log) {
        context.log(`Triggered workflow ${workflowOwner}/${workflowRepo}#${workflowId}`, {
            operation: 'triggerWorkflow',
            status: rawResponse.status,
            correlationId
        });
    }

    if (!rawResponse.ok) {
      const errText = await rawResponse.text();
      if (context && context.log && context.log.error) {
          context.log.error(`Failed to trigger workflow`, {
              operation: 'triggerWorkflow',
              workflowOwner,
              workflowRepo,
              workflowId,
              status: rawResponse.status,
              error: errText,
              correlationId
          });
      }
      
      return {
        found: false,
        status: 502,
        error: `Trigger workflow failed: ${rawResponse.status} ${rawResponse.statusText} - ${errText}`,
        ownerRepo: `${workflowOwner}/${workflowRepo}/actions/workflows/${workflowId}/runs`
      };
    }

    // wait 5 seconds to give GitHub time to start the run (preserves original behaviour)
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    if (context && context.log) {
        context.log(`Fetching recent runs to locate workflow run`, {
            operation: 'triggerWorkflow',
            workflowOwner,
            workflowRepo,
            workflowId,
            correlationId
        });
    }

    // Get recent runs for the workflow
    const rawResponseFindRunId = await getRunList(workflowOwner, workflowRepo, workflowId, context);

    if (context && context.log) {
        context.log(`Fetched recent runs for workflow ${workflowOwner}/${workflowRepo}#${workflowId}`, {
            operation: 'triggerWorkflow',
            status: rawResponseFindRunId.status,
            correlationId
        });
    }

    if (!rawResponseFindRunId.ok) {
      const errText = await rawResponseFindRunId.text();
      if (context && context.log && context.log.error) {
          context.log.error(`Failed to get workflow runs`, {
              operation: 'triggerWorkflow',
              workflowOwner,
              workflowRepo,
              workflowId,
              status: rawResponseFindRunId.status,
              error: errText,
              correlationId
          });
      }
      
      return {
        found: false,
        status: 502,
        error: `Get workflow runs failed: ${rawResponseFindRunId.status} ${rawResponseFindRunId.statusText} - ${errText}`,
        ownerRepo: `${workflowOwner}/${workflowRepo}/actions/workflows/${workflowId}/runs`
      };
    }

    // Ensure the caller provided the input property to search for
    const uniqueInputId = workflowInput && Object.prototype.hasOwnProperty.call(workflowInput, runIdInputProperty)
      ? workflowInput[runIdInputProperty]
      : undefined;

    if (!uniqueInputId) {
      if (context && context.log && context.log.warn) {
          context.log.warn(`Missing input property in workflow input`, {
              operation: 'triggerWorkflow',
              runIdInputProperty,
              correlationId
          });
      }
      
      return {
        found: false,
        status: 400,
        error: `Input property ${runIdInputProperty} is missing in workflowInput`,
        uniqueInputId: null,
        ownerRepo: `${workflowOwner}/${workflowRepo}/actions/workflows/${workflowId}/runs`
      };
    }
    
    if (context && context.log) {
        context.log(`Searching for run with input property`, {
            operation: 'triggerWorkflow',
            runIdInputProperty,
            uniqueInputId,
            correlationId
        });
    }

    const rawDataFindRunId = await rawResponseFindRunId.json();

    if (!rawDataFindRunId || !Array.isArray(rawDataFindRunId.workflow_runs)) {
      if (context && context.log && context.log.error) {
          context.log.error(`Invalid response structure from GitHub`, {
              operation: 'triggerWorkflow',
              correlationId
          });
      }
      
      return {
        found: false,
        status: 502,
        error: 'trigger-action: Invalid response structure from GitHub when fetching workflow runs',
        uniqueInputId,
        ownerRepo: `${workflowOwner}/${workflowRepo}/actions/workflows/${workflowId}/runs`
      };
    }

    // be resilient: check display_title, name, and head_commit.message
    const matchingRun = rawDataFindRunId.workflow_runs.find(run => {
      const title = run.display_title || run.name || '';
      const commitMsg = (run.head_commit && run.head_commit.message) ? String(run.head_commit.message) : '';
      return (title && title.includes(String(uniqueInputId))) || (commitMsg && commitMsg.includes(String(uniqueInputId)));
    });

    if (matchingRun) {
      if (context && context.log) {
          context.log(`Matching run found`, {
              operation: 'triggerWorkflow',
              runId: matchingRun.id,
              runIdInputProperty,
              uniqueInputId,
              correlationId
          });
      }

      return {
        status: 200,
        found: true,
        runId: matchingRun.id,
        run: matchingRun,
        uniqueInputId,
        ownerRepo: `${workflowOwner}/${workflowRepo}/actions/workflows/${workflowId}/runs`,
      };
    }

    if (context && context.log && context.log.warn) {
        context.log.warn(`No matching run found`, {
            operation: 'triggerWorkflow',
            runIdInputProperty,
            uniqueInputId,
            correlationId
        });
    }
    
    // not found
    return {
      found: false,
      status: 404,
      error: 'trigger-action: Could not find the triggered workflow run',
      uniqueInputId,
      ownerRepo: `${workflowOwner}/${workflowRepo}/actions/workflows/${workflowId}/runs`
    };
};

module.exports = async function (context, req) {
  // Generate a unique request ID to correlate logs across this request
  const requestId = `action-trigger-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Add request ID to the context's binding data for tracking
  context.bindingData = context.bindingData || {};
  context.bindingData.requestId = requestId;

  if (req.method === 'OPTIONS') {
    context.log(`Handling OPTIONS request`, {
      operation: 'action-trigger',
      method: 'OPTIONS',
      requestId
    });
    
    context.res = {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    };
    return;
  }

  context.log(`Processing request`, {
    operation: 'action-trigger',
    method: req.method,
    url: req.url,
    requestId
  });

  try {
    // Extract fields
    const { workflowOrgRep, workflowId, workflowInput, runIdInputProperty } = req.body;

    context.log(`Request parameters received`, {
      operation: 'action-trigger',
      workflowOrgRep,
      workflowId,
      runIdInputProperty,
      hasWorkflowInput: !!workflowInput,
      requestId
    });

    if (!workflowOrgRep) {
      context.log.warn(`Missing required parameter: workflowOrgRep`, {
        operation: 'action-trigger',
        requestId
      });
      
      context.res = { 
        status: 400, 
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: { 
          error: 'workflowOrgRep is required',
          errorType: 'MISSING_PARAMETER'
        } 
      };
      return;
    }

    // Validate workflowId (accept number or string)
    if (workflowId === undefined || workflowId === null || workflowId === '') {
      context.log.warn(`Missing required parameter: workflowId`, {
        operation: 'action-trigger',
        requestId
      });
      
      context.res = { 
        status: 400, 
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: { 
          error: 'workflowId is required',
          errorType: 'MISSING_PARAMETER'
        }
      };
      return;
    }

    if (!runIdInputProperty) {
      context.log.warn(`Missing required parameter: runIdInputProperty`, {
        operation: 'action-trigger',
        requestId
      });
      
      context.res = { 
        status: 400, 
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: { 
          error: 'runIdInputProperty is required',
          errorType: 'MISSING_PARAMETER'
        }
      };
      return;
    }

    const [incomingWorkflowOwner, incomingWorkflowRepo] = workflowOrgRep.split('/');
    if (!incomingWorkflowOwner || !incomingWorkflowRepo) {
      context.log.warn(`Invalid format for workflowOrgRep`, {
        operation: 'action-trigger',
        workflowOrgRep,
        requestId
      });
      
      context.res = { 
        status: 400, 
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: { 
          error: 'workflowOrgRep must be in owner/repo format',
          errorType: 'INVALID_FORMAT'
        }
      };
      return;
    }

    const workflowOwner = incomingWorkflowOwner || "Template-Doctor";
    const workflowRepo = incomingWorkflowRepo || "template-doctor";

    context.log(`Triggering workflow`, {
      operation: 'action-trigger',
      workflowOwner,
      workflowRepo,
      workflowId,
      requestId
    });

    // Use the helper to trigger and discover run id
    const result = await triggerWorkflow(workflowOwner, workflowRepo, workflowId, workflowInput, runIdInputProperty, context);

    if (result.found) {
      const runId = result.runId;
      context.log(`Workflow triggered successfully`, {
        operation: 'action-trigger',
        workflowOwner,
        workflowRepo,
        workflowId,
        runId,
        requestId
      });
      
      context.res = {
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: { 
          error: null, 
          data: { runId }, 
          context: { 
            uniqueInputId: result.uniqueInputId, 
            ownerRepo: result.ownerRepo, 
            run: result.run,
            requestId
          } 
        }
      };
      return;
    } else {
      // propagate structured error responses
      const status = result.status || 500;
      const errorType = status === 404 ? 'RUN_NOT_FOUND' : 
                         status === 400 ? 'BAD_REQUEST' : 
                         status === 502 ? 'GITHUB_API_ERROR' : 'SERVER_ERROR';
      
      context.log.warn(`Workflow trigger issue`, {
        operation: 'action-trigger',
        workflowOwner,
        workflowRepo,
        workflowId,
        status,
        error: result.error,
        errorType,
        requestId
      });
      
      context.res = {
        status,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: {
          error: result.error || 'trigger-action: Could not locate run',
          errorType,
          data: null,
          context: {
            url: result.workflowUrl,
            uniqueInputId: result.uniqueInputId || null,
            ownerRepo: result.ownerRepo || `${workflowOwner}/${workflowRepo}`,
            requestId
          }
        }
      };
      return;
    }

  } catch (error) {
    context.log.error('Error in action-trigger function', {
      operation: 'action-trigger',
      error: error.message,
      stack: error.stack,
      requestId
    });
    
    context.res = {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: { 
        error: error.message || 'Internal Server Error',
        errorType: 'SERVER_ERROR',
        requestId
      }
    };
  }
};


module.exports.triggerWorkflow = triggerWorkflow;
