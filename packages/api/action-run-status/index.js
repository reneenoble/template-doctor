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

async function getWorkflowRun(workflowOwner, workflowRepo, workflowRunId, context = null) {
  const workflowUrl = `https://api.github.com/repos/${encodeURIComponent(workflowOwner)}/${encodeURIComponent(workflowRepo)}/actions/runs/${workflowRunId}`;

  if (context && context.log) {
    context.log(`Fetching workflow run data`, {
      operation: 'getWorkflowRun',
      workflowOwner,
      workflowRepo,
      workflowRunId
    });
  }

  return fetchWithGitHubAuth(workflowUrl, {}, context);
}

async function getWorkflowRunData(workflowOwner, workflowRepo, workflowRunId, context = null) {
  if (context && context.log) {
    context.log(`Getting workflow run data`, {
      operation: 'getWorkflowRunData',
      workflowOwner,
      workflowRepo,
      workflowRunId
    });
  }

  const rawResponse = await getWorkflowRun(workflowOwner, workflowRepo, workflowRunId, context);

  if (!rawResponse.ok) {
    const errText = await rawResponse.text();
    if (context && context.log && context.log.error) {
      context.log.error(`Failed to get workflow run data`, {
        operation: 'getWorkflowRunData',
        workflowOwner,
        workflowRepo,
        workflowRunId,
        status: rawResponse.status,
        error: errText
      });
    }
    throw new Error(`Trigger workflow failed: ${rawResponse.status} ${rawResponse.statusText} - ${errText}`);
  }

  const data = await rawResponse.json();

  if (!data) {
    if (context && context.log && context.log.error) {
      context.log.error(`Invalid response from GitHub`, {
        operation: 'getWorkflowRunData',
        workflowOwner,
        workflowRepo,
        workflowRunId
      });
    }
    throw new Error("Invalid response from GitHub when fetching workflow run data");
  }
  
  if (context && context.log) {
    context.log(`Successfully retrieved workflow run data`, {
      operation: 'getWorkflowRunData',
      workflowOwner,
      workflowRepo,
      workflowRunId,
      runStatus: data.status || 'unknown'
    });
  }
  
  return data;
}

module.exports = async function (context, req) {

  if (req.method === 'OPTIONS') {
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

  try {

    // Extract incoming fields
    const { workflowOrgRep, workflowRunId } = req.body;

    if (!workflowOrgRep) {
      context.res = { status: 400, body: { error: 'workflowOrgRep is required' } };
      return;
    }

    const [incomingWorkflowOwner, incomingWorkflowRepo] = workflowOrgRep.split('/');
    if (!incomingWorkflowOwner || !incomingWorkflowRepo) {
      context.res = { status: 400, body: { error: 'workflowOrgRep must be in owner/repo format' } };
      return;
    }

    if (!workflowRunId) {
      context.res = { status: 400, body: { error: 'workflowRunId is required' } };
      return;
    }

    const workflowOwner = incomingWorkflowOwner || "Template-Doctor";
    const workflowRepo = incomingWorkflowRepo || "template-doctor";

    const workflowRunData = await getWorkflowRunData(workflowOwner, workflowRepo, workflowRunId);

    context.res = {
      status: 200,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: { error: null, data: workflowRunData, context: { workflowOrgRep, workflowRunId } }
    };
  } catch (error) {
    context.log.error('trigger-action: Error in trigger-action:', error);
    context.res = {
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: { error: error.message || 'Internal Server Error' }
    };
  }
};

module.exports.getWorkflowRunData = getWorkflowRunData;