// tests/unit/commands/task.command.handler.test.ts
import { TaskCommandHandler } from '../../../src/application/commands/task.command.handler';
import { TaskRepository } from '../../../src/infrastructure/persistence/repositories/task.repository';
import { PriorityEventQueue } from '../../../src/infrastructure/messaging/event.queue';

// Моки
jest.mock('../../../src/infrastructure/persistence/repositories/task.repository');
jest.mock('../../../src/infrastructure/messaging/event.queue');

describe('TaskCommandHandler with Event Queue', () => {
  let commandHandler: TaskCommandHandler;
  let mockRepository: jest.Mocked<TaskRepository>;
  let mockQueue: jest.Mocked<PriorityEventQueue>;

  beforeEach(() => {
    mockRepository = {
      findById: jest.fn(),
      save: jest.fn()
    } as any;

    mockQueue = {
      push: jest.fn(),
      pop: jest.fn(),
      size: jest.fn()
    } as any;

    commandHandler = new TaskCommandHandler(mockRepository, mockQueue);
  });

  it('should push event to queue when creating task', async () => {
    const command = {
      title: 'Test Task',
      description: 'Test Description',
      userId: 'user-123'
    };

    mockRepository.save.mockResolvedValue(undefined);

    const result = await commandHandler.createTask(command);

    expect(mockQueue.push).toHaveBeenCalled();
    expect(mockQueue.push.mock.calls[0][0]).toMatchObject({
      type: 'TaskCreated',
      aggregateId: expect.any(String)
    });
    expect(result.title).toBe('Test Task');
  });

  it('should push event to queue when completing task', async () => {
    const mockTask = {
      complete: jest.fn(),
      getUncommittedEvents: jest.fn().mockReturnValue([
        { eventType: 'TaskCompleted', data: { completedAt: new Date() } }
      ]),
      getState: jest.fn().mockReturnValue({ status: 'done' })
    };

    mockRepository.findById.mockResolvedValue(mockTask as any);
    mockRepository.save.mockResolvedValue(undefined);

    const result = await commandHandler.completeTask({
      taskId: 'task-123',
      userId: 'user-123'
    });

    expect(mockQueue.push).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'TaskCompleted'
      })
    );
    expect(mockTask.complete).toHaveBeenCalled();
  });

  it('should handle bulk task creation', async () => {
    mockRepository.save.mockResolvedValue(undefined);

    const taskIds = await commandHandler.createBulkTasks(5, 'user-123');

    expect(taskIds).toHaveLength(5);
    expect(mockQueue.push).toHaveBeenCalledTimes(5); // 5 событий TaskCreated
    expect(mockRepository.save).toHaveBeenCalledTimes(5);
  });

  it('should throw error when task not found for completion', async () => {
    mockRepository.findById.mockResolvedValue(null);

    await expect(commandHandler.completeTask({
      taskId: 'non-existent',
      userId: 'user-123'
    })).rejects.toThrow('Task not found');

    expect(mockQueue.push).not.toHaveBeenCalled();
  });
});