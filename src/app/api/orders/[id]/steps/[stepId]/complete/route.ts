import { errorResponse } from '@/server/errors';
import { completeStep } from '@/server/services/production';
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string; stepId: string }> },
) {
  try {
    const { id, stepId } = await context.params;
    return Response.json({ data: await completeStep(id, stepId) });
  } catch (error) {
    return errorResponse(error);
  }
}
