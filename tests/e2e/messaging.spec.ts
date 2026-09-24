/**
 * End-to-end: two real browser sessions against a real Supabase.
 * Requires the app running (npm run build && npm start) and the two
 * accounts from `npm run setup:users` (SETUP_USER_1/2_* in .env.local).
 *
 *   npm run test:e2e
 */
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import sharp from "sharp";

const A = {
  email: process.env.SETUP_USER_1_EMAIL!,
  password: process.env.SETUP_USER_1_PASSWORD!,
  name: process.env.SETUP_USER_1_DISPLAY_NAME!,
};
const B = {
  email: process.env.SETUP_USER_2_EMAIL!,
  password: process.env.SETUP_USER_2_PASSWORD!,
  name: process.env.SETUP_USER_2_DISPLAY_NAME!,
};

test.skip(!A.email || !B.email, "SETUP_USER_* env vars are required");
test.describe.configure({ mode: "serial" });

const run = Date.now().toString(36);
const shotDir = process.env.E2E_SCREENSHOT_DIR ?? "test-results/screens";

async function login(page: Page, who: typeof A) {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(who.email);
  await page.getByLabel("Password").fill(who.password);
  await page.getByRole("button", { name: "Enter" }).click();
  await page.waitForURL("**/chat");
  await expect(page.getByRole("log")).toBeVisible();
}

async function phone(browser: Browser) {
  return browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
}

async function desktop(browser: Browser) {
  return browser.newContext({ viewport: { width: 1280, height: 820 } });
}

test("signed-out visitors are sent to the login page", async ({ page }) => {
  for (const path of ["/chat", "/bond", "/memories", "/settings", "/"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login$/);
  }
});

