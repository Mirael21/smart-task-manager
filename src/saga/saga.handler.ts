// src/saga/saga.handler.ts
import { EventHandler } from '../event-loop/event.processor';
import { QueuedEvent } from '../infrastructure/messaging/event.queue';
import { SagaOrchestrator } from './saga.orchestrator';

export class SagaHandler implements EventHandler {
  constructor(private orchestrator: SagaOrchestrator) {}

  async handle(event: QueuedEvent): Promise<void> {
    console.log(`🎭 SagaHandler processing: ${event.type}`);

    switch (event.type) {
      case 'TaskCompleted':
        // При завершении задачи запускаем сагу
        await this.orchestrator.start('TaskCompletion', {
          taskId: event.aggregateId,
          userId: event.data.userId,
          completedAt: event.data.completedAt
        });
        console.log(`🎭 Saga started for completed task: ${event.aggregateId}`);
        break;

      default:
        // Игнорируем другие события
        break;
    }
  }
}