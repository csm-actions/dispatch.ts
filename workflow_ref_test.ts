import { assertEquals, assertThrows } from "@std/assert";
import {
  parseWorkflowRef,
  parseWorkflowRun,
  validateRepository,
} from "./workflow_ref.ts";

Deno.test("parseWorkflowRef", async (t) => {
  await t.step("branch", () => {
    assertEquals(
      parseWorkflowRef("foo/server/.github/workflows/securefix.yaml@main"),
      { owner: "foo", repo: "server", workflow: "securefix.yaml", ref: "main" },
    );
  });
  await t.step("full ref", () => {
    assertEquals(
      parseWorkflowRef(
        "foo/server/.github/workflows/securefix.yaml@refs/heads/main",
      ).ref,
      "refs/heads/main",
    );
  });
  await t.step("names with dots", () => {
    assertEquals(
      parseWorkflowRef("my.org/.server/.github/workflows/securefix.yaml@main")
        .repo,
      ".server",
    );
  });
  await t.step(".yml and @ in the ref", () => {
    assertEquals(
      parseWorkflowRef("foo/server/.github/workflows/securefix.yml@feat@1"),
      {
        owner: "foo",
        repo: "server",
        workflow: "securefix.yml",
        ref: "feat@1",
      },
    );
  });
  await t.step("invalid", () => {
    for (
      const s of [
        "",
        "foo/server",
        "foo/server/.github/workflows/securefix.yaml",
        "foo/server/securefix.yaml@main",
        "foo/server/.github/workflows/@main",
        "foo/server/.github/workflows/dir/securefix.yaml@main",
        "foo/server/.github/workflows/securefix@main",
        "foo/server/.github/workflows/securefix.json@main",
        "foo/server/.github/workflows/securefix.yaml@main branch",
        "foo/server/.github/workflows/securefix.yaml@0123456789abcdef0123456789abcdef01234567",
        "../../.github/workflows/securefix.yaml@main",
        "./server/.github/workflows/securefix.yaml@main",
        "foo/.../.github/workflows/securefix.yaml@main",
        "fo o/server/.github/workflows/securefix.yaml@main",
        "foo/ser%2Fver/.github/workflows/securefix.yaml@main",
      ]
    ) {
      assertThrows(() => parseWorkflowRef(s), Error, undefined, s);
    }
  });
});

Deno.test("validateRepository", async (t) => {
  const ref = parseWorkflowRef(
    "my-org/server/.github/workflows/securefix.yaml@main",
  );
  await t.step("match", () => {
    validateRepository(ref, "my-org", "server");
  });
  await t.step("match case-insensitively", () => {
    validateRepository(ref, "My-Org", "Server");
  });
  await t.step("repository mismatch", () => {
    assertThrows(() => validateRepository(ref, "my-org", "other"));
  });
  await t.step("owner mismatch", () => {
    assertThrows(() => validateRepository(ref, "other", "server"));
  });
});

Deno.test("parseWorkflowRun", async (t) => {
  await t.step("run details", () => {
    assertEquals(
      parseWorkflowRun({
        workflow_run_id: 123,
        run_url: "https://api.github.com/repos/foo/bar/actions/runs/123",
        html_url: "https://github.com/foo/bar/actions/runs/123",
      }),
      { id: 123, url: "https://github.com/foo/bar/actions/runs/123" },
    );
  });
  await t.step("no content", () => {
    assertEquals(parseWorkflowRun(undefined), undefined);
    assertEquals(parseWorkflowRun(""), undefined);
    assertEquals(parseWorkflowRun(null), undefined);
  });
  await t.step("unexpected body", () => {
    assertEquals(parseWorkflowRun({ html_url: "x" }), undefined);
    assertEquals(
      parseWorkflowRun({ workflow_run_id: "1", html_url: "x" }),
      undefined,
    );
  });
});