test("wrong password shows a friendly error", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(A.email);
  await page.getByLabel("Password").fill("definitely-not-it");
  await page.getByRole("button", { name: "Enter" }).click();
  await expect(page.getByText("Wrong e-mail or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test.describe("two people, one line", () => {
  let ctxA: BrowserContext;
  let ctxB: BrowserContext;
  let a: Page;
  let b: Page;
  const cspViolations: string[] = [];

  test.beforeAll(async ({ browser }) => {
    ctxA = await phone(browser);
    ctxB = await desktop(browser);
    a = await ctxA.newPage();
    b = await ctxB.newPage();
    for (const page of [a, b]) {
      page.on("console", (msg) => {
        if (/Content Security Policy/i.test(msg.text())) cspViolations.push(msg.text());
      });
    }
    await login(a, A);
    await login(b, B);
  });

  test.afterAll(async () => {
    await ctxA?.close();
    await ctxB?.close();
  });

  test("presence shows the other person online", async () => {
    await expect(b.getByRole("region", { name: "Chat" }).locator("header").getByText("Online", { exact: true })).toBeVisible();
    await expect(a.getByRole("region", { name: "Chat" }).locator("header").getByText("Online", { exact: true })).toBeVisible();
  });

  test("typing indicator travels over realtime", async () => {
    const composer = a.getByLabel(`Message ${B.name}`);
    await composer.fill("almost home");
    await composer.press("a");
    await expect(b.getByText(`${A.name} is typing…`)).toBeVisible();
  });

  test("send button disabled when empty; messages arrive in realtime; receipts turn to read", async () => {
    const composer = a.getByLabel(`Message ${B.name}`);
    const send = a.getByRole("button", { name: "Send message" });
    await composer.fill("   ");
    await expect(send).toBeDisabled();

    const text = `I'm almost home ${run}`;
    await composer.fill(text);
    await send.click();
    await expect(composer).toHaveValue("");

    await expect(b.getByRole("log").getByText(text)).toBeVisible();
    // B has the chat open, so A should see "Read".
    const bubble = a.locator('[id^="msg-"]', { hasText: text });
    await expect(bubble.getByText("Read", { exact: true })).toBeAttached({ timeout: 15_000 });
    // Typing indicator clears once the message lands.
    await expect(b.getByText(`${A.name} is typing…`)).toBeHidden();
  });

  test("Enter sends and Shift+Enter makes a new line on desktop", async () => {
    const composer = b.getByLabel(`Message ${A.name}`);
    await composer.click();
    await composer.pressSequentially(`line one ${run}`);
    await composer.press("Shift+Enter");
    await composer.pressSequentially("line two");
    await expect(composer).toHaveValue(`line one ${run}\nline two`);
    await composer.press("Enter");
    await expect(composer).toHaveValue("");
    await expect(a.getByRole("log").getByText(new RegExp(`line one ${run}\\s+line two`))).toBeVisible();
  });

  test("replies quote the original and jump back to it", async () => {
    const original = b.locator('[id^="msg-"]', { hasText: `I'm almost home ${run}` });
    await original.hover();
    await original.getByRole("button", { name: /^Reply to/ }).click();
    await expect(b.getByText(`Replying to ${A.name}`)).toBeVisible();

    const composer = b.getByLabel(`Message ${A.name}`);
    await composer.fill(`okay, I'll wait ❤️ ${run}`);
    await composer.press("Enter");

    const reply = a.locator('[id^="msg-"]', { hasText: `okay, I'll wait ❤️ ${run}` });
    await expect(reply).toBeVisible();
    const quote = reply.getByRole("button", { name: /Replying to/ });
    await expect(quote).toContainText(`I'm almost home ${run}`);
    await quote.click();
    await expect(a.locator('[id^="msg-"]', { hasText: `I'm almost home ${run}` }).first()).toBeInViewport();
  });

  test("messages are plain text (no HTML injection)", async () => {
    const payload = `<img src=x onerror="window.__pwned=1"> ${run}`;
    const composer = b.getByLabel(`Message ${A.name}`);
    await composer.fill(payload);
    await composer.press("Enter");
    await expect(a.getByRole("log").getByText(payload)).toBeVisible();
    expect(await a.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined();
  });

  test("image messages upload with preview and open larger", async () => {
    const png = await sharp({
      create: { width: 640, height: 480, channels: 3, background: { r: 227, g: 22, b: 47 } },
    })
      .png()
      .toBuffer();

    await a.locator('input[type="file"]').setInputFiles({ name: "test.png", mimeType: "image/png", buffer: png });
    await expect(a.getByAltText("Selected photo preview")).toBeVisible();
    await a.getByLabel(`Message ${B.name}`).fill(`photo ${run}`);
    await a.getByRole("button", { name: "Send message" }).click();

    const onB = b.locator('[id^="msg-"]', { hasText: `photo ${run}` });
    const img = onB.getByRole("img", { name: `Photo: photo ${run}` });
    await expect(img).toBeVisible({ timeout: 20_000 });
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    await onB.getByRole("button", { name: /Open photo/ }).click();
    await expect(b.getByRole("dialog")).toBeVisible();
    await b.keyboard.press("Escape");
    await expect(b.getByRole("dialog")).toBeHidden();
  });

  test("messages persist across a refresh", async () => {
    await b.reload();
    await expect(b.getByRole("log").getByText(`I'm almost home ${run}`).first()).toBeVisible();
    await expect(b.getByRole("log").getByText(`okay, I'll wait ❤️ ${run}`)).toBeVisible();
  });

  test("reconnecting after a network drop fills the gap", async () => {
    await ctxA.setOffline(true);
    await expect(a.getByRole("status").filter({ hasText: /offline/i })).toBeVisible();

    const text = `while you were away ${run}`;
    const composer = b.getByLabel(`Message ${A.name}`);
    await composer.fill(text);
    await composer.press("Enter");
    await expect(b.locator('[id^="msg-"]', { hasText: text }).getByText("Sent", { exact: true })).toBeAttached();

    await ctxA.setOffline(false);
    await expect(a.getByRole("log").getByText(text)).toBeVisible({ timeout: 30_000 });
    await expect(a.getByText(/Reconnecting|You're offline/)).toBeHidden({ timeout: 15_000 });
  });

  test("a failed send can be retried", async () => {
    await ctxA.setOffline(true);
    const text = `retry me ${run}`;
    await a.getByLabel(`Message ${B.name}`).fill(text);
    await a.getByRole("button", { name: "Send message" }).click();
    const bubble = a.locator('[id^="msg-"]', { hasText: text });
    await expect(bubble.getByRole("alert")).toBeVisible();
    await ctxA.setOffline(false);
    await bubble.getByRole("button", { name: "Retry" }).click();
    await expect(b.getByRole("log").getByText(text)).toBeVisible({ timeout: 20_000 });
  });

  test("bond, memories and settings screens render", async () => {
    await b.getByRole("link", { name: "Bond" }).first().click();
    await expect(b.getByRole("heading", { name: "Bond" })).toBeVisible();
    await expect(b.getByText("Messages exchanged")).toBeVisible();
    await b.screenshot({ path: `${shotDir}/desktop-bond.png` });

    await b.getByRole("link", { name: "Memories" }).first().click();
    await expect(b.getByRole("heading", { name: "Memories" })).toBeVisible();

    await a.getByRole("link", { name: "Settings" }).last().click();
    await expect(a.getByRole("heading", { name: "Settings" })).toBeVisible();
    await a.screenshot({ path: `${shotDir}/mobile-settings.png` });
  });

  test("screenshots of chat", async () => {
    await a.getByRole("link", { name: "Chat" }).click();
    await b.getByRole("link", { name: "Chat" }).first().click();
    await expect(a.getByRole("log")).toBeVisible();
    await a.waitForTimeout(600);
    await a.screenshot({ path: `${shotDir}/mobile-chat.png` });
    await b.screenshot({ path: `${shotDir}/desktop-chat.png` });
  });

  test("no Content-Security-Policy violations during the session", async () => {
    expect(cspViolations).toEqual([]);
  });

  test("logout ends the session", async () => {
    await a.goto("/settings");
    await a.getByRole("button", { name: "Sign out" }).click();
    await a.waitForURL("**/login");
    await a.goto("/chat");
    await expect(a).toHaveURL(/\/login$/);
  });
});
