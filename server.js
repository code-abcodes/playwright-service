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

    let results;
    switch (suiteId) {
      case 'js_game_platformer_v1':
        results = await runPlatformerSuite(page);
        break;
      case 'js_game_roguelike_v1':
        results = await runRoguelikeSuite(page);
        break;
      case 'js_game_multiplayer_v1':
        results = await runMultiplayerSuite(page);
        break;
      default:
        results = await runTodoSuite(page);
    }

    console.log('results:', JSON.stringify(results));
    res.json(results);
  } catch (e) {
    console.error('run-tests error:', e.message);
    res.json([{ id: 'error', name: 'test error', passed: false, weight: 100, detail: e.message }]);
  } finally {
    if (browser) await browser.close();
  }
});

// ── Todo Suite (JAVASCRIPT/WEB_DEVELOPMENT seq 1) ─────────────────────────────
async function runTodoSuite(page) {
  const results = [];

  try {
    const input = page.locator('#todo-input, #task-input, input[type="text"]').first();
    await input.fill('Test task alpha');
    await input.press('Enter');
    await page.waitForTimeout(500);
    const count = await page.locator('#todo-list li, .task-list li, ul li').count();
    results.push({
      id: 'add_task', name: 'can add a task', passed: count > 0, weight: 20,
      detail: count > 0 ? `found ${count} task(s)` : 'no li found after adding task'
    });
  } catch (e) {
    results.push({ id: 'add_task', name: 'can add a task', passed: false, weight: 20, detail: e.message });
  }

  try {
    const checkbox = page.locator('#todo-list li, ul li').first().locator('input[type="checkbox"]');
    await checkbox.check();
    await page.waitForTimeout(300);
    const afterCheck = await page.locator('li.completed').count();
    await checkbox.uncheck();
    await page.waitForTimeout(300);
    const afterUncheck = await page.locator('li.completed').count();
    const passed = afterCheck > 0 && afterUncheck === 0;
    results.push({
      id: 'toggle_task', name: 'toggle marks and unmarks completed', passed, weight: 20,
      detail: passed ? 'completed after check, uncompleted after uncheck'
        : `completed after check: ${afterCheck}, after uncheck: ${afterUncheck}`
    });
  } catch (e) {
    results.push({ id: 'toggle_task', name: 'toggle marks and unmarks completed', passed: false, weight: 20, detail: e.message });
  }

  try {
    const input = page.locator('#todo-input, #task-input, input[type="text"]').first();
    await input.fill('Test task beta');
    await input.press('Enter');
    await page.waitForTimeout(300);
    const beforeCount = await page.locator('#todo-list li, ul li').count();
    const lastItem = page.locator('#todo-list li, ul li').last();
    await lastItem.hover();
    await page.waitForTimeout(200);
    await lastItem.locator('.delete-btn, button[aria-label*="Delete"], button[aria-label*="delete"]').click();
    await page.waitForTimeout(400);
    const afterCount = await page.locator('#todo-list li, ul li').count();
    const passed = afterCount === beforeCount - 1;
    results.push({
      id: 'delete_task', name: 'delete removes a task', passed, weight: 20,
      detail: passed ? 'task removed successfully' : `count before: ${beforeCount}, after: ${afterCount}`
    });
  } catch (e) {
    results.push({ id: 'delete_task', name: 'delete removes a task', passed: false, weight: 20, detail: e.message });
  }

  try {
    const input = page.locator('#todo-input, #task-input, input[type="text"]').first();
    await input.fill('Completed task');
    await input.press('Enter');
    await page.waitForTimeout(300);
    const allItems = await page.locator('#todo-list li, ul li').count();
    const firstCheckbox = page.locator('#todo-list li, ul li').first().locator('input[type="checkbox"]');
    await firstCheckbox.check();
    await page.waitForTimeout(300);
    await page.locator('.filter-btn[data-filter="active"], button:has-text("Active")').click();
    await page.waitForTimeout(300);
    const activeItems = await page.locator('#todo-list li, ul li').count();
    const passed = activeItems < allItems;
    results.push({
      id: 'filter_active', name: 'filter shows only active tasks', passed, weight: 20,
      detail: passed ? `all: ${allItems}, active: ${activeItems}` : `filter did not reduce items: ${activeItems}`
    });
  } catch (e) {
    results.push({ id: 'filter_active', name: 'filter shows only active tasks', passed: false, weight: 20, detail: e.message });
  }

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

// ── Platformer Suite (JAVASCRIPT/GAME_DEVELOPMENT seq 1) ──────────────────────
// ── Platformer Suite (JAVASCRIPT/GAME_DEVELOPMENT seq 1) ──────────────────────
async function runPlatformerSuite(page) {
  const results = [];

  // Test 1: canvas exists
  try {
    await page.waitForSelector('canvas', { timeout: 10000 });
    const hasCanvas = await page.locator('canvas').count() > 0;
    results.push({
      id: 'canvas_element_present', name: 'canvas element exists', passed: hasCanvas, weight: 20,
      detail: hasCanvas ? 'canvas element found' : 'no canvas element found'
    });
  } catch (e) {
    results.push({ id: 'canvas_element_present', name: 'canvas element exists', passed: false, weight: 20, detail: e.message });
  }

  // Test 2: clicking something starts the game (canvas changes)
  try {
    const beforeShot = await page.screenshot();
    const btnCount = await page.locator('button').count();
    if (btnCount > 0) {
      await page.locator('button').first().click();
    } else {
      await page.locator('canvas').first().click();
    }
    await page.waitForTimeout(1500);
    const afterShot = await page.screenshot();
    const passed = !beforeShot.equals(afterShot);
    results.push({
      id: 'game_responds_to_start', name: 'clicking start produces visible change', passed, weight: 25,
      detail: passed ? 'page changed after clicking start' : 'no visible change after clicking start'
    });
  } catch (e) {
    results.push({ id: 'game_responds_to_start', name: 'clicking start produces visible change', passed: false, weight: 25, detail: e.message });
  }

  // Test 3: HUD exists — generic selectors covering any reasonable implementation
  try {
    const hudEl = await page.locator(
      '#score-display, #lives-display, #health-bar, #health-display, ' +
      '#score, #lives, #health, .score, .lives, .health, ' +
      '[id*="score"], [id*="lives"], [id*="health"], [id*="hud"], ' +
      '[class*="score"], [class*="lives"], [class*="health"], [class*="hud"]'
    ).count();
    results.push({
      id: 'score_or_lives_display', name: 'score or lives display exists', passed: hudEl > 0, weight: 20,
      detail: hudEl > 0 ? 'found HUD display element' : 'no score/lives/health element found'
    });
  } catch (e) {
    results.push({ id: 'score_or_lives_display', name: 'score or lives display exists', passed: false, weight: 20, detail: e.message });
  }

  // Test 4: game runs 5 seconds without crash
  try {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.waitForTimeout(5000);
    const passed = errors.length === 0;
    results.push({
      id: 'game_runs_five_seconds', name: 'game runs 5 seconds without crash', passed, weight: 20,
      detail: passed ? 'no errors in 5 seconds' : `errors: ${errors.slice(0, 2).join(', ')}`
    });
  } catch (e) {
    results.push({ id: 'game_runs_five_seconds', name: 'game runs 5 seconds without crash', passed: false, weight: 20, detail: e.message });
  }

  // Test 5: page loads
  try {
    const pageLoaded = await page.locator('body').count() > 0;
    results.push({
      id: 'page_loads', name: 'page loads without errors', passed: pageLoaded, weight: 15,
      detail: pageLoaded ? 'page loaded successfully' : 'page did not load'
    });
  } catch (e) {
    results.push({ id: 'page_loads', name: 'page loads without errors', passed: false, weight: 15, detail: e.message });
  }

  return results;
}

// ── Roguelike Suite (JAVASCRIPT/GAME_DEVELOPMENT seq 2) ───────────────────────
async function runRoguelikeSuite(page) {
  const results = [];

  try {
    const hasCanvas = await page.locator('canvas').count() > 0;
    results.push({
      id: 'canvas_present', name: 'canvas element exists', passed: hasCanvas, weight: 15,
      detail: hasCanvas ? 'canvas element found' : 'no canvas element found'
    });
  } catch (e) {
    results.push({ id: 'canvas_present', name: 'canvas element exists', passed: false, weight: 15, detail: e.message });
  }

  try {
    const startBtn = page.locator('button, #new-game, #start, .new-game, canvas').first();
    const beforeShot = await page.screenshot();
    await startBtn.click();
    await page.waitForTimeout(1000);
    const afterShot = await page.screenshot();
    const passed = !beforeShot.equals(afterShot);
    results.push({
      id: 'game_starts', name: 'clicking new game produces canvas change', passed, weight: 25,
      detail: passed ? 'canvas changed after clicking start' : 'no canvas change after clicking start'
    });
  } catch (e) {
    results.push({ id: 'game_starts', name: 'clicking new game produces canvas change', passed: false, weight: 25, detail: e.message });
  }

  try {
    const beforeShot = await page.screenshot();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
    const afterShot = await page.screenshot();
    const passed = !beforeShot.equals(afterShot);
    results.push({
      id: 'player_responds_to_input', name: 'arrow key moves player', passed, weight: 25,
      detail: passed ? 'canvas changed after arrow key' : 'no canvas change after arrow key'
    });
  } catch (e) {
    results.push({ id: 'player_responds_to_input', name: 'arrow key moves player', passed: false, weight: 25, detail: e.message });
  }

  try {
    const statsEl = await page.locator('#inventory, .inventory, #stats, .stats, #hp, .hp, #health, .health-bar').count();
    results.push({
      id: 'stats_ui_present', name: 'inventory or stats display exists', passed: statsEl > 0, weight: 15,
      detail: statsEl > 0 ? 'found stats/inventory element' : 'no stats/inventory/health element found'
    });
  } catch (e) {
    results.push({ id: 'stats_ui_present', name: 'inventory or stats display exists', passed: false, weight: 15, detail: e.message });
  }

  try {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.waitForTimeout(5000);
    const passed = errors.length === 0;
    results.push({
      id: 'game_runs_without_crash', name: 'game runs 5 seconds without crash', passed, weight: 10,
      detail: passed ? 'no errors in 5 seconds' : `errors: ${errors.slice(0, 2).join(', ')}`
    });
  } catch (e) {
    results.push({ id: 'game_runs_without_crash', name: 'game runs 5 seconds without crash', passed: false, weight: 10, detail: e.message });
  }

  try {
    const pageLoaded = await page.locator('canvas, body').count() > 0;
    results.push({
      id: 'page_loads', name: 'page loads without errors', passed: pageLoaded, weight: 10,
      detail: pageLoaded ? 'page loaded successfully' : 'page did not load'
    });
  } catch (e) {
    results.push({ id: 'page_loads', name: 'page loads without errors', passed: false, weight: 10, detail: e.message });
  }

  return results;
}

// ── Multiplayer Suite (JAVASCRIPT/GAME_DEVELOPMENT seq 3) ─────────────────────
async function runMultiplayerSuite(page) {
  const results = [];

  try {
    const hasCanvas = await page.locator('canvas').count() > 0;
    results.push({
      id: 'canvas_present', name: 'canvas element exists', passed: hasCanvas, weight: 15,
      detail: hasCanvas ? 'canvas element found' : 'no canvas element found'
    });
  } catch (e) {
    results.push({ id: 'canvas_present', name: 'canvas element exists', passed: false, weight: 15, detail: e.message });
  }

  try {
    const lobbyEl = await page.locator('#lobby, .lobby, #matchmaking, .matchmaking, #game-ui, .game-ui, #connect, .connect-btn').count();
    results.push({
      id: 'lobby_visible', name: 'lobby or connect UI visible on load', passed: lobbyEl > 0, weight: 20,
      detail: lobbyEl > 0 ? 'lobby/connect element found' : 'no lobby or connect element found'
    });
  } catch (e) {
    results.push({ id: 'lobby_visible', name: 'lobby or connect UI visible on load', passed: false, weight: 20, detail: e.message });
  }

  try {
    const startBtn = page.locator('button, #start, #connect, #play, .play-btn, canvas').first();
    const beforeShot = await page.screenshot();
    await startBtn.click();
    await page.waitForTimeout(1500);
    const afterShot = await page.screenshot();
    const passed = !beforeShot.equals(afterShot);
    results.push({
      id: 'game_starts', name: 'clicking start renders arena', passed, weight: 25,
      detail: passed ? 'canvas changed after clicking start' : 'no canvas change after clicking start'
    });
  } catch (e) {
    results.push({ id: 'game_starts', name: 'clicking start renders arena', passed: false, weight: 25, detail: e.message });
  }

  try {
    const beforeShot = await page.screenshot();
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(500);
    const afterShot = await page.screenshot();
    const passed = !beforeShot.equals(afterShot);
    results.push({
      id: 'player_movement', name: 'movement key moves player', passed, weight: 20,
      detail: passed ? 'canvas changed after arrow key' : 'no canvas change after movement key'
    });
  } catch (e) {
    results.push({ id: 'player_movement', name: 'movement key moves player', passed: false, weight: 20, detail: e.message });
  }

  try {
    const errors = [];
    page.on('pageerror', err => errors.push(err.message));
    await page.waitForTimeout(3000);
    const passed = errors.length === 0;
    results.push({
      id: 'no_connection_error', name: 'no connection errors after 3 seconds', passed, weight: 10,
      detail: passed ? 'no errors in 3 seconds' : `errors: ${errors.slice(0, 2).join(', ')}`
    });
  } catch (e) {
    results.push({ id: 'no_connection_error', name: 'no connection errors after 3 seconds', passed: false, weight: 10, detail: e.message });
  }

  try {
    const pageLoaded = await page.locator('canvas, body').count() > 0;
    results.push({
      id: 'page_loads', name: 'page loads without errors', passed: pageLoaded, weight: 10,
      detail: pageLoaded ? 'page loaded successfully' : 'page did not load'
    });
  } catch (e) {
    results.push({ id: 'page_loads', name: 'page loads without errors', passed: false, weight: 10, detail: e.message });
  }

  return results;
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`playwright-service ready on port ${PORT}`));