// src/saga/sagas/task.completion.saga.ts
import { Saga, SagaStep, SagaContext } from '../saga.interface';
import { EventStore } from '../../infrastructure/persistence/event.store';
import { PriorityEventQueue, EventToQueue } from '../../infrastructure/messaging/event.queue';
import { v4 as uuidv4 } from 'uuid';

export class TaskCompletionSaga implements Saga {
  public readonly name = 'TaskCompletion';
  public readonly steps: SagaStep[];

  constructor(
    private eventStore: EventStore,
    private eventQueue: PriorityEventQueue
  ) {
    this.steps = [
      {
        name: 'sendNotification',
        execute: this.sendNotification.bind(this),
        compensate: this.undoNotification.bind(this)
      },
      {
        name: 'updateAnalytics',
        execute: this.updateAnalytics.bind(this),
        compensate: this.undoAnalytics.bind(this)
      },
      {
        name: 'createNextTask',
        execute: this.createNextTask.bind(this),
        compensate: this.deleteNextTask.bind(this)
      }
    ];
  }

  async execute(context: SagaContext): Promise<void> {
    console.log(`📋 Executing saga ${this.name} for task ${context.taskId}`);
    
    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      console.log(`   → Step ${i + 1}/${this.steps.length}: ${step.name}`);
      
      try {
        await step.execute(context);
        // Сохраняем информацию о выполнении шага в контексте
        context[`${step.name}Completed`] = true;
      } catch (error) {
        console.error(`   ❌ Step ${step.name} failed:`, error);
        throw error;
      }
    }
  }

  async compensate(context: SagaContext): Promise<void> {
    console.log(`🔄 Compensating saga ${this.name} for task ${context.taskId}`);
    
    // Компенсируем в обратном порядке
    for (let i = this.steps.length - 1; i >= 0; i--) {
      const step = this.steps[i];
      if (step.compensate && context[`${step.name}Completed`]) {
        console.log(`   → Compensating step: ${step.name}`);
        try {
          await step.compensate(context);
        } catch (error) {
          console.error(`   ❌ Compensation failed for ${step.name}:`, error);
        }
      }
    }
  }

  // Шаг 1: Отправить уведомление
  private async sendNotification(context: SagaContext): Promise<void> {
    console.log(`   📧 Sending notification for task ${context.taskId}`);
    // Имитация отправки уведомления
    await new Promise(resolve => setTimeout(resolve, 100));
    context.notificationSent = true;
  }

  private async undoNotification(context: SagaContext): Promise<void> {
    console.log(`   📧 Undoing notification for task ${context.taskId}`);
    // Имитация отката уведомления
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Шаг 2: Обновить аналитику
  private async updateAnalytics(context: SagaContext): Promise<void> {
    console.log(`   📊 Updating analytics for task ${context.taskId}`);
    // Имитация обновления аналитики
    await new Promise(resolve => setTimeout(resolve, 100));
    context.analyticsUpdated = true;
  }

  private async undoAnalytics(context: SagaContext): Promise<void> {
    console.log(`   📊 Undoing analytics update for task ${context.taskId}`);
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  // Шаг 3: Создать следующую задачу
  private async createNextTask(context: SagaContext): Promise<void> {
    console.log(`   ➕ Creating next task for ${context.taskId}`);
    
    const taskId = uuidv4();
    context.nextTaskId = taskId;
    
    // Публикуем событие создания следующей задачи
    const eventToQueue: EventToQueue = {
      id: uuidv4(),
      type: 'TaskCreated',
      aggregateId: taskId,
      data: {
        title: `Next task after ${context.taskId}`,
        userId: context.userId || 'system',
        description: 'Automatically created by saga'
      }
    };
    
    this.eventQueue.push(eventToQueue);
    console.log(`   ✅ Next task created: ${taskId}`);
  }

  private async deleteNextTask(context: SagaContext): Promise<void> {
    if (context.nextTaskId) {
      console.log(`   🗑️ Deleting next task: ${context.nextTaskId}`);
      
      const eventToQueue: EventToQueue = {
        id: uuidv4(),
        type: 'TaskDeleted',
        aggregateId: context.nextTaskId,
        data: {
          userId: context.userId || 'system',
          reason: 'Saga compensation'
        }
      };
      
      this.eventQueue.push(eventToQueue);
    }
  }
}