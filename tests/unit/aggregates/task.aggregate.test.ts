// tests/unit/aggregates/task.aggregate.test.ts
import { TaskAggregate } from '../../../src/core/aggregates/task.aggregate';
import { TaskCreated, TaskCompleted, TaskUpdated } from '../../../src/core/events/task.events';

describe('TaskAggregate', () => {
  const taskId = 'test-task-id';
  const userId = 'test-user';

  describe('create', () => {
    it('should create a new task', () => {
      const task = new TaskAggregate(taskId);
      
      task.create('Test Task', userId, 'Test Description');
      
      const state = task.getState();
      expect(state).not.toBeNull();
      expect(state?.title).toBe('Test Task');
      expect(state?.description).toBe('Test Description');
      expect(state?.status).toBe('todo');
      expect(state?.createdBy).toBe(userId);
      expect(state?.version).toBe(1);
      
      const events = task.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(TaskCreated);
    });

    it('should throw if task already exists', () => {
      const task = new TaskAggregate(taskId);
      task.create('Test Task', userId);
      
      expect(() => {
        task.create('Another Task', userId);
      }).toThrow('Task already exists');
    });
  });

  describe('complete', () => {
    it('should complete an existing task', () => {
      const task = new TaskAggregate(taskId);
      task.create('Test Task', userId);
      
      // Clear events from creation
      task.markEventsAsCommitted();
      
      task.complete(userId);
      
      const state = task.getState();
      expect(state?.status).toBe('done');
      expect(state?.completedAt).toBeDefined();
      expect(state?.version).toBe(2);
      
      const events = task.getUncommittedEvents();
      expect(events).toHaveLength(1);
      expect(events[0]).toBeInstanceOf(TaskCompleted);
    });

    it('should throw if task does not exist', () => {
      const task = new TaskAggregate(taskId);
      
      expect(() => {
        task.complete(userId);
      }).toThrow('Task not found');
    });

    it('should throw if task already completed', () => {
      const task = new TaskAggregate(taskId);
      task.create('Test Task', userId);
      task.complete(userId);
      
      expect(() => {
        task.complete(userId);
      }).toThrow('Task already completed');
    });
  });

  describe('loadFromHistory', () => {
    it('should rebuild state from events', () => {
      const task = new TaskAggregate(taskId);
      
      // Создаём события с правильными версиями
      const createdEvent = new TaskCreated(
        taskId, 
        { title: 'Test Task', userId }, 
        { userId }
      );
      createdEvent.version = 1;
      
      const updatedEvent = new TaskUpdated(
        taskId, 
        { title: 'Updated Task' }, 
        { userId }
      );
      updatedEvent.version = 2;
      
      const completedEvent = new TaskCompleted(
        taskId, 
        { completedAt: new Date(), userId }, 
        { userId }
      );
      completedEvent.version = 3;
      
      const events = [createdEvent, updatedEvent, completedEvent];
      
      task.loadFromHistory(events);
      
      const state = task.getState();
      expect(state?.title).toBe('Updated Task');
      expect(state?.status).toBe('done');
      expect(state?.version).toBe(3);
      
      expect(task.getUncommittedEvents()).toHaveLength(0);
      expect(task.getVersion()).toBe(3);
    });
  });

  describe('reopen', () => {
    it('should reopen a completed task', () => {
      const task = new TaskAggregate(taskId);
      task.create('Test Task', userId);
      task.complete(userId);
      task.markEventsAsCommitted();
      
      task.reopen(userId);
      
      const state = task.getState();
      expect(state?.status).toBe('todo');
      expect(state?.completedAt).toBeUndefined();
      expect(state?.version).toBe(3);
      
      const events = task.getUncommittedEvents();
      expect(events).toHaveLength(1);
    });

    it('should throw if task is not completed', () => {
      const task = new TaskAggregate(taskId);
      task.create('Test Task', userId);
      
      expect(() => {
        task.reopen(userId);
      }).toThrow('Can only reopen completed tasks');
    });
  });

  describe('delete', () => {
    it('should delete a task', () => {
      const task = new TaskAggregate(taskId);
      task.create('Test Task', userId);
      task.markEventsAsCommitted();
      
      task.delete(userId, 'Test reason');
      
      const state = task.getState();
      expect(state?.status).toBe('deleted');
      expect(state?.version).toBe(2);
    });

    it('should throw if task is already deleted', () => {
      const task = new TaskAggregate(taskId);
      task.create('Test Task', userId);
      task.delete(userId);
      
      expect(() => {
        task.delete(userId);
      }).toThrow('Task is deleted');
    });
  });
});