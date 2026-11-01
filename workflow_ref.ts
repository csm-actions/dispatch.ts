/**
 * A server workflow to run by a workflow_dispatch event.
 */
export type WorkflowRef = {
  owner: string;
  repo: string;
  /** The workflow file name, e.g. `securefix.yaml` */
  workflow: string;
  /**
   * A branch or tag name, or a full ref such as `refs/heads/main`.
   * A commit SHA isn't allowed because the workflow_dispatch API doesn't
   * accept it.
   */
  ref: string;
};

/**
 * A workflow run created by a workflow_dispatch event.
 */
export type WorkflowRun = {
  id: number;
  url: string;
};

// The ref can contain "@" because git allows it in branch names,
// but it can't contain whitespace.
const workflowRefPattern =
  /^([^/@\s]+)\/([^/@\s]+)\/\.github\/workflows\/([^/@\s]+\.ya?ml)@(\S+)$/;

const commitSHAPattern = /^[0-9a-f]{40}$/i;

/**
 * Parses a workflow ref in the format
 * `<owner>/<repo>/.github/workflows/<workflow file>@<ref>`,
 * the same format as `github.workflow_ref`.
 * Unlike `uses` of reusable workflows, the ref must be a branch or tag,
 * not a commit SHA, because the workflow_dispatch API accepts only them.
 */
export const parseWorkflowRef = (s: string): WorkflowRef => {
  const m = workflowRefPattern.exec(s);
  if (!m) {
    throw new Error(
      `a workflow ref must be in the format <owner>/<repo>/.github/workflows/<workflow file>@<branch or tag>, got ${s}`,
    );
  }
  if (commitSHAPattern.test(m[4])) {
    throw new Error(
      `the ref of a workflow ref must be a branch or tag, not a commit SHA, because the workflow_dispatch API doesn't accept it: ${s}`,
    );
  }
  return { owner: m[1], repo: m[2], workflow: m[3], ref: m[4] };
};

/**
 * Fails unless the workflow ref points to the given repository.
 *
 * Callers which also take a server repository, e.g. for the label-based flow,
 * use this to make sure both point to the same repository.
 * GitHub owner and repository names are case-insensitive.
 */
export const validateRepository = (
  workflowRef: WorkflowRef,
  owner: string,
  repo: string,
): void => {
  if (
    workflowRef.owner.toLowerCase() !== owner.toLowerCase() ||
    workflowRef.repo.toLowerCase() !== repo.toLowerCase()
  ) {
    throw new Error(
      `the server repository ${owner}/${repo} doesn't match the repository of the workflow ref ${workflowRef.owner}/${workflowRef.repo}`,
    );
  }
};

/**
 * Reads the workflow run from the response body of the workflow_dispatch API
 * with return_run_details.
 *
 * It returns undefined when the body doesn't have the run details.
 */
export const parseWorkflowRun = (data: unknown): WorkflowRun | undefined => {
  if (typeof data !== "object" || data === null) {
    return undefined;
  }
  const d = data as Record<string, unknown>;
  if (typeof d.workflow_run_id !== "number" || typeof d.html_url !== "string") {
    return undefined;
  }
  return { id: d.workflow_run_id, url: d.html_url };
};
