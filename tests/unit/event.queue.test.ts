// tests/unit/event.queue.test.ts
import { PriorityEventQueue, EventToQueue } from '../../src/infrastructure/messaging/event.queue';

describe('PriorityEventQueue', () => {
  it('should process high priority first', () => {
    const queue = new PriorityEventQueue();
    
    const event1: EventToQueue = { id: '1', type: 'TaskUpdated', aggregateId: '1', data: {} };
    const event2: EventToQueue = { id: '2', type: 'TaskCompleted', aggregateId: '2', data: {} };
    const event3: EventToQueue = { id: '3', type: 'TaskCreated', aggregateId: '3', data: {} };
    
    queue.push(event1);
    queue.push(event2);
    queue.push(event3);
    
    expect(queue.pop()?.type).toBe('TaskCompleted'); // high priority
    expect(queue.pop()?.type).toBe('TaskCreated');   // normal priority
    expect(queue.pop()?.type).toBe('TaskUpdated');    // low priority
  });

  it('should return null when queue is empty', () => {
    const queue = new PriorityEventQueue();
    expect(queue.pop()).toBeNull();
  });

  it('should requeue events with lower priority', () => {
    const queue = new PriorityEventQueue();
    
    const event: EventToQueue = { id: '1', type: 'TaskCompleted', aggregateId: '1', data: {} };
    queue.push(event);
    
    const popped = queue.pop();
    expect(popped).not.toBeNull();
    
    if (popped) {
      queue.requeue(popped);
      const requeued = queue.pop();
      expect(requeued?.priority).toBe('normal'); // Пониженный приоритет
    }
  });

  it('should handle multiple events with same priority', () => {
    const queue = new PriorityEventQueue();
    
    for (let i = 0; i < 5; i++) {
      const event: EventToQueue = { 
        id: `${i}`, 
        type: 'TaskCreated', 
        aggregateId: `${i}`, 
        data: {} 
      };
      queue.push(event);
    }
    
    expect(queue.size()).toBe(5);
    
    for (let i = 0; i < 5; i++) {
      const popped = queue.pop();
      expect(popped).not.toBeNull();
    }
    
    expect(queue.size()).toBe(0);
  });
});