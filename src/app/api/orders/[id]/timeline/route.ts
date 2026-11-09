import { prisma } from '@/lib/prisma';
import { errorResponse, notFound } from '@/server/errors';
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    if (!(await prisma.order.findUnique({ where: { id }, select: { id: true } })))
      throw notFound('Order not found.');
    const data = await prisma.productionEvent.findMany({
      where: { orderId: id },
      include: { orderStep: { include: { productionStep: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return Response.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}
