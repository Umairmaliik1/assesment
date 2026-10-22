// Two-user browser walkthrough against a running app. Usage: BASE_URL=http://localhost:3000 pnpm e2e
import { chromium } from "playwright-core";

const B = process.env.BASE_URL ?? "http://localhost:3000";
const notesMd = { name: "notes.md", mimeType: "text/markdown", buffer: Buffer.from("# Launch notes\n\n- Ship **beta**\n- Collect feedback\n") };
const png = { name: "photo.png", mimeType: "image/png", buffer: Buffer.from("binary") };
const results = [];
const check = (name, ok, detail = "") => { results.push(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`); };
const browser = await chromium.launch({ channel: "chrome" });
const errors = [];
async function session(userName) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${userName}: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`${userName} console: ${m.text()}`));
  await page.goto(B + "/");
  check(`${userName} anon redirected to login`, page.url().endsWith("/login"));
  await page.getByRole("button", { name: new RegExp(userName) }).click();
  await page.waitForURL(B + "/");
  return page;
}
async function exportAs(page, label) {
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export" }).click();
  await page.getByRole("menuitem", { name: label }).click();
  const file = await download;
  const chunks = [];
  for await (const chunk of await file.createReadStream()) chunks.push(chunk);
  return { name: file.suggestedFilename(), body: Buffer.concat(chunks) };
}
const saved = (page) => page.getByRole("status").filter({ hasText: "All changes saved" }).waitFor({ timeout: 8000 });

const alice = await session("Alice");
await alice.getByRole("button", { name: "New document" }).click();
await alice.waitForURL(/\/documents\//);
const docUrl = alice.url();
const title = alice.getByLabel("Document title");
await title.fill("Q4 Launch Plan");
await title.press("Enter");
await alice.locator(".doc-content").click();
await alice.getByLabel("Text style").selectOption("1");
await alice.keyboard.type("Launch plan");
await alice.keyboard.press("Enter");
await alice.keyboard.type("This is ");
await alice.keyboard.press("Meta+b"); await alice.keyboard.type("bold"); await alice.keyboard.press("Meta+b");
await alice.keyboard.type(" and ");
await alice.getByRole("button", { name: /Italic/ }).click(); await alice.keyboard.type("italic"); await alice.getByRole("button", { name: /Italic/ }).click();
await alice.keyboard.type(" and ");
await alice.getByRole("button", { name: /Underline/ }).click(); await alice.keyboard.type("underlined"); await alice.getByRole("button", { name: /Underline/ }).click();
await alice.keyboard.press("Enter");
await alice.getByRole("button", { name: "Bulleted list" }).click();
await alice.keyboard.type("First"); await alice.keyboard.press("Enter"); await alice.keyboard.type("Second");
await alice.keyboard.press("Enter"); await alice.keyboard.press("Enter");
await alice.getByRole("button", { name: "Numbered list" }).click();
await alice.keyboard.type("Step one");
await saved(alice);
await alice.reload();
const html = await alice.locator(".doc-content").innerHTML();
check("formatting persists after reload", ["<h1>Launch plan</h1>", "<strong>bold</strong>", "<em>italic</em>", "<u>underlined</u>", "<ul>", "<ol>"].every((s) => html.includes(s)), html.slice(0, 300));
await alice.locator(".doc-content").click();
await alice.keyboard.press("Meta+End");
await alice.keyboard.type(" Typed right before export.");
const md = await exportAs(alice, "Markdown (.md)");
const mdText = md.body.toString();
check("markdown export downloads with the title as file name", md.name === "Q4 Launch Plan.md", md.name);
check("markdown export keeps formatting and unsaved edits", ["# Launch plan", "**bold**", "*italic*", "<u>underlined</u>", "- First", "1. Step one", "Typed right before export."].every((s) => mdText.includes(s)), mdText.slice(0, 200));
const pdf = await exportAs(alice, "PDF document (.pdf)");
check("pdf export downloads a real PDF", pdf.name === "Q4 Launch Plan.pdf" && pdf.body.subarray(0, 5).toString() === "%PDF-", `${pdf.name} ${pdf.body.length} bytes`);
check("title persists after reload", (await alice.getByLabel("Document title").inputValue()) === "Q4 Launch Plan");

// Share with Bob as viewer.
await alice.getByRole("button", { name: "Share", exact: true }).click();
const dialog = alice.getByRole("dialog");
await dialog.getByLabel("Person").selectOption("bob");
await dialog.getByLabel("Access level").first().selectOption("viewer");
await dialog.getByRole("button", { name: "Share" }).click();
await dialog.getByText("Bob Smith").waitFor();
check("share list shows Bob", true);
await dialog.getByRole("button", { name: "Close" }).click();

const bob = await session("Bob");
const sharedSection = bob.locator("section", { hasText: "Shared with me" });
check("Bob sees doc in Shared with me", await sharedSection.getByText("Q4 Launch Plan").isVisible());
check("Bob shared row shows Viewer badge and owner", /viewer/i.test(await sharedSection.locator("li").first().innerText()) && (await sharedSection.innerText()).includes("Alice Johnson"));
check("Bob owns nothing", (await bob.locator("section", { hasText: "My documents" }).innerText()).includes("No documents yet"));
await bob.goto(docUrl);
check("viewer sees View only", (await bob.getByRole("status").innerText()) === "View only");
check("viewer has no toolbar", (await bob.getByRole("toolbar").count()) === 0);
check("viewer editor not editable", (await bob.locator(".doc-content").getAttribute("contenteditable")) === "false");
check("viewer has no share button", (await bob.getByRole("button", { name: "Share" }).count()) === 0);
check("viewer can export", (await exportAs(bob, "Markdown (.md)")).body.toString().includes("# Launch plan"));

// Upgrade Bob to editor, then make Alice's open tab stale.
await alice.getByRole("button", { name: "Share", exact: true }).click();
await dialog.locator("li", { hasText: "Bob Smith" }).getByLabel("Access level").selectOption("editor");
await alice.waitForTimeout(500);
await dialog.getByRole("button", { name: "Close" }).click();
await bob.reload();
check("editor gets toolbar", (await bob.getByRole("toolbar").count()) === 1);
await bob.locator(".doc-content").click();
await bob.keyboard.press("Meta+End");
await bob.keyboard.type(" (Bob edit)");
await saved(bob);
await alice.locator(".doc-content h1").click();
await alice.keyboard.type(" stale");
await alice.getByRole("alert").filter({ hasText: "Someone else saved" }).waitFor({ timeout: 8000 });
check("stale editor sees conflict banner", true);
await alice.getByRole("button", { name: "Load their version" }).click();
await saved(alice);
const aliceText = await alice.locator(".doc-content").innerText();
check("load their version shows Bob's edit, drops stale", aliceText.includes("(Bob edit)") && !aliceText.includes("stale"));
await alice.locator(".doc-content").click();
await alice.keyboard.press("Meta+z");
await alice.waitForTimeout(2000);
check("undo after loading their version cannot overwrite it", (await alice.locator(".doc-content").innerText()).includes("(Bob edit)"));

// Unsaved edits are flushed before in-app navigation.
await alice.locator(".doc-content h1").click();
await alice.keyboard.press("End");
await alice.keyboard.type(" final");
await alice.getByRole("link", { name: "Ajaia Docs" }).click();
await alice.waitForURL(B + "/");
await alice.goto(docUrl);
check("edits typed right before navigation are saved", (await alice.locator(".doc-content h1").innerText()) === "Launch plan final");
await alice.locator(".doc-content h1").click();
await alice.keyboard.press("End");
await alice.keyboard.type("!");
await alice.goBack();
await alice.waitForURL(B + "/");
await alice.goForward();
await alice.locator(".doc-content h1", { hasText: "Launch plan final!" }).waitFor({ timeout: 5000 }).catch(() => {});
check("edits typed right before browser Back are saved and shown after Forward", (await alice.locator(".doc-content h1").innerText()) === "Launch plan final!");
const titleInput = alice.getByLabel("Document title");
await titleInput.fill("Quick rename 1");
await titleInput.press("Enter");
await titleInput.fill("Q4 Launch Plan");
await titleInput.press("Enter");
await alice.waitForTimeout(1000);
await alice.reload();
check("quick successive renames keep the latest title", (await alice.getByLabel("Document title").inputValue()) === "Q4 Launch Plan");

// Import.
await alice.goto(B + "/");
await alice.getByLabel("Import file").setInputFiles(notesMd);
await alice.waitForURL(/\/documents\//);
check("import creates titled doc", (await alice.getByLabel("Document title").inputValue()) === "notes");
check("import keeps structure", (await alice.locator(".doc-content").innerHTML()).includes("<h1>Launch notes</h1>"));
const importedUrl = alice.url();
await alice.goto(B + "/");
await alice.getByLabel("Import file").setInputFiles(png);
await alice.waitForTimeout(1000);
check("unsupported file shows error", await alice.getByRole("alert").filter({ hasText: "Only .txt, .md and .docx" }).isVisible());

// Revoke and delete.
await alice.goto(docUrl);
await alice.getByRole("button", { name: "Share", exact: true }).click();
await dialog.locator("li", { hasText: "Bob Smith" }).getByRole("button", { name: "Remove" }).click();
await dialog.locator("li", { hasText: "Bob Smith" }).waitFor({ state: "detached" });
await bob.goto(docUrl);
check("revoked user gets not found", await bob.getByText("Document not found").isVisible());
for (const url of [docUrl, importedUrl]) {
  await alice.goto(url);
  await alice.getByRole("button", { name: "Delete" }).click();
  await alice.getByRole("button", { name: "Delete" }).click();
  await alice.waitForURL(B + "/");
}
check("deleted docs gone from dashboard", !(await alice.getByText("Q4 Launch Plan").count()));
const signOutDoc = await (async () => {
  await alice.getByRole("button", { name: "New document" }).click();
  await alice.waitForURL(/\/documents\//);
  await alice.locator(".doc-content").click();
  await alice.keyboard.type("typed just before sign out");
  return alice.url().split("/").pop();
})();
await alice.getByRole("button", { name: "Sign out" }).click();
await alice.waitForURL(/\/login/);
check("sign out returns to login", true);
await alice.getByRole("button", { name: /Alice/ }).click();
await alice.waitForURL(B + "/");
const signedOutDoc = await alice.evaluate(async (id) => (await fetch(`/api/documents/${id}`)).json(), signOutDoc);
check("edits typed right before sign out are saved", JSON.stringify(signedOutDoc.content).includes("typed just before sign out"));
await alice.evaluate((id) => fetch(`/api/documents/${id}`, { method: "DELETE" }), signOutDoc);

console.log(results.join("\n"));
// Failed requests for the intentional 409, 415 and 404 cases are logged by the browser and expected.
console.log("browser errors:", errors.length ? errors : "none");
await browser.close();
process.exitCode = results.some((line) => line.startsWith("FAIL")) ? 1 : 0;
