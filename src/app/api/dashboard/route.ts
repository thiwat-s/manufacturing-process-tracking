import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/server/errors';
import { formatConsumptionGroups, isStepEligible, orderStatus } from '@/server/services/domain';
export async function GET() {
  try {
    const [orders, steps, consumptionGroups, events] = await Promise.all([
      prisma.order.findMany({
        select: {
          id: true,
          steps: {
            select: { status: true, productionStep: { select: { sequence: true } } },
            orderBy: { productionStep: { sequence: 'asc' } },
          },
        },
      }),
      prisma.productionStep.findMany({
        select: {
          id: true,
          name: true,
          sequence: true,
          orderSteps: { select: { orderId: true, status: true } },
        },
        orderBy: { sequence: 'asc' },
      }),
      prisma.resourceConsumption.groupBy({
        by: ['resourceId', 'resourceNameSnapshot', 'resourceCategorySnapshot', 'unitSnapshot'],
        _sum: { quantity: true },
        orderBy: [{ resourceNameSnapshot: 'asc' }, { resourceId: 'asc' }, { unitSnapshot: 'asc' }],
      }),
      prisma.productionEvent.findMany({
        include: {
          order: true,
          orderStep: { include: { productionStep: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
    ]);
    const statusesByOrder = new Map(
      orders.map((order) => [order.id, order.steps.map((step) => step.status)]),
    );
    const statuses = [...statusesByOrder.values()].map(orderStatus);
    return Response.json({
      data: {
        totalOrders: orders.length,
        pendingOrders: statuses.filter((s) => s === 'PENDING').length,
        inProgressOrders: statuses.filter((s) => s === 'IN_PROGRESS').length,
        completedOrders: statuses.filter((s) => s === 'COMPLETED').length,
        stepOverview: steps.map((s) => ({
          id: s.id,
          name: s.name,
          readyToStart: s.orderSteps.filter(
            (step) =>
              step.status === 'PENDING' &&
              isStepEligible(s.sequence, statusesByOrder.get(step.orderId) ?? []),
          ).length,
          inProgress: s.orderSteps.filter((x) => x.status === 'IN_PROGRESS').length,
          completed: s.orderSteps.filter((x) => x.status === 'COMPLETED').length,
        })),
        resourceConsumption: formatConsumptionGroups(consumptionGroups),
        recentEvents: events,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
