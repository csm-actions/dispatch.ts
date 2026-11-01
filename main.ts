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
  try {
    return await createWorkflowDispatch(
      github.getOctokit(token.token),
      ref,
      inputs.inputs,
    );
  } finally {
    // The request is sent, so the token has done its job either way.
    if (githubAppToken.hasExpired(token.expiresAt)) {
      core.info("skip revoking GitHub App token as it has already expired");
    } else {
      core.info("revoking GitHub App token");
      await githubAppToken.revoke(token.token, {
        baseUrl: github.context.apiUrl,
      });
    }
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
