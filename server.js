const express = require('express');
const { chromium } = require('playwright');
const app = express();
app.use(express.json());

app.post('/run-tests', async (req, res) => {
  const { url, suiteId } = req.body;
  console.log(`run-tests called: url=${url} suiteId=${suiteId}`);
  if (!url) return res.status(400).json({ error: 'url required' });

  let browser;
  try {
    console.log('launching chromium...');
    const wsEndpoint = `wss://chrome.browserless.io?token=${process.env.BROWSERLESS_TOKEN}`;
    browser = await chromium.connectOverCDP(wsEndpoint);
    console.log('chromium launched');
    const context = await browser.newContext();
    const page = await context.newPage();
    console.log('navigating to', url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    console.log('page loaded');
    await page.waitForTimeout(500);
    const results = await runTodoSuite(page);
    console.log('results:', JSON.stringify(results));
    res.json(results);
  } catch (e) {
    res.json([{ id: 'error', name: 'test error', passed: false, weight: 100, detail: e.message }]);
  } finally {
    if (browser) await browser.close();
  }
});

async function runTodoSuite(page) {
  const results = [];

  // Test 1: Add a task
  try {
    const input = page.locator('#todo-input');
    await input.fill('Test task alpha');
    await input.press('Enter');
    await page.waitForTimeout(500);
    const count = await page.locator('#todo-list li').count();
    results.push({
      id: 'add_task', name: 'can add a task', passed: count > 0, weight: 20,
      detail: count > 0 ? `found ${count} task(s)` : 'no li found in #todo-list after adding task'
    });
  } catch (e) {
    results.push({ id: 'add_task', name: 'can add a task', passed: false, weight: 20, detail: e.message });
  }

  // Test 2: Toggle complete
  try {
    const checkbox = page.locator('#todo-list li').first().locator('input[type="checkbox"]');
    await checkbox.check();
    await page.waitForTimeout(300);
    const afterCheck = await page.locator('#todo-list li.completed').count();
    await checkbox.uncheck();
    await page.waitForTimeout(300);
    const afterUncheck = await page.locator('#todo-list li.completed').count();
    const passed = afterCheck > 0 && afterUncheck === 0;
    results.push({
      id: 'toggle_task', name: 'toggle marks and unmarks completed', passed, weight: 20,
      detail: passed ? 'completed after check, uncompleted after uncheck'
        : `completed after check: ${afterCheck}, after uncheck: ${afterUncheck}`
    });
  } catch (e) {
    results.push({ id: 'toggle_task', name: 'toggle marks and unmarks completed', passed: false, weight: 20, detail: e.message });
  }

  // Test 3: Delete a task
  try {
    const input = page.locator('#todo-input');
    await input.fill('Test task beta');
    await input.press('Enter');
    await page.waitForTimeout(300);
    const beforeCount = await page.locator('#todo-list li').count();
    const lastItem = page.locator('#todo-list li').last();
    await lastItem.hover();
    await page.waitForTimeout(200);
    await lastItem.locator('.delete-btn').click();
    await page.waitForTimeout(400);
    const afterCount = await page.locator('#todo-list li').count();
    const passed = afterCount === beforeCount - 1;
    results.push({
      id: 'delete_task', name: 'delete removes a task', passed, weight: 20,
      detail: passed ? 'task removed successfully' : `count before: ${beforeCount}, after: ${afterCount}`
    });
  } catch (e) {
    results.push({ id: 'delete_task', name: 'delete removes a task', passed: false, weight: 20, detail: e.message });
  }

  // Test 4: Filter active
  try {
    const input = page.locator('#todo-input');
    await input.fill('Completed task');
    await input.press('Enter');
    await page.waitForTimeout(300);
    const allItems = await page.locator('#todo-list li').count();
    const firstCheckbox = page.locator('#todo-list li').first().locator('input[type="checkbox"]');
    await firstCheckbox.check();
    await page.waitForTimeout(300);
    await page.locator('.filter-btn[data-filter="active"]').click();
    await page.waitForTimeout(300);
    const activeItems = await page.locator('#todo-list li').count();
    const passed = activeItems < allItems;
    results.push({
      id: 'filter_active', name: 'filter shows only active tasks', passed, weight: 20,
      detail: passed ? `all: ${allItems}, active: ${activeItems}` : `filter did not reduce items: ${activeItems}`
    });
  } catch (e) {
    results.push({ id: 'filter_active', name: 'filter shows only active tasks', passed: false, weight: 20, detail: e.message });
  }

  // Test 5: localStorage persistence
  try {
    const stored = await page.evaluate(() => localStorage.getItem('taskflow_todos'));
    const passed = stored !== null && stored !== '[]' && stored !== '';
    results.push({
      id: 'localstorage', name: 'tasks persist in localStorage', passed, weight: 20,
      detail: passed ? 'taskflow_todos key found in localStorage' : 'taskflow_todos is empty or missing'
    });
  } catch (e) {
    results.push({ id: 'localstorage', name: 'tasks persist in localStorage', passed: false, weight: 20, detail: e.message });
  }

  return results;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`playwright-service ready on port ${PORT}`));