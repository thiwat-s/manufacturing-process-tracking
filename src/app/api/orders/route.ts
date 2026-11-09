import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError, errorResponse } from '@/server/errors';
import { createOrder } from '@/server/services/production';
import { orderStatus, orderStatusWhere } from '@/server/services/domain';
import { orderInput } from '@/server/validations';

function positiveInteger(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const search = params.get('search')?.trim();
    const pageSize = Math.min(100, positiveInteger(params.get('pageSize'), 10));
    const page = positiveInteger(params.get('page'), 1);
    const dueBeforeValue = params.get('dueBefore');
    const dueBefore = dueBeforeValue ? new Date(`${dueBeforeValue}T23:59:59.999Z`) : undefined;
    if (
      dueBeforeValue &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(dueBeforeValue) ||
        !dueBefore ||
        Number.isNaN(dueBefore.getTime()) ||
        dueBefore.toISOString().slice(0, 10) !== dueBeforeValue)
    ) {
      throw new AppError(
        'VALIDATION_ERROR',
        'dueBefore must be a valid date in YYYY-MM-DD format.',
      );
    }
    const sort = params.get('sort') === 'dueDate' ? 'dueDate' : 'createdAt';
    const direction = params.get('direction') === 'asc' ? 'asc' : 'desc';
    const where: Prisma.OrderWhereInput = {
      AND: [
        orderStatusWhere(params.get('status')),
        search
          ? {
              OR: [
                { orderNumber: { contains: search, mode: 'insensitive' } },
                { productName: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {},
        dueBefore ? { dueDate: { lte: dueBefore } } : {},
      ],
    };
    const [total, rows] = await prisma.$transaction([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          steps: {
            include: { productionStep: true },
            orderBy: { productionStep: { sequence: 'asc' } },
          },
        },
        orderBy: [{ [sort]: direction }, { id: direction }],
      }),
    ]);
    const data = rows.map((order) => ({
      ...order,
      status: orderStatus(order.steps.map((step) => step.status)),
    }));
    return Response.json({
      data,
      pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = orderInput.parse(await request.json());
    return Response.json({ data: await createOrder(input) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
