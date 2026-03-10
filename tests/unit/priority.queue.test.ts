import { PriorityEventQueue, EventToQueue } from '../../src/infrastructure/messaging/event.queue';

describe('PriorityEventQueue', () => {
  let queue: PriorityEventQueue;

  beforeEach(() => {
    queue = new PriorityEventQueue();
  });

  it('should process high priority events before normal and low', () => {
    // Создаем события с разными приоритетами
    const events: EventToQueue[] = [
      { id: '1', type: 'TaskUpdated', aggregateId: '1', data: {} },    // low
      { id: '2', type: 'TaskCompleted', aggregateId: '2', data: {} },  // high
      { id: '3', type: 'TaskCreated', aggregateId: '3', data: {} },    // normal
      { id: '4', type: 'TaskDeleted', aggregateId: '4', data: {} },    // high
      { id: '5', type: 'TaskUpdated', aggregateId: '5', data: {} },    // low
    ];

    // Добавляем в очередь
    events.forEach(e => queue.push(e));

    // Проверяем порядок извлечения
    const processed: string[] = [];
    let event;
    while ((event = queue.pop()) !== null) {
      processed.push(event.type);
    }

    // HIGH приоритеты должны быть первыми (TaskCompleted, TaskDeleted)
    // Затем NORMAL (TaskCreated)
    // Затем LOW (TaskUpdated)
    expect(processed).toEqual([
      'TaskCompleted', // high
      'TaskDeleted',   // high
      'TaskCreated',   // normal
      'TaskUpdated',   // low
      'TaskUpdated'    // low
    ]);
  });

  it('should maintain order within same priority level', () => {
    // Создаем 10 задач с одинаковым приоритетом (normal)
    for (let i = 1; i <= 10; i++) {
      queue.push({
        id: `${i}`,
        type: 'TaskCreated',
        aggregateId: `${i}`,
        data: { index: i }
      });
    }

    // Извлекаем и проверяем порядок
    for (let i = 1; i <= 10; i++) {
      const event = queue.pop();
      expect(event?.aggregateId).toBe(`${i}`);
    }
  });

  it('should mix priorities correctly - complex test', () => {
    // Создаем 30 задач с рандомными приоритетами
    const expectedOrder: string[] = [];
    const highEvents: string[] = [];
    const normalEvents: string[] = [];
    const lowEvents: string[] = [];

    for (let i = 1; i <= 30; i++) {
      // Рандомный приоритет, но с контролируемым распределением
      const rand = Math.random();
      let type: string;
      let priorityGroup: string[];

      if (rand < 0.2) { // 20% high
        type = 'TaskCompleted';
        priorityGroup = highEvents;
      } else if (rand < 0.5) { // 30% low
        type = 'TaskUpdated';
        priorityGroup = lowEvents;
      } else { // 50% normal
        type = 'TaskCreated';
        priorityGroup = normalEvents;
      }

      queue.push({
        id: `${i}`,
        type,
        aggregateId: `${i}`,
        data: { index: i }
      });

      priorityGroup.push(type);
    }

    // Ожидаемый порядок: все high, потом все normal, потом все low
    expectedOrder.push(...highEvents, ...normalEvents, ...lowEvents);

    // Извлекаем из очереди
    const processed: string[] = [];
    let event;
    while ((event = queue.pop()) !== null) {
      processed.push(event.type);
    }

    // Проверяем, что порядок соответствует expectedOrder
    expect(processed).toEqual(expectedOrder);
  });

  it('should handle requeue with priority decay', () => {
    // Создаем high priority событие
    queue.push({
      id: '1',
      type: 'TaskCompleted',
      aggregateId: '1',
      data: {}
    });

    const event = queue.pop();
    expect(event?.priority).toBe('high');

    // Имитируем ошибку - возвращаем в очередь
    if (event) {
      queue.requeue(event);
      
      const requeuedEvent = queue.pop();
      expect(requeuedEvent?.priority).toBe('normal'); // Приоритет понизился
      expect(requeuedEvent?.retryCount).toBe(1);
    }
  });

  it('should not requeue after max retries', () => {
    // Создаем событие
    queue.push({
      id: '1',
      type: 'TaskCompleted',
      aggregateId: '1',
      data: {}
    });

    // Пытаемся обработать 4 раза (максимум 3)
    for (let i = 0; i < 4; i++) {
      const event = queue.pop();
      if (event) {
        if (event.retryCount >= event.maxRetries) {
          // Не должны рекьюить
          console.log(`Event failed after ${event.maxRetries} retries`);
        } else {
          queue.requeue(event);
        }
      }
    }

    // Очередь должна быть пустой
    expect(queue.size()).toBe(0);
  });

  it('should handle bulk operations with mixed priorities', () => {
    const stats = {
      high: 0,
      normal: 0,
      low: 0
    };

    // Создаем 100 случайных событий
    for (let i = 0; i < 100; i++) {
      const rand = Math.random();
      let type: string;
      
      if (rand < 0.2) {
        type = 'TaskCompleted'; // high
        stats.high++;
      } else if (rand < 0.5) {
        type = 'TaskUpdated'; // low
        stats.low++;
      } else {
        type = 'TaskCreated'; // normal
        stats.normal++;
      }

      queue.push({
        id: `${i}`,
        type,
        aggregateId: `${i}`,
        data: {}
      });
    }

    // Проверяем статистику очереди
    const queueStats = queue.getStats();
    expect(queueStats.high).toBe(stats.high);
    expect(queueStats.normal).toBe(stats.normal);
    expect(queueStats.low).toBe(stats.low);
    expect(queueStats.total).toBe(100);

    // Извлекаем и проверяем порядок
    let lastPriority: 'high' | 'normal' | 'low' = 'high';
    let event;
    let highCount = 0, normalCount = 0, lowCount = 0;

    while ((event = queue.pop()) !== null) {
      // Проверяем, что порядок соблюдается
      if (event.priority === 'high') {
        highCount++;
      } else if (event.priority === 'normal') {
        normalCount++;
        // После появления normal, не должно быть high
        expect(highCount).toBe(stats.high);
      } else {
        lowCount++;
        // После появления low, не должно быть high или normal
        expect(highCount).toBe(stats.high);
        expect(normalCount).toBe(stats.normal);
      }
    }

    // Проверяем, что все события обработаны
    expect(highCount).toBe(stats.high);
    expect(normalCount).toBe(stats.normal);
    expect(lowCount).toBe(stats.low);
  });
});