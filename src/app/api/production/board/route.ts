import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/server/errors';
import { isStepEligible } from '@/server/services/domain';
export async function GET() {
  try {
    const steps = await prisma.productionStep.findMany({
      orderBy: { sequence: 'asc' },
      include: {
        orderSteps: {
          include: {
            order: {
              include: {
                steps: {
                  include: { productionStep: true },
                  orderBy: { productionStep: { sequence: 'asc' } },
                },
              },
            },
          },
          orderBy: { order: { dueDate: 'asc' } },
        },
      },
    });
    return Response.json({
      data: steps.map((step) => ({
        id: step.id,
        code: step.code,
        name: step.name,
        sequence: step.sequence,
        readyToStart: step.orderSteps
          .filter(
            (s) =>
              s.status === 'PENDING' &&
              isStepEligible(
                step.sequence,
                s.order.steps.map((item) => item.status),
              ),
          )
          .map((s) => ({ ...s.order, orderStepId: s.id })),
        inProgress: step.orderSteps
          .filter((s) => s.status === 'IN_PROGRESS')
          .map((s) => ({ ...s.order, orderStepId: s.id })),
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
