// src/saga/saga.orchestrator.ts
import { Saga, SagaState, SagaContext, SagaInitialContext } from './saga.interface';
import { SagaStore } from './saga.store';
import { v4 as uuidv4 } from 'uuid';

export class SagaOrchestrator {
  private sagas: Map<string, Saga> = new Map();

  constructor(private store: SagaStore) {}

  register(saga: Saga): void {
    this.sagas.set(saga.name, saga);
    console.log(`📝 Saga registered: ${saga.name} (${saga.steps.length} steps)`);
  }

  async start(sagaName: string, initialContext: SagaInitialContext = {}): Promise<string> {
    const saga = this.sagas.get(sagaName);
    if (!saga) {
      throw new Error(`Saga not found: ${sagaName}`);
    }

    const sagaId = uuidv4();
    
    // Создаем полный контекст с sagaId
    const context: SagaContext = {
      sagaId,
      ...initialContext
    };

    const sagaState: SagaState = {
      id: sagaId,
      name: sagaName,
      status: 'pending',
      context: { ...context },
      currentStep: 0,
      stepsCompleted: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.store.save(sagaState);
    console.log(`🚀 Starting saga: ${sagaName} (${sagaId})`);

    // Запускаем асинхронно
    this.executeSaga(sagaId, context).catch(error => {
      console.error(`❌ Saga ${sagaId} failed:`, error);
    });

    return sagaId;
  }

  private async executeSaga(sagaId: string, context: SagaContext): Promise<void> {
    const sagaState = this.store.findById(sagaId);
    if (!sagaState) {
      throw new Error(`Saga not found: ${sagaId}`);
    }

    const saga = this.sagas.get(sagaState.name);
    if (!saga) {
      throw new Error(`Saga type not found: ${sagaState.name}`);
    }

    this.store.updateStatus(sagaId, 'executing');

    try {
      await saga.execute(context);
      this.store.updateStatus(sagaId, 'completed');
      console.log(`✅ Saga ${sagaId} completed successfully`);
    } catch (error) {
      console.error(`❌ Saga ${sagaId} failed at step ${sagaState.currentStep}:`, error);
      this.store.setStepsFailed(sagaId, saga.steps[sagaState.currentStep]?.name || 'unknown');
      await this.compensate(sagaId, saga, context);
    }
  }

  private async compensate(sagaId: string, saga: Saga, context: SagaContext): Promise<void> {
    this.store.updateStatus(sagaId, 'compensating');
    console.log(`🔄 Compensating saga: ${sagaId}`);

    try {
      await saga.compensate(context);
      this.store.updateStatus(sagaId, 'compensated');
      console.log(`✅ Saga ${sagaId} compensated successfully`);
    } catch (compensationError) {
      console.error(`❌ Compensation failed for saga ${sagaId}:`, compensationError);
      this.store.updateStatus(sagaId, 'failed', `Compensation failed: ${compensationError}`);
    }
  }

  async resume(sagaId: string): Promise<void> {
    const sagaState = this.store.findById(sagaId);
    if (!sagaState) {
      throw new Error(`Saga not found: ${sagaId}`);
    }

    if (sagaState.status === 'pending' || sagaState.status === 'executing') {
      console.log(`🔄 Resuming saga: ${sagaId}`);
      const context: SagaContext = {
        sagaId,
        ...sagaState.context
      };
      await this.executeSaga(sagaId, context);
    }
  }

  getStatus(sagaId: string): SagaState | null {
    return this.store.findById(sagaId);
  }

  getActive(): SagaState[] {
    return this.store.getActive();
  }

  async recover(): Promise<void> {
    const active = this.store.getActive();
    console.log(`🔄 Recovering ${active.length} active sagas...`);
    
    for (const saga of active) {
      await this.resume(saga.id);
    }
  }
}