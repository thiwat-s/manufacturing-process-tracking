import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const baseUrl = process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:3000';
const artifactDirectory = resolve('artifacts/responsive-audit');
const viewports = [320, 360, 375, 390, 414, 768, 1024, 1280, 1440];
const screenshotWidths = new Set([375, 768, 1440]);
const orderId = '20000000-0000-4000-8000-000000000001';
const stepIds = Array.from(
  { length: 5 },
  (_, index) => `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
);
const resources = [
  {
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Titanium Powder',
    category: 'MATERIAL',
    unit: 'kg',
    isActive: true,
    createdAt: '2026-11-01T08:00:00.000Z',
  },
  {
    id: '10000000-0000-4000-8000-000000000002',
    name: 'Production Technician',
    category: 'LABOUR_TIME',
    unit: 'hour',
    isActive: true,
    createdAt: '2026-11-01T08:00:00.000Z',
  },
];
const productOrder = {
  id: orderId,
  orderNumber: 'MO-2026-0001',
  productName: 'Precision valve housing',
  quantity: 12,
  dueDate: '2026-11-20T00:00:00.000Z',
  createdAt: '2026-11-01T08:00:00.000Z',
  status: 'IN_PROGRESS',
  orderStepId: stepIds[0],
};
const readyOrder = {
  ...productOrder,
  id: '20000000-0000-4000-8000-000000000002',
  orderNumber: 'MO-2026-0002',
  productName: 'Instrument guide',
  orderStepId: stepIds[1],
};
const stepNames = [
  'Material Preparation',
  'Manufacturing',
  'Post-processing',
  'Quality Inspection',
  'Labelling & Packaging',
];
const detail = {
  ...productOrder,
  progress: 0,
  notes: 'Responsive audit fixture',
  steps: stepNames.map((name, index) => ({
    id: stepIds[index],
    status: index === 0 ? 'IN_PROGRESS' : 'PENDING',
    startedAt: index === 0 ? '2026-11-02T08:00:00.000Z' : null,
    completedAt: null,
    productionStep: {
      id: `40000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      name,
      sequence: index + 1,
    },
    consumptions:
      index === 0
        ? [
            {
              id: '50000000-0000-4000-8000-000000000001',
              quantity: '2.5',
              unitSnapshot: 'kg',
              recordedAt: '2026-11-02T08:30:00.000Z',
              notes: null,
              resource: resources[0],
            },
          ]
        : [],
  })),
  events: [
    {
      id: '60000000-0000-4000-8000-000000000001',
      description: 'Material Preparation started for MO-2026-0001.',
      createdAt: '2026-11-02T08:00:00.000Z',
      orderStep: { productionStep: { name: stepNames[0] } },
    },
  ],
};

