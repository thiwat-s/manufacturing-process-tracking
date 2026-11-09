import { expect, type APIRequestContext, test } from '@playwright/test';

async function createOrder(request: APIRequestContext, productName: string) {
  const response = await request.post('/api/orders', { data: { productName, quantity: 2 } });
  expect(response.status()).toBe(201);
  return (await response.json()).data as { id: string; orderNumber: string };
}

async function expectDashboardBoardReadinessToMatch(request: APIRequestContext) {
  const [dashboardResponse, boardResponse] = await Promise.all([
    request.get('/api/dashboard'),
    request.get('/api/production/board'),
  ]);
  expect(dashboardResponse.ok()).toBeTruthy();
  expect(boardResponse.ok()).toBeTruthy();
  const dashboard = (await dashboardResponse.json()).data;
  const board = (await boardResponse.json()).data;
  expect(dashboard.stepOverview.map((step: { readyToStart: number }) => step.readyToStart)).toEqual(
    board.map((step: { readyToStart: unknown[] }) => step.readyToStart.length),
  );
  return { dashboard, board };
}

test('creates, filters, and completes an order through all five steps', async ({
  page,
  request,
}) => {
  const stamp = Date.now();
  const order = await createOrder(request, `E2E fixture ${stamp}`);
  const secondMatchingOrder = await createOrder(request, `E2E fixture ${stamp} second`);
  expect(order.orderNumber).toMatch(/^MO-\d{4}-\d{4,}$/);

  const details = await request.get(`/api/orders/${order.id}`);
  const detail = (await details.json()).data;
  expect(detail.steps).toHaveLength(5);

  const pendingPage = await request.get(
    `/api/orders?search=${encodeURIComponent(`E2E fixture ${stamp}`)}&status=PENDING&page=1&pageSize=1`,
  );
  const pendingResult = await pendingPage.json();
  expect(pendingPage.ok()).toBeTruthy();
  expect(pendingResult.pagination).toMatchObject({ page: 1, pageSize: 1, total: 2, pages: 2 });
  const secondPage = await request.get(
    `/api/orders?search=${encodeURIComponent(`E2E fixture ${stamp}`)}&status=PENDING&page=2&pageSize=1`,
  );
  const pageIds = [pendingResult.data[0].id, (await secondPage.json()).data[0].id];
  expect(new Set(pageIds)).toEqual(new Set([order.id, secondMatchingOrder.id]));

  const resourceResponse = await request.post('/api/resources', {
    data: { name: `E2E resin ${stamp}`, category: 'MATERIAL', unit: 'g' },
  });
  expect(resourceResponse.status()).toBe(201);
  const resource = (await resourceResponse.json()).data;

  const initialState = await expectDashboardBoardReadinessToMatch(request);
  expect(
    initialState.board[0].readyToStart.some((item: { id: string }) => item.id === order.id),
  ).toBe(true);
  expect(
    initialState.board
      .slice(1)
      .every((step: { readyToStart: { id: string }[] }) =>
        step.readyToStart.every((item) => item.id !== order.id),
      ),
  ).toBe(true);

  for (const [index, step] of detail.steps.entries()) {
    const started = await request.post(`/api/orders/${order.id}/steps/${step.id}/start`);
    expect(started.ok(), `start step ${step.productionStep.sequence}`).toBeTruthy();
    const consumed = await request.post(`/api/orders/${order.id}/steps/${step.id}/consumptions`, {
      data: { resourceId: resource.id, quantity: 1 },
    });
    expect(consumed.ok()).toBeTruthy();
    const completed = await request.post(`/api/orders/${order.id}/steps/${step.id}/complete`);
    expect(completed.ok()).toBeTruthy();

    const state = await expectDashboardBoardReadinessToMatch(request);
    if (index < detail.steps.length - 1) {
      expect(
        state.board[index + 1].readyToStart.some((item: { id: string }) => item.id === order.id),
      ).toBe(true);
    }
  }

  const final = await request.get(`/api/orders/${order.id}`);
  const finalOrder = (await final.json()).data;
  expect(finalOrder.status).toBe('COMPLETED');
  const restartCompletedStep = await request.post(
    `/api/orders/${order.id}/steps/${detail.steps[0].id}/start`,
  );
  expect(restartCompletedStep.status()).toBe(409);
  const timeline = (await (await request.get(`/api/orders/${order.id}/timeline`)).json()).data;
  expect(
    timeline.filter((event: { eventType: string }) => event.eventType === 'STEP_STARTED'),
  ).toHaveLength(5);
  expect(
    timeline.filter((event: { eventType: string }) => event.eventType === 'CONSUMPTION_RECORDED'),
  ).toHaveLength(5);
  expect(
    timeline.filter((event: { eventType: string }) => event.eventType === 'STEP_COMPLETED'),
  ).toHaveLength(5);
  const completedPage = await request.get(
    `/api/orders?search=${encodeURIComponent(`E2E fixture ${stamp}`)}&status=COMPLETED&page=1&pageSize=1`,
  );
  expect((await completedPage.json()).pagination.total).toBe(1);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await page.goto(`/orders/${order.id}`);
  await expect(page.getByText('Production timeline')).toBeVisible();
  await expect(page.getByText('Resource consumption by step')).toBeVisible();
  await expect(page.getByText('COMPLETED').first()).toBeVisible();
});

