// src/saga/saga.interface.ts
export interface SagaContext {
  sagaId: string;
  [key: string]: any;
}

// Создаем тип для начального контекста (без sagaId)
export type SagaInitialContext = Omit<SagaContext, 'sagaId'>;

export interface SagaStep {
  name: string;
  execute: (context: SagaContext) => Promise<void>;
  compensate?: (context: SagaContext) => Promise<void>;
}

export interface Saga {
  readonly name: string;
  readonly steps: SagaStep[];
  
  execute(context: SagaContext): Promise<void>;
  compensate(context: SagaContext): Promise<void>;
}

export interface SagaState {
  id: string;
  name: string;
  status: 'pending' | 'executing' | 'completed' | 'failed' | 'compensating' | 'compensated';
  context: Record<string, any>;
  currentStep: number;
  stepsCompleted: string[];
  stepsFailed?: string;
  createdAt: Date;
  updatedAt: Date;
  error?: string;
}