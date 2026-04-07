// src/saga/saga.store.ts
import { SagaState } from './saga.interface';

export class SagaStore {
  private sagas: Map<string, SagaState> = new Map();

  save(saga: SagaState): void {
    saga.updatedAt = new Date();
    this.sagas.set(saga.id, { ...saga });
    console.log(`💾 Saga saved: ${saga.id} (${saga.name}: ${saga.status})`);
  }

  findById(id: string): SagaState | null {
    const saga = this.sagas.get(id);
    return saga ? { ...saga } : null;
  }

  updateStatus(id: string, status: SagaState['status'], error?: string): void {
    const saga = this.sagas.get(id);
    if (saga) {
      saga.status = status;
      saga.updatedAt = new Date();
      if (error) saga.error = error;
      this.sagas.set(id, saga);
      console.log(`🔄 Saga ${id} → ${status}${error ? ` (${error})` : ''}`);
    }
  }

  updateStep(id: string, stepIndex: number, stepName: string): void {
    const saga = this.sagas.get(id);
    if (saga) {
      saga.currentStep = stepIndex;
      saga.stepsCompleted.push(stepName);
      saga.updatedAt = new Date();
      this.sagas.set(id, saga);
    }
  }

  setStepsFailed(id: string, stepName: string): void {
    const saga = this.sagas.get(id);
    if (saga) {
      saga.stepsFailed = stepName;
      saga.updatedAt = new Date();
      this.sagas.set(id, saga);
    }
  }

  getAll(): SagaState[] {
    return Array.from(this.sagas.values());
  }

  getActive(): SagaState[] {
    return this.getAll().filter(s => s.status === 'pending' || s.status === 'executing');
  }

  clear(): void {
    this.sagas.clear();
    console.log('🧹 Saga store cleared');
  }
}