import type { Prisma, ResourceCategory, StepStatus } from '@prisma/client';
export function orderStatus(statuses: StepStatus[]) {
  if (statuses.length === 5 && statuses.every((status) => status === 'COMPLETED'))
    return 'COMPLETED';
  if (statuses.length === 5 && statuses.every((status) => status === 'PENDING')) return 'PENDING';
  return 'IN_PROGRESS';
}
export function productionProgress(statuses: StepStatus[]) {
  return Math.round((statuses.filter((status) => status === 'COMPLETED').length / 5) * 100);
}
export function isStepEligible(sequence: number, statuses: StepStatus[]) {
  if (statuses.length !== 5 || !Number.isInteger(sequence) || sequence < 1 || sequence > 5)
    return false;
  return (
    statuses[sequence - 1] === 'PENDING' &&
    statuses.slice(0, sequence - 1).every((status) => status === 'COMPLETED')
  );
}
export function formatOrderNumber(year: number, value: number) {
  return `MO-${year}-${String(value).padStart(4, '0')}`;
}

export function orderStatusWhere(status: string | null): Prisma.OrderWhereInput {
  if (status === 'PENDING') return { steps: { some: {}, every: { status: 'PENDING' } } };
  if (status === 'COMPLETED') return { steps: { some: {}, every: { status: 'COMPLETED' } } };
  if (status === 'IN_PROGRESS') {
    return {
      AND: [
        { steps: { some: { status: { not: 'PENDING' } } } },
        { steps: { some: { status: { not: 'COMPLETED' } } } },
      ],
    };
  }
  return status ? { id: { in: [] } } : {};
}

export function formatConsumptionGroups<
  T extends {
    resourceId: string;
    resourceNameSnapshot: string;
    resourceCategorySnapshot: ResourceCategory;
    unitSnapshot: string;
    _sum: { quantity: { toString(): string } | null };
  },
>(groups: T[]) {
  return groups.map((group) => ({
    resourceId: group.resourceId,
    name: group.resourceNameSnapshot,
    category: group.resourceCategorySnapshot,
    unit: group.unitSnapshot,
    quantity: Number(group._sum.quantity ?? 0),
  }));
}
