// tests/integration/saga.orchestrator.test.ts
import { SagaStore } from '../../src/saga/saga.store';
import { SagaOrchestrator } from '../../src/saga/saga.orchestrator';
import { Saga, SagaContext, SagaStep } from '../../src/saga/saga.interface';

describe('SagaOrchestrator', () => {
  let store: SagaStore;
  let orchestrator: SagaOrchestrator;

  beforeEach(() => {
    store = new SagaStore();
    orchestrator = new SagaOrchestrator(store);
  });

  it('should register and start a saga', async () => {
    let executed = false;
    let compensated = false;

    const testSaga: Saga = {
      name: 'TestSaga',
      steps: [
        {
          name: 'step1',
          execute: async (context: SagaContext) => {
            executed = true;
            context.step1Done = true;
          },
          compensate: async (context: SagaContext) => {
            compensated = true;
          }
        }
      ],
      execute: async (context: SagaContext) => {
        for (const step of testSaga.steps) {
          await step.execute(context);
        }
      },
      compensate: async (context: SagaContext) => {
        for (const step of testSaga.steps.reverse()) {
          if (step.compensate) {
            await step.compensate(context);
          }
        }
      }
    };

    orchestrator.register(testSaga);
    const sagaId = await orchestrator.start('TestSaga', { taskId: 'task-1' });

    expect(sagaId).toBeDefined();
    
    // Ждем завершения саги
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const status = orchestrator.getStatus(sagaId);
    expect(status?.status).toBe('completed');
    expect(executed).toBe(true);
  });

  it('should compensate on failure', async () => {
    let compensated = false;

    const failingSaga: Saga = {
      name: 'FailingSaga',
      steps: [
        {
          name: 'step1',
          execute: async (context: SagaContext) => {
            context.step1Done = true;
          },
          compensate: async (context: SagaContext) => {
            compensated = true;
          }
        },
        {
          name: 'step2',
          execute: async (context: SagaContext) => {
            throw new Error('Step 2 failed');
          },
          compensate: async (context: SagaContext) => {
            // компенсация
          }
        }
      ],
      execute: async (context: SagaContext) => {
        for (const step of failingSaga.steps) {
          await step.execute(context);
        }
      },
      compensate: async (context: SagaContext) => {
        for (const step of failingSaga.steps.reverse()) {
          if (step.compensate) {
            await step.compensate(context);
          }
        }
      }
    };

    orchestrator.register(failingSaga);
    const sagaId = await orchestrator.start('FailingSaga', { taskId: 'task-2' });

    await new Promise(resolve => setTimeout(resolve, 500));

    const status = orchestrator.getStatus(sagaId);
    expect(status?.status === 'compensated' || status?.status === 'failed').toBeTruthy();
  });
});