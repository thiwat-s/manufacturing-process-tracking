export type StepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
export type ResourceCategory = 'MATERIAL' | 'MACHINE_TIME' | 'LABOUR_TIME';

export interface ResourceRecord {
  id: string;
  name: string;
  category: ResourceCategory;
  unit: string;
  isActive: boolean;
  createdAt: string;
}

export interface ConsumptionRecord {
  id: string;
  orderStepId: string;
  resourceId: string;
  quantity: string | number;
  resourceNameSnapshot: string;
  resourceCategorySnapshot: ResourceCategory;
  unitSnapshot: string;
  notes: string | null;
  recordedAt: string;
  resource: ResourceRecord;
}

export interface ConsumptionHistoryRecord extends ConsumptionRecord {
  orderStep: {
    order: { orderNumber: string };
    productionStep: { name: string };
  };
}

export interface OrderStepRecord {
  id: string;
  status: StepStatus;
  startedAt: string | null;
  completedAt: string | null;
  productionStep: { id: string; name: string; sequence: number };
  consumptions: ConsumptionRecord[];
}

export interface ProductionEventRecord {
  id: string;
  eventType?: string;
  description: string;
  createdAt: string;
  orderId?: string;
  order?: { orderNumber: string };
  orderStep?: { productionStep: { name: string } } | null;
}

export interface OrderRecord {
  id: string;
  orderNumber: string;
  productName: string;
  quantity: number;
  dueDate: string | null;
  createdAt: string;
  notes?: string | null;
  status: string;
  progress?: number;
  steps: OrderStepRecord[];
  events?: ProductionEventRecord[];
}

export interface OrderDetailRecord extends OrderRecord {
  progress: number;
  events: ProductionEventRecord[];
}

export interface BoardOrder extends OrderRecord {
  orderStepId: string;
}
