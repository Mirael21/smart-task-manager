// src/core/events/task.events.ts
import { BaseEvent } from './base.event';

export class TaskCreated extends BaseEvent {
  constructor(
    aggregateId: string,
    data: { title: string; description?: string; userId: string },
    metadata?: any
  ) {
    super(aggregateId, 'Task', 'TaskCreated', data, metadata);
  }
}

export class TaskUpdated extends BaseEvent {
  constructor(
    aggregateId: string,
    data: { title?: string; description?: string },
    metadata?: any
  ) {
    super(aggregateId, 'Task', 'TaskUpdated', data, metadata);
  }
}

export class TaskCompleted extends BaseEvent {
  constructor(
    aggregateId: string,
    data: { completedAt: Date; userId: string },
    metadata?: any
  ) {
    super(aggregateId, 'Task', 'TaskCompleted', data, metadata);
  }
}

export class TaskDeleted extends BaseEvent {
  constructor(
    aggregateId: string,
    data: { userId: string; reason?: string },
    metadata?: any
  ) {
    super(aggregateId, 'Task', 'TaskDeleted', data, metadata);
  }
}

export class TaskReopened extends BaseEvent {
  constructor(
    aggregateId: string,
    data: { userId: string },
    metadata?: any
  ) {
    super(aggregateId, 'Task', 'TaskReopened', data, metadata);
  }
}