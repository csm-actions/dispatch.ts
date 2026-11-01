import * as github from "@actions/github";
import * as core from "@actions/core";
import * as githubAppToken from "@suzuki-shunsuke/github-app-token";
import {
  parseWorkflowRun,
  type WorkflowRef,
  type WorkflowRun,
} from "./workflow_ref.ts";

export {
  parseWorkflowRef,
  validateRepository,
  type WorkflowRef,
  type WorkflowRun,
} from "./workflow_ref.ts";

export type Inputs = {
  /** The server workflow to run */
  workflowRef: WorkflowRef;
  /** The inputs of the workflow_dispatch event */
  inputs: Record<string, string>;
  /**
   * An Octokit client authenticated with an installation access token, which
   * has the `actions:write` permission of the server repository.
   */
  octokit?: ReturnType<typeof github.getOctokit>;
  /**
   * An Octokit client authenticated as a GitHub App.
   *
   * It's used to create an installation access token for the server
   * repository with only the `actions:write` permission, which is revoked once
   * the workflow is dispatched.
   * Build it with @octokit/auth-app, passing either a private key or a
   * createJwt callback when the key is stored in a KMS or a HSM.
   */
  appOctokit?: githubAppToken.Client;
};

/**
 * Runs the server workflow by a workflow_dispatch event.
 *
 * It returns the workflow run if GitHub returns the run details,
 * otherwise undefined.
 */
export const dispatch = async (
  inputs: Inputs,
): Promise<WorkflowRun | undefined> => {
  const ref = inputs.workflowRef;
  core.info(
    `running the server workflow: ${
      JSON.stringify({ ...ref, inputs: inputs.inputs })
    }`,
  );
  if (inputs.octokit) {
    return await createWorkflowDispatch(inputs.octokit, ref, inputs.inputs);
  }
  if (!inputs.appOctokit) {
    throw new Error("Either octokit or appOctokit must be provided");
  }
  const token = await githubAppToken.create({
    octokit: inputs.appOctokit,
    owner: ref.owner,
    repositories: [ref.repo],
    permissions: {
      actions: "write",
    },
  });
  // Without this the token would appear in the workflow log.
  core.setSecret(token.token);
  // The client inherits the proxy setting and the base URL on GitHub
  // Enterprise Server, so the token is revoked through it as well.
  const octokit = github.getOctokit(token.token);
  try {
    return await createWorkflowDispatch(octokit, ref, inputs.inputs);
  } finally {
    // The request is sent, so the token has done its job either way.
    await revoke(octokit, token);
  }
};

/**
 * Revokes the token without throwing.
 *
 * A failure to revoke mustn't hide the result of the dispatch: the server
 * workflow may already be running, and a caller that retries would run it
 * again. The token expires in an hour anyway.
 */
const revoke = async (
  octokit: ReturnType<typeof github.getOctokit>,
  token: githubAppToken.Token,
): Promise<void> => {
  if (githubAppToken.hasExpired(token.expiresAt)) {
    core.info("skip revoking GitHub App token as it has already expired");
    return;
  }
  core.info("revoking GitHub App token");
  try {
    await octokit.rest.apps.revokeInstallationAccessToken();
  } catch (error) {
    core.warning(
      `failed to revoke GitHub App token: ${
        error instanceof Error ? error.message : JSON.stringify(error)
      }`,
    );
  }
};

const createWorkflowDispatch = async (
  octokit: ReturnType<typeof github.getOctokit>,
  ref: WorkflowRef,
  workflowInputs: Record<string, string>,
): Promise<WorkflowRun | undefined> => {
  const res = await octokit.rest.actions.createWorkflowDispatch({
    owner: ref.owner,
    repo: ref.repo,
    workflow_id: ref.workflow,
    ref: ref.ref,
    inputs: workflowInputs,
    return_run_details: true,
  });
  // The endpoint types of @actions/github don't know the response with the
  // run details, so the body is read defensively.
  const run = parseWorkflowRun(res.data);
  if (run) {
    core.notice(`The server workflow run: ${run.url}`);
  }
  return run;
};
