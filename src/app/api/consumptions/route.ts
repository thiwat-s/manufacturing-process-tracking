import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/server/errors';
export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams;
    const orderStepFilters = [
      ...(p.get('orderId') ? [{ orderId: p.get('orderId')! }] : []),
      ...(p.get('stepId') ? [{ productionStepId: p.get('stepId')! }] : []),
    ];
    const data = await prisma.resourceConsumption.findMany({
      where: {
        ...(orderStepFilters.length ? { orderStep: { is: { AND: orderStepFilters } } } : {}),
        ...(p.get('resourceId') ? { resourceId: p.get('resourceId')! } : {}),
        ...(p.get('category')
          ? {
              resourceCategorySnapshot: p.get('category') as
                'MATERIAL' | 'MACHINE_TIME' | 'LABOUR_TIME',
            }
          : {}),
        ...(p.get('from') || p.get('to')
          ? {
              recordedAt: {
                ...(p.get('from') ? { gte: new Date(p.get('from')!) } : {}),
                ...(p.get('to') ? { lte: new Date(p.get('to')!) } : {}),
              },
            }
          : {}),
      },
      include: {
        resource: true,
        orderStep: { include: { order: true, productionStep: true } },
      },
      orderBy: { recordedAt: 'desc' },
      take: 250,
    });
    return Response.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}
