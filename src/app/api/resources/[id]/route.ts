import { prisma } from '@/lib/prisma';
import { errorResponse, notFound } from '@/server/errors';
import { resourceInput } from '@/server/validations';
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const input = resourceInput.partial().parse(await request.json());
    if (
      !(await prisma.resource.findUnique({
        where: { id },
        select: { id: true },
      }))
    )
      throw notFound('Resource not found.');
    const data = await prisma.resource.update({ where: { id }, data: input });
    return Response.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}
