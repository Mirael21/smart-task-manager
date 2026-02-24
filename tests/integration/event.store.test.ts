// tests/integration/event.store.test.ts
import { Pool } from 'pg';
import { EventStore, DomainEvent } from '../../src/infrastructure/persistence/event.store';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

describe('EventStore', () => {
  let container: StartedPostgreSqlContainer;
  let pool: Pool;
  let eventStore: EventStore;

  beforeAll(async () => {
    // Запускаем PostgreSQL контейнер для тестов - Указываем образ!
    container = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('testdb')
      .withUsername('test')
      .withPassword('test')
      .start();

    pool = new Pool({
      host: container.getHost(),
      port: container.getPort(),
      database: container.getDatabase(),
      user: container.getUsername(),
      password: container.getPassword()
    });

    // Создаём таблицу
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id BIGSERIAL PRIMARY KEY,
        aggregate_id VARCHAR(255) NOT NULL,
        aggregate_type VARCHAR(100) NOT NULL,
        event_type VARCHAR(100) NOT NULL,
        event_data JSONB NOT NULL,
        version INT NOT NULL,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        metadata JSONB,
        UNIQUE(aggregate_id, version)
      )
    `);

    eventStore = new EventStore(pool);
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  afterEach(async () => {
    // Очищаем таблицу после каждого теста
    await pool.query('DELETE FROM events');
  });

  it('should save and retrieve events', async () => {
    const aggregateId = 'task-123';
    const events: DomainEvent[] = [
      {
        aggregateId,
        aggregateType: 'Task',
        eventType: 'TaskCreated',
        data: { title: 'Test Task' },
        version: 1,
        metadata: { userId: 'user-1' }
      }
    ];

    await eventStore.saveEvents(aggregateId, events, 0);

    const retrieved = await eventStore.getEvents(aggregateId);
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].eventType).toBe('TaskCreated');
    expect(retrieved[0].data.title).toBe('Test Task');
  });

  it('should handle concurrency conflicts', async () => {
    const aggregateId = 'task-456';
    
    const events1: DomainEvent[] = [
      {
        aggregateId,
        aggregateType: 'Task',
        eventType: 'TaskCreated',
        data: { title: 'Test' },
        version: 1,
        metadata: {}
      }
    ];

    await eventStore.saveEvents(aggregateId, events1, 0);

    const events2: DomainEvent[] = [
      {
        aggregateId,
        aggregateType: 'Task',
        eventType: 'TaskUpdated',
        data: { title: 'Updated' },
        version: 2,
        metadata: {}
      }
    ];

    // Пытаемся сохранить с неправильной версией
    await expect(
      eventStore.saveEvents(aggregateId, events2, 0)
    ).rejects.toThrow('Concurrency conflict');
  });

  it('should save multiple events in order', async () => {
    const aggregateId = 'task-789';
    
    const events: DomainEvent[] = [
      {
        aggregateId,
        aggregateType: 'Task',
        eventType: 'TaskCreated',
        data: { title: 'Test' },
        version: 1,
        metadata: {}
      },
      {
        aggregateId,
        aggregateType: 'Task',
        eventType: 'TaskUpdated',
        data: { title: 'Updated' },
        version: 2,
        metadata: {}
      },
      {
        aggregateId,
        aggregateType: 'Task',
        eventType: 'TaskCompleted',
        data: { completedAt: new Date() },
        version: 3,
        metadata: {}
      }
    ];

    await eventStore.saveEvents(aggregateId, events, 0);

    const retrieved = await eventStore.getEvents(aggregateId);
    expect(retrieved).toHaveLength(3);
    expect(retrieved[0].eventType).toBe('TaskCreated');
    expect(retrieved[1].eventType).toBe('TaskUpdated');
    expect(retrieved[2].eventType).toBe('TaskCompleted');
    expect(retrieved[0].version).toBe(1);
    expect(retrieved[1].version).toBe(2);
    expect(retrieved[2].version).toBe(3);
  });

  it('should get all events by aggregate type', async () => {
    // События для разных агрегатов
    await eventStore.saveEvents('task-1', [{
      aggregateId: 'task-1',
      aggregateType: 'Task',
      eventType: 'TaskCreated',
      data: { title: 'Task 1' },
      version: 1,
      metadata: {}
    }], 0);

    await eventStore.saveEvents('task-2', [{
      aggregateId: 'task-2',
      aggregateType: 'Task',
      eventType: 'TaskCreated',
      data: { title: 'Task 2' },
      version: 1,
      metadata: {}
    }], 0);

    await eventStore.saveEvents('user-1', [{
      aggregateId: 'user-1',
      aggregateType: 'User',
      eventType: 'UserCreated',
      data: { name: 'User' },
      version: 1,
      metadata: {}
    }], 0);

    const taskEvents = await eventStore.getAllEvents('Task');
    expect(taskEvents).toHaveLength(2);
    expect(taskEvents.every(e => e.aggregateType === 'Task')).toBe(true);

    const allEvents = await eventStore.getAllEvents();
    expect(allEvents).toHaveLength(3);
  });
});