// src/core/aggregates/task.aggregate.ts
import { 
  TaskCreated, 
  TaskUpdated, 
  TaskCompleted, 
  TaskDeleted,
  TaskReopened 
} from '../events/task.events';

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'deleted';

export interface TaskState {
  id: string;
  title: string;
  description?: string;
  status: TaskStatus;
  createdAt: Date;
  createdBy: string;
  completedAt?: Date;
  updatedAt?: Date;
  version: number;
}

export class TaskAggregate {
  private state: TaskState | null = null;
  private uncommittedEvents: any[] = [];
  private currentVersion: number = 0;

  constructor(private id: string) {}

  // Восстановление из событий
  loadFromHistory(events: any[]): void {
  console.log(`📚 Loading ${events.length} events into aggregate`);
  
  for (const event of events) {
    console.log(`   Applying ${event.eventType} (version ${event.version})`);
    this.apply(event, false);
    this.currentVersion = event.version;
  }
  
  console.log(`   Current state:`, this.state);
}

  // Создание задачи
  create(title: string, userId: string, description?: string): void {
    if (this.state) {
      throw new Error('Task already exists');
    }

    const event = new TaskCreated(
      this.id,
      { title, description, userId },
      { userId }
    );
    event.version = this.currentVersion + 1;

    this.apply(event, true);
  }

  // Обновление задачи
  update(updates: { title?: string; description?: string }, userId: string): void {
    this.ensureExists();
    this.ensureNotDeleted();

    const event = new TaskUpdated(
      this.id,
      updates,
      { userId }
    );
    event.version = this.currentVersion + 1;

    this.apply(event, true);
  }

  // Завершение задачи
  complete(userId: string): void {
  console.log('=== COMPLETE METHOD ===');
  console.log('Current state:', this.state);
  console.log('Current version:', this.currentVersion);
  
  this.ensureExists();
  this.ensureNotDeleted();

  if (this.state!.status === 'done') {
    throw new Error('Task already completed');
  }

  const event = new TaskCompleted(
    this.id,
    { completedAt: new Date(), userId },
    { userId }
  );
  event.version = this.currentVersion + 1;

  this.apply(event, true);
}

  // Переоткрытие задачи
  reopen(userId: string): void {
    this.ensureExists();
    this.ensureNotDeleted();

    if (this.state!.status !== 'done') {
      throw new Error('Can only reopen completed tasks');
    }

    const event = new TaskReopened(
      this.id,
      { userId },
      { userId }
    );
    event.version = this.currentVersion + 1;

    this.apply(event, true);
  }

  // Удаление задачи
  delete(userId: string, reason?: string): void {
    this.ensureExists();
    this.ensureNotDeleted();

    const event = new TaskDeleted(
      this.id,
      { userId, reason },
      { userId }
    );
    event.version = this.currentVersion + 1;

    this.apply(event, true);
  }

  // Применение события
  private apply(event: any, isNew: boolean): void {
  console.log(`🔄 Applying ${event.eventType}, isNew: ${isNew}`);
  
  switch (event.eventType) {
    case 'TaskCreated':
      console.log('   Creating new task state with data:', event.data);
      this.state = {
        id: this.id,
        title: event.data.title,
        description: event.data.description,
        status: 'todo',
        createdAt: event.timestamp,
        createdBy: event.data.userId,
        version: event.version
      };
      console.log('   State after create:', this.state);
      break;
      
    case 'TaskUpdated':
      if (this.state) {
        this.state.title = event.data.title ?? this.state.title;
        this.state.description = event.data.description ?? this.state.description;
        this.state.updatedAt = event.timestamp;
        this.state.version = event.version;
      }
      break;
      
    case 'TaskCompleted':
      if (this.state) {
        this.state.status = 'done';
        this.state.completedAt = event.data.completedAt;
        this.state.updatedAt = event.timestamp;
        this.state.version = event.version;
      }
      break;
      
    case 'TaskReopened':
      if (this.state) {
        this.state.status = 'todo';
        this.state.completedAt = undefined;
        this.state.updatedAt = event.timestamp;
        this.state.version = event.version;
      }
      break;
      
    case 'TaskDeleted':
      if (this.state) {
        this.state.status = 'deleted';
        this.state.updatedAt = event.timestamp;
        this.state.version = event.version;
      }
      break;
      
    default:
      console.log(`   Unknown event type: ${event.eventType}`);
  }
  
  if (isNew) {
    this.uncommittedEvents.push(event);
    this.currentVersion = event.version;
  }
}

  // Геттеры
  getState(): TaskState | null {
    return this.state ? { ...this.state } : null;
  }

  getUncommittedEvents(): any[] {
    return [...this.uncommittedEvents];
  }

  markEventsAsCommitted(): void {
    this.uncommittedEvents = [];
  }

  // Приватные методы валидации
  private ensureExists(): void {
    if (!this.state) {
      throw new Error('Task not found');
    }
  }

  private ensureNotDeleted(): void {
    if (this.state?.status === 'deleted') {
      throw new Error('Task is deleted');
    }
  }

  // Получение текущей версии
  getVersion(): number {
    return this.currentVersion;
  }
}