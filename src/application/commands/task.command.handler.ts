// src/application/commands/task.command.handler.ts
import { TaskRepository } from '../../infrastructure/persistence/repositories/task.repository';
import { TaskAggregate } from '../../core/aggregates/task.aggregate';
import { PriorityEventQueue, EventToQueue } from '../../infrastructure/messaging/event.queue';

export class TaskCommandHandler {
  constructor(
    private taskRepository: TaskRepository,
    private eventQueue: PriorityEventQueue
  ) {}

  /**
   * Создание новой задачи
   * Генерирует событие TaskCreated и отправляет в очередь
   */
  async createTask(command: { title: string; description?: string; userId: string }) {
    console.log('📝 Creating new task...');
    
    const { v4: uuidv4 } = await import('uuid');
    const taskId = uuidv4();
    
    // Создаем агрегат и применяем команду
    const task = new TaskAggregate(taskId);
    task.create(command.title, command.userId, command.description);
    
    // Получаем непримененные события
    const events = task.getUncommittedEvents();
    console.log(`📦 Generated ${events.length} events`);
    
    // Отправляем события в очередь ДО сохранения в БД
    for (const event of events) {
      const { v4: uuidv4 } = await import('uuid');
      const eventToQueue: EventToQueue = {
        id: uuidv4(),
        type: event.eventType,
        aggregateId: taskId,
        data: event.data
      };
      this.eventQueue.push(eventToQueue);
    }
    
    // Сохраняем агрегат в Event Store
    await this.taskRepository.save(task);
    console.log(`💾 Task saved to Event Store: ${taskId}`);
    
    return {
      id: taskId,
      ...task.getState()
    };
  }

  /**
   * Обновление существующей задачи
   * Генерирует событие TaskUpdated и отправляет в очередь
   */
  async updateTask(command: { 
    taskId: string; 
    updates: { title?: string; description?: string };
    userId: string 
  }) {
    console.log(`📝 Updating task: ${command.taskId}`);
    
    const task = await this.taskRepository.findById(command.taskId);
    
    if (!task) {
      throw new Error('Task not found');
    }

    task.update(command.updates, command.userId);
    
    const events = task.getUncommittedEvents();
    
    for (const event of events) {
      const { v4: uuidv4 } = await import('uuid');
      const eventToQueue: EventToQueue = {
        id: uuidv4(),
        type: event.eventType,
        aggregateId: command.taskId,
        data: event.data
      };
      this.eventQueue.push(eventToQueue);
    }
    
    await this.taskRepository.save(task);
    
    return task.getState();
  }

  /**
   * Завершение задачи
   * Генерирует событие TaskCompleted и отправляет в очередь
   */
  async completeTask(command: { taskId: string; userId: string }) {
    console.log(`📝 Completing task: ${command.taskId}`);
    
    const task = await this.taskRepository.findById(command.taskId);
    
    if (!task) {
      throw new Error('Task not found');
    }

    task.complete(command.userId);
    
    const events = task.getUncommittedEvents();
    
    for (const event of events) {
      const { v4: uuidv4 } = await import('uuid');
      const eventToQueue: EventToQueue = {
        id: uuidv4(),
        type: event.eventType,
        aggregateId: command.taskId,
        data: event.data
      };
      this.eventQueue.push(eventToQueue);
    }
    
    await this.taskRepository.save(task);
    
    return task.getState();
  }

  /**
   * Переоткрытие завершенной задачи
   * Генерирует событие TaskReopened и отправляет в очередь
   */
  async reopenTask(command: { taskId: string; userId: string }) {
    console.log(`📝 Reopening task: ${command.taskId}`);
    
    const task = await this.taskRepository.findById(command.taskId);
    
    if (!task) {
      throw new Error('Task not found');
    }

    task.reopen(command.userId);
    
    const events = task.getUncommittedEvents();
    
    for (const event of events) {
      const { v4: uuidv4 } = await import('uuid');
      const eventToQueue: EventToQueue = {
        id: uuidv4(),
        type: event.eventType,
        aggregateId: command.taskId,
        data: event.data
      };
      this.eventQueue.push(eventToQueue);
    }
    
    await this.taskRepository.save(task);
    
    return task.getState();
  }

  /**
   * Удаление задачи (soft delete)
   * Генерирует событие TaskDeleted и отправляет в очередь
   */
  async deleteTask(command: { taskId: string; userId: string; reason?: string }) {
    console.log(`📝 Deleting task: ${command.taskId}`);
    
    const task = await this.taskRepository.findById(command.taskId);
    
    if (!task) {
      throw new Error('Task not found');
    }

    task.delete(command.userId, command.reason);
    
    const events = task.getUncommittedEvents();
    
    for (const event of events) {
      const { v4: uuidv4 } = await import('uuid');
      const eventToQueue: EventToQueue = {
        id: uuidv4(),
        type: event.eventType,
        aggregateId: command.taskId,
        data: event.data
      };
      this.eventQueue.push(eventToQueue);
    }
    
    await this.taskRepository.save(task);
    
    return { success: true, taskId: command.taskId };
  }

  /**
   * Массовое создание задач (для тестирования)
   */
  async createBulkTasks(count: number, userId: string): Promise<string[]> {
    console.log(`📝 Creating ${count} tasks in bulk...`);
    
    const taskIds: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const { v4: uuidv4 } = await import('uuid');
      const taskId = uuidv4();
      
      const task = new TaskAggregate(taskId);
      task.create(`Bulk Task ${i + 1}`, userId, `Description for task ${i + 1}`);
      
      const events = task.getUncommittedEvents();
      
      for (const event of events) {
        const { v4: uuidv4 } = await import('uuid');
        const eventToQueue: EventToQueue = {
          id: uuidv4(),
          type: event.eventType,
          aggregateId: taskId,
          data: event.data
        };
        this.eventQueue.push(eventToQueue);
      }
      
      await this.taskRepository.save(task);
      taskIds.push(taskId);
      
      if (i % 10 === 0) {
        console.log(`   Created ${i} tasks...`);
      }
    }
    
    console.log(`✅ Created ${count} tasks`);
    return taskIds;
  }

  /**
   * Получение статистики по командам
   */
  getStats() {
    return {
      commandHandler: 'TaskCommandHandler',
      queueType: this.eventQueue.constructor.name,
      queueStats: this.eventQueue.getStats ? this.eventQueue.getStats() : { total: this.eventQueue.size() },
      timestamp: new Date().toISOString()
    };
  }
}