import { describe, expect, it } from 'vitest';
import {
  formatConsumptionGroups,
  formatOrderNumber,
  isStepEligible,
  orderStatus,
  orderStatusWhere,
  productionProgress,
} from '@/server/services/domain';
import { consumptionInput } from '@/server/validations';
describe('manufacturing domain rules', () => {
  it('derives order status from exactly five steps', () => {
    expect(orderStatus(['PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING'])).toBe('PENDING');
    expect(orderStatus(['COMPLETED', 'IN_PROGRESS', 'PENDING', 'PENDING', 'PENDING'])).toBe(
      'IN_PROGRESS',
    );
    expect(orderStatus(['COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED'])).toBe(
      'COMPLETED',
    );
  });
  it('calculates progress across five steps', () => {
    expect(productionProgress(['COMPLETED', 'COMPLETED', 'PENDING', 'PENDING', 'PENDING'])).toBe(
      40,
    );
  });
  it('makes the first or next step ready only when all preceding steps are complete', () => {
    expect(isStepEligible(1, ['PENDING', 'PENDING', 'PENDING', 'PENDING', 'PENDING'])).toBe(true);
    expect(isStepEligible(2, ['COMPLETED', 'PENDING', 'PENDING', 'PENDING', 'PENDING'])).toBe(true);
    expect(isStepEligible(3, ['COMPLETED', 'COMPLETED', 'PENDING', 'PENDING', 'PENDING'])).toBe(
      true,
    );
    expect(isStepEligible(3, ['PENDING', 'COMPLETED', 'PENDING', 'PENDING', 'PENDING'])).toBe(
      false,
    );
    expect(isStepEligible(3, ['COMPLETED', 'IN_PROGRESS', 'PENDING', 'PENDING', 'PENDING'])).toBe(
      false,
    );
    expect(
      isStepEligible(5, ['COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED', 'COMPLETED']),
    ).toBe(false);
    expect(isStepEligible(2, ['COMPLETED', 'PENDING'])).toBe(false);
  });
  it('formats order numbers with year and padded counter', () => {
    expect(formatOrderNumber(2026, 1)).toBe('MO-2026-0001');
    expect(formatOrderNumber(2026, 42)).toBe('MO-2026-0042');
  });
  it('keeps distinct resources separate when their names and units match', () => {
    const groups = [
      {
        resourceId: 'resource-1',
        resourceNameSnapshot: 'Powder',
        resourceCategorySnapshot: 'MATERIAL' as const,
        unitSnapshot: 'kg',
        _sum: { quantity: { toString: () => '3.5' } },
      },
      {
        resourceId: 'resource-2',
        resourceNameSnapshot: 'Powder',
        resourceCategorySnapshot: 'MATERIAL' as const,
        unitSnapshot: 'kg',
        _sum: { quantity: { toString: () => '4' } },
      },
      {
        resourceId: 'resource-1',
        resourceNameSnapshot: 'Powder',
        resourceCategorySnapshot: 'MATERIAL' as const,
        unitSnapshot: 'g',
        _sum: { quantity: { toString: () => '40' } },
      },
    ];
    expect(formatConsumptionGroups(groups)).toEqual([
      {
        resourceId: 'resource-1',
        name: 'Powder',
        category: 'MATERIAL',
        unit: 'kg',
        quantity: 3.5,
      },
      {
        resourceId: 'resource-2',
        name: 'Powder',
        category: 'MATERIAL',
        unit: 'kg',
        quantity: 4,
      },
      {
        resourceId: 'resource-1',
        name: 'Powder',
        category: 'MATERIAL',
        unit: 'g',
        quantity: 40,
      },
    ]);
  });
  it('builds database filters for derived order statuses', () => {
    expect(orderStatusWhere('PENDING')).toEqual({
      steps: { some: {}, every: { status: 'PENDING' } },
    });
    expect(orderStatusWhere('COMPLETED')).toEqual({
      steps: { some: {}, every: { status: 'COMPLETED' } },
    });
    expect(orderStatusWhere('IN_PROGRESS')).toEqual({
      AND: [
        { steps: { some: { status: { not: 'PENDING' } } } },
        { steps: { some: { status: { not: 'COMPLETED' } } } },
      ],
    });
  });
  it('accepts only positive consumption representable by the database', () => {
    const resourceId = '10000000-0000-4000-8000-000000000001';
    expect(consumptionInput.safeParse({ resourceId, quantity: 0 }).success).toBe(false);
    expect(consumptionInput.safeParse({ resourceId, quantity: -1 }).success).toBe(false);
    expect(consumptionInput.safeParse({ resourceId, quantity: 0.00001 }).success).toBe(false);
    expect(consumptionInput.safeParse({ resourceId, quantity: 1.25 }).success).toBe(true);
  });
});
