import { prisma } from '@/lib/prisma';
import { errorResponse, notFound } from '@/server/errors';
import { orderStatus, productionProgress } from '@/server/services/domain';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        steps: {
          include: {
            productionStep: true,
            consumptions: {
              include: { resource: true },
              orderBy: { recordedAt: 'asc' },
            },
          },
          orderBy: { productionStep: { sequence: 'asc' } },
        },
        events: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!order) throw notFound('Order not found.');
    return Response.json({
      data: {
        ...order,
        status: orderStatus(order.steps.map((s) => s.status)),
        progress: productionProgress(order.steps.map((s) => s.status)),
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
