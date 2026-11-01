# dispatch.ts

[![JSR](https://jsr.io/badges/@csm-actions/dispatch)](https://jsr.io/@csm-actions/dispatch)
[![License](http://img.shields.io/badge/license-mit-blue.svg?style=flat-square)](https://raw.githubusercontent.com/csm-actions/dispatch.ts/main/LICENSE)

JSR Package to run server workflows of
[the Client/Server Model](https://github.com/csm-actions/docs) by
workflow_dispatch events.

```ts
import * as dispatch from "@csm-actions/dispatch";

const workflowRef = dispatch.parseWorkflowRef(
  "my-org/server/.github/workflows/securefix.yaml@main",
);
const run = await dispatch.dispatch({
  workflowRef,
  inputs: { foo: "bar" },
  appOctokit, // An Octokit client authenticated as a GitHub App
});
if (run) {
  console.log(run.url);
}
```

- `parseWorkflowRef` parses a workflow ref in the format
  `<owner>/<repo>/.github/workflows/<workflow file>@<branch or tag>`, the same
  format as `github.workflow_ref`. The ref must be a branch or tag, not a commit
  SHA, because the workflow_dispatch API doesn't accept it
- `dispatch` runs the workflow by a workflow_dispatch event. With `appOctokit`,
  it creates an installation access token for the server repository with only
  the `actions:write` permission, and revokes it afterwards. You can pass
  `octokit` instead
- `dispatch` returns the workflow run (`id` and `url`) if GitHub returns the run
  details
- `validateRepository` checks that a workflow ref points to the given
  repository, case-insensitively
