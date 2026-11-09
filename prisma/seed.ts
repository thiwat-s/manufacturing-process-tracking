import { PrismaClient, Prisma, ResourceCategory, StepStatus } from '@prisma/client';
const prisma = new PrismaClient();
const stepRows = [
  ['MATERIAL_PREPARATION', 'Material Preparation'],
  ['MANUFACTURING', 'Manufacturing'],
  ['POST_PROCESSING', 'Post-processing'],
  ['QUALITY_INSPECTION', 'Quality Inspection'],
  ['LABELLING_PACKAGING', 'Labelling & Packaging'],
] as const;
const resources = [
  ['Titanium Powder', 'MATERIAL', 'kg'],
  ['Medical-grade Resin', 'MATERIAL', 'kg'],
  ['Ceramic Insert', 'MATERIAL', 'pcs'],
  ['Packaging Sleeve', 'MATERIAL', 'pcs'],
  ['Laser Sintering Printer', 'MACHINE_TIME', 'hour'],
  ['CNC Mill', 'MACHINE_TIME', 'min'],
  ['Finishing Station', 'MACHINE_TIME', 'min'],
  ['Production Technician', 'LABOUR_TIME', 'hour'],
  ['Quality Inspector', 'LABOUR_TIME', 'min'],
  ['Packaging Operator', 'LABOUR_TIME', 'min'],
] as const;
const products = [
  'Precision valve housing',
  'Instrument guide',
  'Sensor mounting bracket',
  'Fluid connector body',
  'Optical alignment sleeve',
  'Micro-pump enclosure',
  'Calibration fixture',
  'Actuator support plate',
];
async function main() {
  for (let i = 0; i < stepRows.length; i++) {
    const [code, name] = stepRows[i];
    await prisma.productionStep.upsert({
      where: { code },
      update: { name, sequence: i + 1 },
      create: { code, name, sequence: i + 1 },
    });
  }
  for (const [i, [name, category, unit]] of resources.entries()) {
    const id = `10000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`;
    await prisma.resource.upsert({
      where: { id },
      update: {},
      create: { id, name, category: category as ResourceCategory, unit },
    });
  }
  const master = await prisma.productionStep.findMany({
    orderBy: { sequence: 'asc' },
  });
  if (
    master.length !== stepRows.length ||
    master.some((step, index) => step.sequence !== index + 1)
  ) {
    throw new Error('The database must contain exactly five production steps in sequence order.');
  }
  const year = new Date().getFullYear();
  for (let n = 1; n <= products.length; n++) {
    const orderId = `20000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    const orderNumber = `MO-${year}-${String(n).padStart(4, '0')}`;
    const createdAt = new Date(Date.now() - (products.length - n + 3) * 86400000);
    const completedCount = n <= 2 ? 0 : n <= 4 ? 0 : n <= 6 ? 1 : 5;
    const activeIndex = n >= 3 && n <= 4 ? 0 : n >= 5 && n <= 6 ? 1 : -1;
    const order = await prisma.order.upsert({
      where: { id: orderId },
      update: {},
      create: {
        id: orderId,
        orderNumber,
        productName: products[n - 1],
        quantity: 4 + n,
        dueDate: new Date(Date.now() + (n - 5) * 86400000),
        notes: n === 1 ? 'Sample work order for the demonstration environment.' : null,
        createdAt,
      },
    });
    const existingSteps = await prisma.orderStep.findMany({
      where: { orderId },
      include: { productionStep: { select: { sequence: true } } },
    });
    const existingStepsByProductionStep = new Map(
      existingSteps.map((step) => [step.productionStepId, step]),
    );
    const activeSequence = existingSteps.find((step) => step.status === 'IN_PROGRESS')
      ?.productionStep.sequence;
    const highestCompletedSequence = Math.max(
      0,
      ...existingSteps
        .filter((step) => step.status === 'COMPLETED')
        .map((step) => step.productionStep.sequence),
    );
    const expectedSteps = master.map((productionStep, index) => {
      const stepId = `30000000-0000-4000-8000-${String(n * 10 + index + 1).padStart(12, '0')}`;
      const existingStep = existingStepsByProductionStep.get(productionStep.id);
      const sampleStatus: StepStatus =
        index < completedCount ? 'COMPLETED' : index === activeIndex ? 'IN_PROGRESS' : 'PENDING';
      const status: StepStatus = existingStep
        ? existingStep.status
        : existingSteps.length === 0
          ? sampleStatus
          : activeSequence !== undefined
            ? productionStep.sequence < activeSequence
              ? 'COMPLETED'
              : 'PENDING'
            : productionStep.sequence <= highestCompletedSequence
              ? 'COMPLETED'
              : 'PENDING';
      const startedAt =
        existingStep?.startedAt ??
        (status !== 'PENDING' ? new Date(createdAt.getTime() + (index + 1) * 3600000) : null);
      const completedAt =
        existingStep?.completedAt ??
        (status === 'COMPLETED' ? new Date(createdAt.getTime() + (index + 1) * 7200000) : null);
      return {
        index,
        productionStep,
        stepId,
        status,
        startedAt,
        completedAt,
        isNew: !existingStep,
      };
    });
    const savedSteps = await prisma.$transaction(
      expectedSteps.map(({ productionStep, stepId, status, startedAt, completedAt }) =>
        prisma.orderStep.upsert({
          where: {
            orderId_productionStepId: { orderId, productionStepId: productionStep.id },
          },
          update: {},
          create: {
            id: stepId,
            orderId,
            productionStepId: productionStep.id,
            status,
            startedAt,
            completedAt,
          },
        }),
      ),
    );

    for (const { index, status, startedAt, completedAt, isNew } of expectedSteps) {
      if (isNew && status !== 'PENDING') {
        const resourceIndex = (n + index) % resources.length;
        const resourceId = `10000000-0000-4000-8000-${String(resourceIndex + 1).padStart(12, '0')}`;
        const consumptionId = `40000000-0000-4000-8000-${String(n * 10 + index + 1).padStart(12, '0')}`;
        await prisma.resourceConsumption.upsert({
          where: { id: consumptionId },
          update: {},
          create: {
            id: consumptionId,
            orderStepId: savedSteps[index].id,
            resourceId,
            quantity: new Prisma.Decimal(1 + (n % 4)),
            resourceNameSnapshot: resources[resourceIndex][0],
            resourceCategorySnapshot: resources[resourceIndex][1] as ResourceCategory,
            unitSnapshot: resources[resourceIndex][2],
            recordedAt: startedAt!,
          },
        });
        const startedEventId = `50000000-0000-4000-8000-${String(n * 10 + index + 1).padStart(12, '0')}`;
        await prisma.productionEvent.upsert({
          where: { id: startedEventId },
          update: {},
          create: {
            id: startedEventId,
            orderId,
            orderStepId: savedSteps[index].id,
            eventType: 'STEP_STARTED',
            description: `${master[index].name} started for ${order.orderNumber}.`,
            createdAt: startedAt!,
          },
        });
        const consumptionEventId = `60000000-0000-4000-8000-${String(n * 10 + index + 1).padStart(12, '0')}`;
        await prisma.productionEvent.upsert({
          where: { id: consumptionEventId },
          update: {},
          create: {
            id: consumptionEventId,
            orderId,
            orderStepId: savedSteps[index].id,
            eventType: 'CONSUMPTION_RECORDED',
            description: `${1 + (n % 4)} ${resources[resourceIndex][2]} of ${resources[resourceIndex][0]} recorded for ${master[index].name}.`,
            metadata: {
              resourceId,
              resourceName: resources[resourceIndex][0],
              quantity: 1 + (n % 4),
              unit: resources[resourceIndex][2],
            },
            createdAt: startedAt!,
          },
        });
        if (status === 'COMPLETED') {
          const completedEventId = `70000000-0000-4000-8000-${String(n * 10 + index + 1).padStart(12, '0')}`;
          await prisma.productionEvent.upsert({
            where: { id: completedEventId },
            update: {},
            create: {
              id: completedEventId,
              orderId,
              orderStepId: savedSteps[index].id,
              eventType: 'STEP_COMPLETED',
              description: `${master[index].name} completed for ${order.orderNumber}.`,
              createdAt: completedAt!,
            },
          });
        }
      }
    }
    const orderEventId = `80000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    await prisma.productionEvent.upsert({
      where: { id: orderEventId },
      update: {},
      create: {
        id: orderEventId,
        orderId,
        eventType: 'ORDER_CREATED',
        description: `Manufacturing order ${order.orderNumber} created.`,
        metadata: {
          orderNumber,
          productName: products[n - 1],
          quantity: 4 + n,
        },
        createdAt,
      },
    });
  }
  await prisma.$executeRaw`INSERT INTO order_number_counters (year,value) VALUES (${year},${products.length}) ON CONFLICT (year) DO UPDATE SET value=GREATEST(order_number_counters.value,EXCLUDED.value)`;
  console.log('Seeded workflow, 10 resources, 8 orders and traceable production history.');
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
