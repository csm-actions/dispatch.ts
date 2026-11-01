import { assertEquals } from "@std/assert";
import { errorMessage } from "./error_message.ts";

Deno.test("errorMessage", async (t) => {
  await t.step("Error", () => {
    assertEquals(errorMessage(new Error("network error")), "network error");
  });
  await t.step("JSON", () => {
    assertEquals(errorMessage({ status: 500 }), '{"status":500}');
    assertEquals(errorMessage("network error"), '"network error"');
  });
  await t.step("values JSON can't serialize", () => {
    const circular: Record<string, unknown> = { status: 500 };
    circular.self = circular;
    assertEquals(
      errorMessage(circular),
      "<ref *1> { status: 500, self: [Circular *1] }",
    );
    assertEquals(errorMessage({ n: 1n }), "{ n: 1n }");
    assertEquals(errorMessage(undefined), "undefined");
  });
});
