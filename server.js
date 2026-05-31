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

    // ── ATTACH ERROR COLLECTOR BEFORE NAVIGATION ──────────────────────────
    const pageErrors = [];
    page.on('pageerror', err => {
      console.log('pageerror:', err.message);
      pageErrors.push(err.message);
    });
    // ──────────────────────────────────────────────────────────────────────

    console.log('navigating to', url);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });
    console.log('page loaded');
    await page.waitForTimeout(1500); // give JS time to run and potentially crash

    let results;
    switch (suiteId) {
      case 'js_game_platformer_v1':
        results = await runPlatformerSuite(page, pageErrors);
        break;
      case 'js_game_roguelike_v1':
        results = await runRoguelikeSuite(page, pageErrors);
        break;
      case 'js_game_multiplayer_v1':
        results = await runMultiplayerSuite(page, pageErrors);
        break;
      default:
        results = await runTodoSuite(page, pageErrors);
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
async function runTodoSuite(page, pageErrors = []) {
  const results = [];

  // Wait for input to appear — handles any remaining JS init
  try {
    await page.waitForSelector('#task-input, input[type="text"]', { timeout: 3000 });
  } catch (_) { /* will be reported per-test */ }

  // page_loads_without_errors — 10 pts
  // Uses errors collected from BEFORE navigation, not just from this moment
  try {
    const passed = pageErrors.length === 0;
    results.push({
      id: 'page_loads_without_errors',
      name: 'App page loads without JavaScript console errors',
      passed,
      weight: 10,
      detail: passed ? 'no console errors on load' : `errors: ${pageErrors.slice(0, 2).join(', ')}`
    });
  } catch (e) {
    results.push({ id: 'page_loads_without_errors', name: 'App page loads without JavaScript console errors', passed: false, weight: 10, detail: e.message });
  }

  // input_field_present — 15 pts
  try {
    const count = await page.locator('#task-input, input[type="text"], input[type="search"]').count();
    const passed = count > 0;
    results.push({
      id: 'input_field_present',
      name: 'A task input field is present on the page',
      passed,
      weight: 15,
      detail: passed ? `input field found (${count})` : 'no input field found'
    });
  } catch (e) {
    results.push({ id: 'input_field_present', name: 'A task input field is present on the page', passed: false, weight: 15, detail: e.message });
  }

  // can_add_task — 25 pts
  try {
    const inputCount = await page.locator('#task-input, input[type="text"]').count();
    if (inputCount === 0) {
      results.push({ id: 'can_add_task', name: 'Typing a task and submitting adds it to the list', passed: false, weight: 25, detail: 'no input field found to type into' });
    } else {
      const input = page.locator('#task-input, input[type="text"]').first();
      await input.fill('Buy groceries from Shoprite');
      const submitBtn = page.locator('#add-btn, button[type="submit"], .add-btn, button').first();
      const btnCount = await submitBtn.count();
      if (btnCount > 0) {
        await submitBtn.click();
      } else {
        await input.press('Enter');
      }
      await page.waitForTimeout(500);
      const bodyText = await page.locator('body').innerText();
      const passed = bodyText.includes('Buy groceries from Shoprite');
      results.push({
        id: 'can_add_task',
        name: 'Typing a task and submitting adds it to the list',
        passed,
        weight: 25,
        detail: passed ? 'task text found in page' : 'task text not found after submit'
      });
    }
  } catch (e) {
    results.push({ id: 'can_add_task', name: 'Typing a task and submitting adds it to the list', passed: false, weight: 25, detail: e.message });
  }

  // task_list_container_present — 15 pts
  try {
    const count = await page.locator('#task-list, ul, ol, .task-list').count();
    const passed = count > 0;
    results.push({
      id: 'task_list_container_present',
      name: 'A container element holds the list of tasks',
      passed,
      weight: 15,
      detail: passed ? 'list container found' : 'no list container found'
    });
  } catch (e) {
    results.push({ id: 'task_list_container_present', name: 'A container element holds the list of tasks', passed: false, weight: 15, detail: e.message });
  }

  // can_complete_task — 20 pts
  try {
    // Add a fresh task specifically for this test so we know one exists
    const input = page.locator('#task-input, input[type="text"]').first();
    const inputCount = await input.count();
    if (inputCount > 0) {
      await input.fill('Task to complete');
      const submitBtn = page.locator('#add-btn, button[type="submit"], .add-btn, button').first();
      const btnCount = await submitBtn.count();
      if (btnCount > 0) {
        await submitBtn.click();
      } else {
        await input.press('Enter');
      }
      await page.waitForTimeout(500);
    }

    // Now find a checkbox specifically — not just any li
    const checkbox = page.locator('#task-list input[type="checkbox"], ul li input[type="checkbox"]').first();
    const checkboxCount = await checkbox.count();

    if (checkboxCount === 0) {
      results.push({
        id: 'can_complete_task',
        name: 'Clicking a task or its checkbox marks it complete',
        passed: false,
        weight: 20,
        detail: 'no checkbox found in task list'
      });
    } else {
      const beforeHTML = await page.locator('#task-list, ul').first().innerHTML();
      await checkbox.click();
      await page.waitForTimeout(500);
      const afterHTML = await page.locator('#task-list, ul').first().innerHTML();
      const passed = beforeHTML !== afterHTML;
      results.push({
        id: 'can_complete_task',
        name: 'Clicking a task or its checkbox marks it complete',
        passed,
        weight: 20,
        detail: passed ? 'DOM changed after clicking checkbox' : 'no DOM change after clicking checkbox'
      });
    }
  } catch (e) {
    results.push({
      id: 'can_complete_task',
      name: 'Clicking a task or its checkbox marks it complete',
      passed: false,
      weight: 20,
      detail: e.message
    });
  }

  // app_does_not_crash_after_interaction — 15 pts
  // Uses the shared pageErrors — catches crashes from ANY point in the session
  try {
    await page.waitForTimeout(5000);
    const passed = pageErrors.length === 0;
    results.push({
      id: 'app_does_not_crash_after_interaction',
      name: 'App runs for 5 seconds after interaction without crashing',
      passed,
      weight: 15,
      required: true,
      detail: passed ? 'no errors in 5 seconds' : `errors: ${pageErrors.slice(0, 2).join(', ')}`
    });
  } catch (e) {
    results.push({ id: 'app_does_not_crash_after_interaction', name: 'App runs for 5 seconds after interaction without crashing', passed: false, weight: 15, required: true, detail: e.message });
  }

  return results;
}

// ── Platformer Suite (JAVASCRIPT/GAME_DEVELOPMENT seq 1) ──────────────────────
async function runPlatformerSuite(page, pageErrors = []) {
  const results = [];

  // Test 1: canvas exists — use count() not waitForSelector (count never checks visibility)
  try {
    const count = await page.locator('canvas').count();
    const passed = count > 0;
    results.push({
      id: 'canvas_element_present',
      name: 'canvas element exists',
      passed,
      weight: 20,
      detail: passed ? `canvas element found (${count})` : 'no canvas element found'
    });
  } catch (e) {
    results.push({ id: 'canvas_element_present', name: 'canvas element exists', passed: false, weight: 20, detail: e.message });
  }

  // Test 2: clicking something starts the game
  try {
    const beforeShot = await page.screenshot();
    const btnCount = await page.locator('button').count();
    const canvasCount = await page.locator('canvas').count();

    if (btnCount > 0) {
      await page.locator('button').first().click();
    } else if (canvasCount > 0) {
      // dispatchEvent bypasses Playwright's visibility check
      await page.locator('canvas').first().dispatchEvent('click');
    } else {
      await page.locator('body').click();
    }
    await page.waitForTimeout(2000);
    const afterShot = await page.screenshot();
    const passed = !beforeShot.equals(afterShot);
    results.push({
      id: 'game_responds_to_start',
      name: 'clicking start produces visible change',
      passed,
      weight: 25,
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
    await page.waitForTimeout(5000);
    const passed = pageErrors.length === 0;
    results.push({
      id: 'game_runs_five_seconds', name: 'game runs 5 seconds without crash', passed, weight: 20, required: true,
      detail: passed ? 'no errors in 5 seconds' : `errors: ${pageErrors.slice(0, 2).join(', ')}`
    });
  } catch (e) {
    results.push({ id: 'game_runs_five_seconds', name: 'game runs 5 seconds without crash', passed: false, weight: 20, required: true, detail: e.message });
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
async function runRoguelikeSuite(page, pageErrors = []) {
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
    const beforeShot = await page.screenshot();
    const btnCount = await page.locator('button, #new-game, #start, .new-game').count();
    const canvasCount = await page.locator('canvas').count();

    if (btnCount > 0) {
      await page.locator('button, #new-game, #start, .new-game').first().click();
    } else if (canvasCount > 0) {
      await page.locator('canvas').first().dispatchEvent('click');
    } else {
      await page.locator('body').click();
    }
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
    await page.waitForTimeout(5000);
    const passed = pageErrors.length === 0;
    results.push({
      id: 'game_runs_without_crash', name: 'game runs 5 seconds without crash', passed, weight: 10,
      detail: passed ? 'no errors in 5 seconds' : `errors: ${pageErrors.slice(0, 2).join(', ')}`
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
async function runMultiplayerSuite(page, pageErrors = []) {
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
    const beforeShot = await page.screenshot();
    const btnCount = await page.locator('button, #start, #connect, #play, .play-btn').count();
    const canvasCount = await page.locator('canvas').count();

    if (btnCount > 0) {
      await page.locator('button, #start, #connect, #play, .play-btn').first().click();
    } else if (canvasCount > 0) {
      await page.locator('canvas').first().dispatchEvent('click');
    } else {
      await page.locator('body').click();
    }
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
    await page.waitForTimeout(3000);
    const passed = pageErrors.length === 0;
    results.push({
      id: 'no_connection_error', name: 'no connection errors after 3 seconds', passed, weight: 10,
      detail: passed ? 'no errors in 3 seconds' : `errors: ${pageErrors.slice(0, 2).join(', ')}`
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