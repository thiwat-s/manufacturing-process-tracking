import { z } from 'zod';
export const orderInput = z.object({
  productName: z.string().trim().min(1).max(160),
  quantity: z.coerce.number().int().positive().max(2147483647),
  dueDate: z.string().date().optional().or(z.literal('')),
  notes: z.string().max(2000).optional(),
});
export const consumptionInput = z.object({
  resourceId: z.string().uuid(),
  quantity: z.coerce
    .number()
    .positive()
    .max(9999999999.9999)
    .refine(
      (value) => Number(value.toFixed(4)) === value,
      'Quantity supports up to four decimal places.',
    ),
  notes: z.string().max(500).optional(),
});
export const resourceInput = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.enum(['MATERIAL', 'MACHINE_TIME', 'LABOUR_TIME']),
  unit: z.string().trim().min(1).max(24),
  isActive: z.boolean().optional(),
});
