const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE_URL = "http://127.0.0.1:5291";
const OUT_DIR = path.join(process.cwd(), ".artifacts", "ui-check");

async function ensureDir() {
  await fs.mkdir(OUT_DIR, { recursive: true });
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: true });
}

async function readNotice(page) {
  const locators = ["#msg", "#pageMessage", ".page-message", ".notice"];
  for (const selector of locators) {
    const locator = page.locator(selector).first();
    if (await locator.count()) {
      const text = ((await locator.textContent()) || "").replace(/\s+/g, " ").trim();
      if (text) {
        return text;
      }
    }
  }
  return "";
}

async function collectConsole(page, store) {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      store.push(`console:${msg.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    store.push(`pageerror:${error.message}`);
  });
}

async function checkHome(page, result) {
  await page.goto(`${BASE_URL}/`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("a.module-card");
  const title = await page.title();
  await screenshot(page, "home.png");

  const cards = await page.locator("a.module-card").count();
  await page.locator('a[href="/__router"]').first().click();
  await page.waitForURL("**/__router");
  result.home = {
    title,
    moduleCards: cards,
    navToRouterWorks: page.url().endsWith("/__router")
  };
}

async function checkRouter(page, result) {
  await page.goto(`${BASE_URL}/__router`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".provider-item");
  const before = await page.locator(".provider-item").count();
  await page.getByRole("button", { name: "添加上游" }).click();
  await page.waitForTimeout(300);
  const afterAdd = await page.locator(".provider-item").count();
  await page.locator(".provider-item").last().getByRole("button", { name: "删除上游" }).click();
  await page.waitForTimeout(300);
  const afterDelete = await page.locator(".provider-item").count();
  await page.getByRole("button", { name: "从文件重载" }).click();
  await page.waitForTimeout(500);
  const afterReload = await page.locator(".provider-item").count();
  await screenshot(page, "router.png");

  result.router = {
    title: await page.title(),
    providerCountBefore: before,
    providerCountAfterAdd: afterAdd,
    providerCountAfterDelete: afterDelete,
    providerCountAfterReload: afterReload,
    addButtonWorks: afterAdd === before + 1,
    deleteButtonWorks: afterDelete === before,
    reloadButtonWorks: afterReload === before
  };
}

async function checkLog(page, result) {
  await page.goto(`${BASE_URL}/__admin`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
  const adminUrl = page.url();
  await page.goto(`${BASE_URL}/__log`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#logLimit");
  await page.getByRole("button", { name: "立即刷新" }).click();
  await page.waitForTimeout(1200);
  await screenshot(page, "log.png");

  const listCount = await page.locator("[data-request-id]").count().catch(() => 0);
  result.log = {
    title: await page.title(),
    adminCompatibilityRedirects: adminUrl.endsWith("/__log"),
    refreshButtonClickable: true,
    visibleLogItems: listCount
  };
}

async function pickOptionValue(page, selector) {
  return page.locator(`${selector} option`).first().getAttribute("value");
}

async function checkLoop(page, result) {
  const taskName = `ui-smoke-${Date.now()}`;
  await page.goto(`${BASE_URL}/__loop`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#name");
  page.on("dialog", async (dialog) => {
    await dialog.accept();
  });

  const runner = page.locator("#runner");
  if (await runner.isVisible().catch(() => false)) {
    const runnerValue = await pickOptionValue(page, "#runner");
    if (runnerValue) {
      await runner.selectOption(runnerValue);
    }
  }
  await page.locator("#name").fill(taskName);
  await page.locator("#intervalSec").fill("3600");
  await page.locator("#cwd").fill(process.cwd());
  await page.locator("#command").fill("echo ui-check");
  await page.locator("#prompt").fill("frontend smoke test");

  await page.getByRole("button", { name: "测试一次（不保存）" }).click();
  await page.waitForTimeout(1200);
  const testNotice = await readNotice(page);

  await page.getByRole("button", { name: "创建任务" }).click();
  await page.waitForTimeout(1200);
  await page.locator("#taskSearch").fill(taskName);
  await page.waitForTimeout(800);

  const card = page.locator(`[data-task-card="true"][aria-label="查看任务详情：${taskName}"]`).first();
  await card.waitFor({ state: "visible", timeout: 10000 });
  await card.click();
  await page.waitForTimeout(500);

  const runButton = page.locator('#taskDetailBody button[data-act="run"]').first();
  const deleteButton = page.locator('#taskDetailBody button[data-act="delete"]').first();
  let runClicked = false;
  if (await runButton.count()) {
    await runButton.click();
    await page.waitForTimeout(1500);
    runClicked = true;
  }
  let deleteClicked = false;
  if (await deleteButton.count()) {
    await deleteButton.click();
    await page.waitForTimeout(1500);
    deleteClicked = true;
  }

  const remainingTaskCards = await page.locator(`[data-task-card="true"][aria-label="查看任务详情：${taskName}"]`).count();
  const pageText = await page.locator("body").textContent();
  await screenshot(page, "loop.png");

  result.loop = {
    title: await page.title(),
    testRunMessage: testNotice,
    taskCreated: Boolean(pageText && pageText.includes(taskName)),
    runButtonClickable: runClicked,
    deleteButtonClickable: deleteClicked,
    taskDeleted: remainingTaskCards === 0
  };
}

async function main() {
  await ensureDir();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1400 } });
  const errors = [];
  const result = { baseUrl: BASE_URL, screenshotsDir: OUT_DIR, errors };
  await collectConsole(page, errors);

  try {
    await checkHome(page, result);
    await checkRouter(page, result);
    await checkLog(page, result);
    await checkLoop(page, result);
  } finally {
    await browser.close();
  }

  await fs.writeFile(path.join(OUT_DIR, "summary.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
