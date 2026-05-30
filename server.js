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
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForTimeout(500);
    const results = await runTodoSuite(page);
    res.json(results);
  } catch (e) {
    res.json([{ id: 'error', name: 'test error', passed: false, weight: 100, detail: e.message }]);
  } finally {
    if (browser) await browser.close();
  }
});

async function runTodoSuite(page) {
  const results = [];

  try {
    const input = page.locator('#task-input, input[type="text"], input[placeholder]').first();
    await input.fill('Test task alpha');
    await input.press('Enter');
    await page.waitForTimeout(300);
    const count = await page.locator('.task-item').count();
    results.push({ id: 'add_task', name: 'can add a task', passed: count > 0, weight: 20,
      detail: count > 0 ? `task-item count: ${count}` : 'no .task-item found after adding task' });
  } catch (e) {
    results.push({ id: 'add_task', name: 'can add a task', passed: false, weight: 20, detail: e.message });
  }

  try {
    const checkbox = page.locator('.task-item').first().locator('button[data-action="toggle"], .task-checkbox').first();
    await checkbox.click();
    await page.waitForTimeout(200);
    const afterFirst = await page.locator('.task-item.completed').count();
    await checkbox.click();
    await page.waitForTimeout(200);
    const afterSecond = await page.locator('.task-item.completed').count();
    const passed = afterFirst > 0 && afterSecond === 0;
    results.push({ id: 'toggle_task', name: 'toggle marks and unmarks completed', passed, weight: 20,
      detail: passed ? 'completed after first click, uncompleted after second'
        : `completed count after click 1: ${afterFirst}, after click 2: ${afterSecond}` });
  } catch (e) {
    results.push({ id: 'toggle_task', name: 'toggle marks and unmarks completed', passed: false, weight: 20, detail: e.message });
  }

  try {
    const input = page.locator('#task-input, input[type="text"], input[placeholder]').first();
    await input.fill('Test task beta');
    await input.press('Enter');
    await page.waitForTimeout(300);
    const beforeCount = await page.locator('.task-item').count();
    const firstTextBefore = await page.locator('.task-item').first().locator('.task-text').textContent();
    const lastItem = page.locator('.task-item').last();
    await lastItem.hover();
    await page.waitForTimeout(150);
    await lastItem.locator('button[data-action="delete"]').click();
    await page.waitForTimeout(400);
    const afterCount = await page.locator('.task-item').count();
    const firstTextAfter = await page.locator('.task-item').first().locator('.task-text').textContent();
    const passed = afterCount === beforeCount - 1 && firstTextBefore.trim() === firstTextAfter.trim();
    results.push({ id: 'delete_correct_item', name: 'delete removes the correct task', passed, weight: 20,
      detail: passed ? 'correct item removed, first item preserved'
        : `count before: ${beforeCount}, after: ${afterCount}` });
  } catch (e) {
    results.push({ id: 'delete_correct_item', name: 'delete removes the correct task', passed: false, weight: 20, detail: e.message });
  }

  try {
    await page.waitForSelector('.task-item.removing', { state: 'detached', timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
    const firstItem = page.locator('.task-item').first();
    await firstItem.hover();
    await page.waitForTimeout(150);
    await firstItem.locator('button[data-action="edit"]').click({ timeout: 5000 });
    await page.waitForTimeout(300);
    const modalInput = page.locator('#edit-input, .edit-input, dialog input[type="text"]').first();
    const modalVisible = await modalInput.isVisible().catch(() => false);
    results.push({ id: 'edit_modal_opens', name: 'edit button opens edit modal', passed: modalVisible, weight: 20,
      detail: modalVisible ? 'edit modal input is visible' : 'edit modal input not found or not visible' });
    if (modalVisible) { await page.keyboard.press('Escape'); await page.waitForTimeout(200); }
  } catch (e) {
    results.push({ id: 'edit_modal_opens', name: 'edit button opens edit modal', passed: false, weight: 20,
      detail: `click blocked or modal did not open: ${e.message.split('\n')[0]}` });
  }

  try {
    const sortBtn = page.locator('#sort-btn, button[title="Sort tasks"]').first();
    const sortLabel = page.locator('#sort-label').first();
    const label0 = (await sortLabel.textContent().catch(() => '')).trim();
    await sortBtn.click(); await page.waitForTimeout(150);
    const label1 = (await sortLabel.textContent().catch(() => '')).trim();
    await sortBtn.click(); await page.waitForTimeout(150);
    const label2 = (await sortLabel.textContent().catch(() => '')).trim();
    await sortBtn.click(); await page.waitForTimeout(150);
    const label3 = (await sortLabel.textContent().catch(() => '')).trim();
    const distinct = new Set([label1, label2, label3]);
    const cycled = distinct.size === 3 && label0 === label3;
    results.push({ id: 'sort_cycles', name: 'sort button cycles through all options and returns to start', passed: cycled, weight: 20,
      detail: cycled ? `cycled correctly: ${[label0,label1,label2,label3].join(' → ')}`
        : `labels seen: ${[label0,label1,label2,label3].join(' → ')}` });
  } catch (e) {
    results.push({ id: 'sort_cycles', name: 'sort button cycles through all options and returns to start', passed: false, weight: 20, detail: e.message });
  }

  return results;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`playwright-service ready on port ${PORT}`));