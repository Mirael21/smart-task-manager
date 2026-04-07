// tests/unit/saga.store.test.ts
import { SagaStore } from '../../src/saga/saga.store';
import { SagaState } from '../../src/saga/saga.interface';

describe('SagaStore', () => {
  let store: SagaStore;

  beforeEach(() => {
    store = new SagaStore();
  });

  it('should save and find saga by id', () => {
    const saga: SagaState = {
      id: 'saga-1',
      name: 'TestSaga',
      status: 'pending',
      context: { taskId: 'task-1' },
      currentStep: 0,
      stepsCompleted: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    store.save(saga);
    const found = store.findById('saga-1');

    expect(found).not.toBeNull();
    expect(found?.id).toBe('saga-1');
    expect(found?.name).toBe('TestSaga');
  });

  it('should update saga status', () => {
    const saga: SagaState = {
      id: 'saga-2',
      name: 'TestSaga',
      status: 'pending',
      context: {},
      currentStep: 0,
      stepsCompleted: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    store.save(saga);
    store.updateStatus('saga-2', 'completed');

    const updated = store.findById('saga-2');
    expect(updated?.status).toBe('completed');
  });

  it('should return null for non-existent saga', () => {
    const found = store.findById('non-existent');
    expect(found).toBeNull();
  });

  it('should get all active sagas', () => {
    const saga1: SagaState = {
      id: 'saga-1',
      name: 'Saga1',
      status: 'pending',
      context: {},
      currentStep: 0,
      stepsCompleted: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const saga2: SagaState = {
      id: 'saga-2',
      name: 'Saga2',
      status: 'completed',
      context: {},
      currentStep: 0,
      stepsCompleted: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    store.save(saga1);
    store.save(saga2);

    const active = store.getActive();
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('saga-1');
  });
});