test('rejects invalid and duplicate workflow transitions and invalid consumption', async ({
  request,
}) => {
  const order = await createOrder(request, `E2E transition checks ${Date.now()}`);
  const detail = (await (await request.get(`/api/orders/${order.id}`)).json()).data;
  const [first, second] = detail.steps;

  const blockedStart = await request.post(`/api/orders/${order.id}/steps/${second.id}/start`);
  expect(blockedStart.status()).toBe(409);
  expect((await blockedStart.json()).error.code).toBe('PREVIOUS_STEP_INCOMPLETE');

  const completePending = await request.post(`/api/orders/${order.id}/steps/${first.id}/complete`);
  expect(completePending.status()).toBe(409);

  const resourceResponse = await request.post('/api/resources', {
    data: { name: `E2E inactive ${Date.now()}`, category: 'MATERIAL', unit: 'kg' },
  });
  const resource = (await resourceResponse.json()).data;
  const [startOne, startTwo] = await Promise.all([
    request.post(`/api/orders/${order.id}/steps/${first.id}/start`),
    request.post(`/api/orders/${order.id}/steps/${first.id}/start`),
  ]);
  expect([startOne.status(), startTwo.status()].sort()).toEqual([200, 409]);

  const duplicateStart = await request.post(`/api/orders/${order.id}/steps/${first.id}/start`);
  expect(duplicateStart.status()).toBe(409);
  const completeWithoutConsumption = await request.post(
    `/api/orders/${order.id}/steps/${first.id}/complete`,
  );
  expect(completeWithoutConsumption.status()).toBe(409);

  const invalidQuantity = await request.post(
    `/api/orders/${order.id}/steps/${first.id}/consumptions`,
    { data: { resourceId: resource.id, quantity: -1 } },
  );
  expect(invalidQuantity.status()).toBe(400);

  const deactivated = await request.patch(`/api/resources/${resource.id}`, {
    data: { isActive: false },
  });
  expect(deactivated.ok()).toBeTruthy();
  const inactiveResource = await request.post(
    `/api/orders/${order.id}/steps/${first.id}/consumptions`,
    { data: { resourceId: resource.id, quantity: 1 } },
  );
  expect(inactiveResource.status()).toBe(409);
  expect((await inactiveResource.json()).error.code).toBe('RESOURCE_INACTIVE');

  await request.patch(`/api/resources/${resource.id}`, { data: { isActive: true } });
  const recorded = await request.post(`/api/orders/${order.id}/steps/${first.id}/consumptions`, {
    data: { resourceId: resource.id, quantity: 1 },
  });
  expect(recorded.status()).toBe(201);
  const completed = await request.post(`/api/orders/${order.id}/steps/${first.id}/complete`);
  expect(completed.ok()).toBeTruthy();
  const duplicateCompletion = await request.post(
    `/api/orders/${order.id}/steps/${first.id}/complete`,
  );
  expect(duplicateCompletion.status()).toBe(409);
  expect((await request.post(`/api/orders/${order.id}/steps/${second.id}/start`)).ok()).toBe(true);
});

