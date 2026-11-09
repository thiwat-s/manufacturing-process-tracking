import { prisma } from '@/lib/prisma';
import { errorResponse } from '@/server/errors';
import { resourceInput } from '@/server/validations';
export async function GET(request: Request) {
  try {
    const p = new URL(request.url).searchParams;
    const search = p.get('search') || undefined;
    const category = p.get('category') || undefined;
    const data = await prisma.resource.findMany({
      where: {
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
        ...(category
          ? {
              category: category as 'MATERIAL' | 'MACHINE_TIME' | 'LABOUR_TIME',
            }
          : {}),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
    return Response.json({ data });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    const input = resourceInput.parse(await request.json());
    const data = await prisma.resource.create({ data: input });
    return Response.json({ data }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
