import { Prisma, ProductionEventType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { AppError, conflict, notFound } from '@/server/errors';
import { formatOrderNumber } from '@/server/services/domain';

const event = (
  orderId: string,
  eventType: ProductionEventType,
  description: string,
  orderStepId?: string,
  metadata: Prisma.InputJsonValue = {},
) => ({ orderId, orderStepId, eventType, description, metadata });

export async function createOrder(input: {
  productName: string;
  quantity: number;
  dueDate?: string;
  notes?: string;
}) {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const year = new Date().getFullYear();
        const rows = await tx.$queryRaw<
          { value: number }[]
        >`INSERT INTO order_number_counters (year, value) VALUES (${year}, 1) ON CONFLICT (year) DO UPDATE SET value = order_number_counters.value + 1 RETURNING value`;
        const orderNumber = formatOrderNumber(year, rows[0].value);
        const order = await tx.order.create({
          data: {
            orderNumber,
            productName: input.productName,
            quantity: input.quantity,
            dueDate: input.dueDate ? new Date(`${input.dueDate}T00:00:00.000Z`) : null,
            notes: input.notes || null,
          },
        });
        const master = await tx.productionStep.findMany({
          orderBy: { sequence: 'asc' },
        });
        if (master.length !== 5)
          throw new AppError(
            'WORKFLOW_NOT_INITIALIZED',
            'Production workflow is not configured.',
            500,
          );
        await tx.orderStep.createMany({
          data: master.map((step) => ({
            orderId: order.id,
            productionStepId: step.id,
          })),
        });
        await tx.productionEvent.create({
          data: event(
            order.id,
            'ORDER_CREATED',
            `Manufacturing order ${orderNumber} created.`,
            undefined,
            {
              orderNumber,
              productName: order.productName,
              quantity: order.quantity,
            },
          ),
        });
        return { ...order, status: 'PENDING', steps: master.length };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw error;
  }
}

export async function startStep(orderId: string, stepId: string) {
  return prisma.$transaction(
    async (tx) => {
      const step = await tx.orderStep.findFirst({
        where: { id: stepId, orderId },
        include: { productionStep: true, order: true },
      });
      if (!step) throw notFound('Order step not found.');
      if (step.status !== 'PENDING')
        throw conflict('INVALID_STEP_TRANSITION', 'This step has already started or completed.');
      const prior = await tx.orderStep.findFirst({
        where: {
          orderId,
          productionStep: { sequence: { lt: step.productionStep.sequence } },
          status: { not: 'COMPLETED' },
        },
      });
      if (prior)
        throw conflict('PREVIOUS_STEP_INCOMPLETE', 'Previous production step is not completed.');
      const updated = await tx.orderStep.updateMany({
        where: { id: stepId, status: 'PENDING' },
        data: { status: 'IN_PROGRESS', startedAt: new Date() },
      });
      if (updated.count !== 1)
        throw conflict('INVALID_STEP_TRANSITION', 'This step cannot be started.');
      await tx.productionEvent.create({
        data: event(
          orderId,
          'STEP_STARTED',
          `${step.productionStep.name} started for ${step.order.orderNumber}.`,
          stepId,
        ),
      });
      return tx.orderStep.findUniqueOrThrow({
        where: { id: stepId },
        include: { productionStep: true },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function recordConsumption(
  orderId: string,
  stepId: string,
  input: { resourceId: string; quantity: number; notes?: string },
) {
  return prisma.$transaction(
    async (tx) => {
      const step = await tx.orderStep.findFirst({
        where: { id: stepId, orderId },
        include: { order: true, productionStep: true },
      });
      if (!step) throw notFound('Order step not found.');
      if (step.status !== 'IN_PROGRESS')
        throw conflict(
          'STEP_NOT_IN_PROGRESS',
          'Consumption can only be recorded for an in-progress step.',
        );
      const resource = await tx.resource.findUnique({
        where: { id: input.resourceId },
      });
      if (!resource) throw notFound('Resource not found.');
      if (!resource.isActive)
        throw conflict('RESOURCE_INACTIVE', 'Inactive resources cannot be used.');
      const consumption = await tx.resourceConsumption.create({
        data: {
          orderStepId: stepId,
          resourceId: resource.id,
          quantity: new Prisma.Decimal(input.quantity),
          resourceNameSnapshot: resource.name,
          resourceCategorySnapshot: resource.category,
          unitSnapshot: resource.unit,
          notes: input.notes || null,
        },
      });
      await tx.productionEvent.create({
        data: event(
          orderId,
          'CONSUMPTION_RECORDED',
          `${input.quantity} ${resource.unit} of ${resource.name} recorded for ${step.productionStep.name}.`,
          stepId,
          {
            resourceId: resource.id,
            resourceName: resource.name,
            resourceCategory: resource.category,
            quantity: input.quantity,
            unit: resource.unit,
          },
        ),
      });
      return consumption;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

export async function completeStep(orderId: string, stepId: string) {
  return prisma.$transaction(
    async (tx) => {
      const step = await tx.orderStep.findFirst({
        where: { id: stepId, orderId },
        include: { order: true, productionStep: true },
      });
      if (!step) throw notFound('Order step not found.');
      if (step.status !== 'IN_PROGRESS')
        throw conflict('INVALID_STEP_TRANSITION', 'Only an in-progress step can be completed.');
      if (
        !(await tx.resourceConsumption.count({
          where: { orderStepId: stepId },
        }))
      )
        throw conflict(
          'CONSUMPTION_REQUIRED',
          'Record at least one resource consumption before completing this step.',
        );
      const result = await tx.orderStep.updateMany({
        where: { id: stepId, status: 'IN_PROGRESS' },
        data: { status: 'COMPLETED', completedAt: new Date() },
      });
      if (result.count !== 1)
        throw conflict('INVALID_STEP_TRANSITION', 'This step cannot be completed.');
      await tx.productionEvent.create({
        data: event(
          orderId,
          'STEP_COMPLETED',
          `${step.productionStep.name} completed for ${step.order.orderNumber}.`,
          stepId,
        ),
      });
      return tx.orderStep.findUniqueOrThrow({
        where: { id: stepId },
        include: { productionStep: true },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}
