import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/server/errors';
import { recordConsumption } from '@/server/services/production';
import { consumptionInput } from '@/server/validations';
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; stepId: string }> },
) {
  try {
    const { id, stepId } = await context.params;
    return Response.json(
      {
        data: await recordConsumption(id, stepId, consumptionInput.parse(await request.json())),
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; stepId: string }> },
) {
  try {
    const { stepId } = await context.params;
    const data = await prisma.resourceConsumption.findMany({
      where: { orderStepId: stepId },
      include: { resource: true },
      orderBy: { recordedAt: 'asc' },
    });
    return Response.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}