async function mockApi(page) {
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    let body = { data: [] };
    if (path === '/api/dashboard') {
      body = {
        data: {
          totalOrders: 8,
          pendingOrders: 2,
          inProgressOrders: 4,
          completedOrders: 2,
          stepOverview: stepNames.map((name, index) => ({
            id: `step-${index}`,
            name,
            readyToStart: 1,
            inProgress: index === 0 ? 2 : 1,
            completed: 3,
          })),
          resourceConsumption: [
            { name: 'Titanium Powder', quantity: 14.5, unit: 'kg', category: 'MATERIAL' },
          ],
          recentEvents: [
            {
              id: 'event-1',
              description: 'Material Preparation started for MO-2026-0001.',
              createdAt: '2026-11-02T08:00:00.000Z',
              orderId,
              order: { orderNumber: 'MO-2026-0001' },
            },
          ],
        },
      };
    } else if (path === '/api/production/board') {
      body = {
        data: stepNames.map((name, index) => ({
          id: `step-${index}`,
          name,
          sequence: index + 1,
          readyToStart: index === 1 ? [readyOrder] : [],
          inProgress: index === 0 ? [productOrder] : [],
        })),
      };
    } else if (path === '/api/resources') {
      body = { data: resources };
    } else if (path === '/api/orders') {
      body = {
        data: [{ ...productOrder, steps: detail.steps }],
        pagination: { page: 1, pageSize: 10, total: 1, pages: 1 },
      };
    } else if (path === `/api/orders/${orderId}`) {
      body = { data: detail };
    } else if (path === `/api/orders/${orderId}/timeline`) {
      body = { data: detail.events };
    } else if (path === '/api/consumptions' || path.endsWith('/consumptions')) {
      body = { data: detail.steps[0].consumptions };
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

await mkdir(artifactDirectory, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const browserErrors = [];
page.on('pageerror', (error) => browserErrors.push(error.message));
page.on('console', (message) => {
  if (message.type() === 'error') browserErrors.push(message.text());
});
page.on('requestfailed', (request) => {
  const failure = request.failure()?.errorText ?? 'unknown';
  if (failure !== 'net::ERR_ABORTED') {
    browserErrors.push(`Request failed: ${request.url()} (${failure})`);
  }
});
await mockApi(page);

const routes = [
  ['dashboard', '/'],
  ['production', '/production'],
  ['orders', '/orders'],
  ['order-detail', `/orders/${orderId}`],
  ['resources', '/resources'],
];
const measurements = [];
async function waitForRouteContent(page, name) {
  const selectors = {
    dashboard: () => {
      const metric = document.querySelector('.kpi .kpivalue');
      return Boolean(metric && metric.textContent?.trim() !== '—');
    },
    production: () => document.querySelectorAll('.boardcol').length === 5,
    orders: () => document.querySelectorAll('.table tbody tr').length > 0,
    'order-detail': () => document.body.innerText.includes('MO-2026-0001'),
    resources: () => document.querySelectorAll('.table tbody tr').length > 0,
  };
  await page.waitForFunction(selectors[name], null, { timeout: 10_000 });
}

try {
  for (const [name, path] of routes) {
    for (const width of viewports) {
      await page.setViewportSize({ width, height: width <= 414 ? 844 : 1000 });
      const response = await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
      if (!response?.ok()) throw new Error(`${path} returned HTTP ${response?.status()}`);
      await waitForRouteContent(page, name);
      const result = await page.evaluate(() => {
        const viewportWidth = window.innerWidth;
        const pageWidth = document.documentElement.scrollWidth;
        const uncontainedOverflow = [...document.body.querySelectorAll('*')]
          .filter((element) => {
            const bounds = element.getBoundingClientRect();
            if (bounds.right <= viewportWidth + 1 || bounds.width === 0) return false;
            let parent = element.parentElement;
            while (parent && parent !== document.body) {
              const style = getComputedStyle(parent);
              if (
                /(auto|scroll|hidden|clip)/.test(style.overflowX) &&
                parent.scrollWidth > parent.clientWidth + 1
              )
                return false;
              parent = parent.parentElement;
            }
            return true;
          })
          .slice(0, 8)
          .map((element) => ({
            element: element.tagName,
            className: String(element.className).slice(0, 70),
            right: Math.round(element.getBoundingClientRect().right),
          }));
        return { viewportWidth, pageWidth, uncontainedOverflow };
      });
      measurements.push({ route: name, ...result });
      if (result.pageWidth > width + 1 || result.uncontainedOverflow.length) {
        throw new Error(`Horizontal overflow at ${name} / ${width}px: ${JSON.stringify(result)}`);
      }
      if (screenshotWidths.has(width)) {
        await page.screenshot({
          path: resolve(artifactDirectory, `${name}-${width}.png`),
          fullPage: true,
        });
      }
    }
  }

  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(`${baseUrl}/`, { waitUntil: 'domcontentloaded' });
  await waitForRouteContent(page, 'dashboard');
  await page.getByRole('button', { name: 'Open navigation' }).click();
  const mobileResourceLink = page
    .locator('#workspace-navigation')
    .getByRole('link', { name: 'Resources' });
  if (!(await mobileResourceLink.isVisible())) {
    throw new Error('Mobile navigation did not open.');
  }
  await mobileResourceLink.click();
  await waitForRouteContent(page, 'resources');
  if (await mobileResourceLink.isVisible()) {
    throw new Error('Mobile navigation did not close after route selection.');
  }

  for (const [path, trigger, dialogTitle] of [
    ['/orders', 'Create order', 'Create manufacturing order'],
    ['/resources', 'Add resource', 'Add resource'],
    ['/production', 'Consumption', 'Record resource consumption'],
  ]) {
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'domcontentloaded' });
    await waitForRouteContent(page, path === '/production' ? 'production' : path.slice(1));
    await page.getByRole('button', { name: trigger }).first().click();
    const dialog = page.locator('.modal').first();
    await dialog.waitFor({ state: 'visible' });
    const bounds = await dialog.boundingBox();
    if (
      !bounds ||
      bounds.x < 0 ||
      bounds.y < 0 ||
      bounds.x + bounds.width > 376 ||
      bounds.y + bounds.height > 812
    ) {
      throw new Error(`Dialog exceeds the viewport on ${path}: ${JSON.stringify(bounds)}`);
    }
    const close = page.getByRole('button', { name: /cancel|close/i }).first();
    await close.click();
    if (dialogTitle && (await page.locator('.modal').count()) !== 0)
      throw new Error(`Dialog did not close on ${path}`);
  }

  if (browserErrors.length) throw new Error(`Browser console errors: ${browserErrors.join(' | ')}`);
  await writeFile(
    resolve(artifactDirectory, 'measurements.json'),
    JSON.stringify(measurements, null, 2),
  );
  console.log(
    JSON.stringify(
      {
        routes: routes.length,
        viewports: viewports.length,
        screenshots: routes.length * screenshotWidths.size,
        measurements,
      },
      null,
      2,
    ),
  );
} catch (error) {
  const body = await page
    .locator('body')
    .innerText()
    .catch(() => '');
  console.error(JSON.stringify({ error: String(error), browserErrors, body }, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
