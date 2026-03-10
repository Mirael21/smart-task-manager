// src/infrastructure/messaging/event.queue.ts (исправленная версия)
export interface QueuedEvent {
  id: string;
  type: string;
  aggregateId: string;
  data: any;
  priority: 'high' | 'normal' | 'low';
  timestamp: Date;
  retryCount: number;
  maxRetries: number;
}

export type EventToQueue = Omit<QueuedEvent, 'priority' | 'timestamp' | 'retryCount' | 'maxRetries'>;

export class PriorityEventQueue {
  private highPriority: QueuedEvent[] = [];
  private normalPriority: QueuedEvent[] = [];
  private lowPriority: QueuedEvent[] = [];
  
  private priorityMap: Record<string, 'high' | 'normal' | 'low'> = {
    'TaskCreated': 'normal',
    'TaskUpdated': 'low',
    'TaskCompleted': 'high',
    'TaskReopened': 'normal',
    'TaskDeleted': 'high'
  };

  push(event: EventToQueue): void {
    const queuedEvent: QueuedEvent = {
      ...event,
      priority: this.priorityMap[event.type] || 'normal',
      timestamp: new Date(),
      retryCount: 0,
      maxRetries: 3
    };

    switch (queuedEvent.priority) {
      case 'high':
        this.highPriority.push(queuedEvent);
        break;
      case 'normal':
        this.normalPriority.push(queuedEvent);
        break;
      case 'low':
        this.lowPriority.push(queuedEvent);
        break;
      default:
        // На всякий случай, если придет что-то другое
        this.normalPriority.push(queuedEvent);
        break;
    }
    
    console.log(`📥 Event queued: ${event.type} (${queuedEvent.priority})`);
  }

  pop(): QueuedEvent | null {
    if (this.highPriority.length > 0) {
      return this.highPriority.shift()!;
    }
    if (this.normalPriority.length > 0) {
      return this.normalPriority.shift()!;
    }
    if (this.lowPriority.length > 0) {
      return this.lowPriority.shift()!;
    }
    return null;
  }

  requeue(event: QueuedEvent): void {
    event.retryCount++;
    
    if (event.retryCount < event.maxRetries) {
      // Понижаем приоритет при повторе
      let newPriority: 'high' | 'normal' | 'low' = event.priority;
      
      if (event.priority === 'high') {
        newPriority = 'normal';
      } else if (event.priority === 'normal') {
        newPriority = 'low';
      }
      
      event.priority = newPriority;
      
      // Добавляем обратно в очередь с пониженным приоритетом
      switch (event.priority) {
        case 'high':
          this.highPriority.push(event);
          break;
        case 'normal':
          this.normalPriority.push(event);
          break;
        case 'low':
          this.lowPriority.push(event);
          break;
        default:
          this.normalPriority.push(event);
          break;
      }
      console.log(`🔄 Event requeued: ${event.type} (attempt ${event.retryCount})`);
    } else {
      console.error(`❌ Event failed after ${event.maxRetries} retries:`, event);
      // Здесь можно отправить в Dead Letter Queue (будет позже)
    }
  }

  size(): number {
    return this.highPriority.length + this.normalPriority.length + this.lowPriority.length;
  }
  
  clear(): void {
    this.highPriority = [];
    this.normalPriority = [];
    this.lowPriority = [];
    console.log('🧹 Queue cleared');
  }
  
  getStats(): Record<string, number> {
    return {
      high: this.highPriority.length,
      normal: this.normalPriority.length,
      low: this.lowPriority.length,
      total: this.size()
    };
  }
}