test('keeps duplicate resource names and historical resource snapshots distinct', async ({
  request,
}) => {
  const stamp = Date.now();
  const name = `E2E shared material ${stamp}`;
  const firstOrder = await createOrder(request, `E2E snapshot A ${stamp}`);
  const secondOrder = await createOrder(request, `E2E snapshot B ${stamp}`);
  const createResource = () =>
    request.post('/api/resources', { data: { name, category: 'MATERIAL', unit: 'kg' } });
  const [firstResourceResponse, secondResourceResponse] = await Promise.all([
    createResource(),
    createResource(),
  ]);
  const firstResource = (await firstResourceResponse.json()).data;
  const secondResource = (await secondResourceResponse.json()).data;
  expect(firstResource.id).not.toBe(secondResource.id);

  const firstSteps = (await (await request.get(`/api/orders/${firstOrder.id}`)).json()).data.steps;
  const secondSteps = (await (await request.get(`/api/orders/${secondOrder.id}`)).json()).data
    .steps;
  expect(
    (await request.post(`/api/orders/${firstOrder.id}/steps/${firstSteps[0].id}/start`)).ok(),
  ).toBe(true);
  expect(
    (await request.post(`/api/orders/${secondOrder.id}/steps/${secondSteps[0].id}/start`)).ok(),
  ).toBe(true);
  for (const quantity of [1.25, 0.75]) {
    expect(
      (
        await request.post(`/api/orders/${firstOrder.id}/steps/${firstSteps[0].id}/consumptions`, {
          data: { resourceId: firstResource.id, quantity },
        })
      ).status(),
    ).toBe(201);
  }
  expect(
    (
      await request.post(`/api/orders/${secondOrder.id}/steps/${secondSteps[0].id}/consumptions`, {
        data: { resourceId: secondResource.id, quantity: 3 },
      })
    ).status(),
  ).toBe(201);
  expect(
    (await request.post(`/api/orders/${firstOrder.id}/steps/${firstSteps[0].id}/complete`)).ok(),
  ).toBe(true);
  const boardAndDashboard = await expectDashboardBoardReadinessToMatch(request);
  expect(
    boardAndDashboard.board[1].readyToStart.some(
      (item: { id: string }) => item.id === firstOrder.id,
    ),
  ).toBe(true);
  expect(
    (await request.post(`/api/orders/${firstOrder.id}/steps/${firstSteps[1].id}/start`)).ok(),
  ).toBe(true);
  expect(
    (
      await request.post(`/api/orders/${firstOrder.id}/steps/${firstSteps[1].id}/consumptions`, {
        data: { resourceId: firstResource.id, quantity: 2 },
      })
    ).status(),
  ).toBe(201);

  const renamed = await request.patch(`/api/resources/${firstResource.id}`, {
    data: { name: `Renamed ${name}`, category: 'LABOUR_TIME', unit: 'hour', isActive: false },
  });
  expect(renamed.ok()).toBeTruthy();

  const historicRowsResponse = await request.get(
    `/api/consumptions?resourceId=${firstResource.id}&category=MATERIAL`,
  );
  const historicRows = (await historicRowsResponse.json()).data;
  expect(historicRows).toHaveLength(3);
  expect(
    historicRows.every(
      (row: { resourceNameSnapshot: string }) => row.resourceNameSnapshot === name,
    ),
  ).toBe(true);
  expect(
    historicRows.every(
      (row: { resourceCategorySnapshot: string; unitSnapshot: string }) =>
        row.resourceCategorySnapshot === 'MATERIAL' && row.unitSnapshot === 'kg',
    ),
  ).toBe(true);
  const scopedHistory = await request.get(
    `/api/consumptions?resourceId=${firstResource.id}&category=MATERIAL&orderId=${firstOrder.id}&stepId=${firstSteps[0].productionStep.id}`,
  );
  expect((await scopedHistory.json()).data).toHaveLength(2);

  const currentState = await expectDashboardBoardReadinessToMatch(request);
  const duplicateNameGroups = currentState.dashboard.resourceConsumption.filter(
    (row: { name: string }) => row.name === name,
  );
  expect(duplicateNameGroups).toHaveLength(2);
  expect(
    Object.fromEntries(
      duplicateNameGroups.map((row: { resourceId: string; quantity: number }) => [
        row.resourceId,
        row.quantity,
      ]),
    ),
  ).toEqual({ [firstResource.id]: 4, [secondResource.id]: 3 });

  const finalDetail = (await (await request.get(`/api/orders/${firstOrder.id}`)).json()).data;
  expect(finalDetail.steps[0].consumptions[0]).toMatchObject({
    resourceNameSnapshot: name,
    resourceCategorySnapshot: 'MATERIAL',
    unitSnapshot: 'kg',
  });
});
