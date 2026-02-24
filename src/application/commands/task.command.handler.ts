// src/application/commands/task.command.handler.ts
import { TaskRepository } from '../../infrastructure/persistence/repositories/task.repository';
import { TaskAggregate } from '../../core/aggregates/task.aggregate';

export class TaskCommandHandler {
  public eventBus: any;

  constructor(private taskRepository: TaskRepository) {}

 async createTask(command: { title: string; description?: string; userId: string }) {
  const { v4: uuidv4 } = await import('uuid');
  const taskId = uuidv4();
  
  const task = new TaskAggregate(taskId);
  task.create(command.title, command.userId, command.description);
  
  // ПОЛУЧАЕМ события ДО сохранения!
  const events = task.getUncommittedEvents();
  console.log(`📦 Task created, publishing ${events.length} events`);
  
  // Публикуем события в eventBus ДО сохранения в БД
  for (const event of events) {
    if (this.eventBus) {
      console.log(`📤 Publishing to eventBus: ${event.eventType}`);
      await this.eventBus.publish(event);
    }
  }
  
  // Сохраняем в EventStore после публикации
  await this.taskRepository.save(task);
  
  return {
    id: taskId,
    ...task.getState()
  };
}

 async updateTask(command: { taskId: string; updates: any; userId: string }) {
  const task = await this.taskRepository.findById(command.taskId);
  if (!task) throw new Error('Task not found');

  task.update(command.updates, command.userId);
  
  // Получаем события ДО сохранения
  const events = task.getUncommittedEvents();
  console.log(`📦 Task updated, publishing ${events.length} events`);
  
  for (const event of events) {
    if (this.eventBus) {
      await this.eventBus.publish(event);
    }
  }
  
  await this.taskRepository.save(task);
  return task.getState();
}

async completeTask(command: { taskId: string; userId: string }) {
  const task = await this.taskRepository.findById(command.taskId);
  if (!task) throw new Error('Task not found');

  task.complete(command.userId);
  
  const events = task.getUncommittedEvents();
  console.log(`📦 Task completed, publishing ${events.length} events`);
  
  for (const event of events) {
    if (this.eventBus) {
      await this.eventBus.publish(event);
    }
  }
  
  await this.taskRepository.save(task);
  return task.getState();
}
  async reopenTask(command: { taskId: string; userId: string }) {
    const task = await this.taskRepository.findById(command.taskId);
    
    if (!task) {
      throw new Error('Task not found');
    }

    task.reopen(command.userId);
    await this.taskRepository.save(task);
    
    // Публикуем события
    const events = task.getUncommittedEvents();
    for (const event of events) {
      if (this.eventBus) {
        await this.eventBus.publish(event);
      }
    }
    
    return task.getState();
  }

  async deleteTask(command: { taskId: string; userId: string; reason?: string }) {
    const task = await this.taskRepository.findById(command.taskId);
    
    if (!task) {
      throw new Error('Task not found');
    }

    task.delete(command.userId, command.reason);
    await this.taskRepository.save(task);
    
    // Публикуем события
    const events = task.getUncommittedEvents();
    for (const event of events) {
      if (this.eventBus) {
        await this.eventBus.publish(event);
      }
    }
    
    return { success: true };
  }
}