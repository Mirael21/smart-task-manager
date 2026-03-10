// src/event-loop/event.processor.ts
import { PriorityEventQueue, QueuedEvent } from '../infrastructure/messaging/event.queue';
import { WebSocketServer } from '../infrastructure/websocket/websocket.server';
import { EventStore } from '../infrastructure/persistence/event.store';

export interface EventHandler {
  handle(event: QueuedEvent): Promise<void>;
}

export class EventProcessor {
  private isRunning: boolean = false;
  private processingInterval: NodeJS.Timeout | null = null;
  
  constructor(
    private queue: PriorityEventQueue,
    private handlers: Map<string, EventHandler[]>,
    private wsServer: WebSocketServer,
    private eventStore: EventStore
  ) {}

  start(intervalMs: number = 100): void {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🔄 Event Processor started');
    
    this.processingInterval = setInterval(async () => {
      await this.processNextEvent();
    }, intervalMs);
  }

  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    this.isRunning = false;
    console.log('⏹️ Event Processor stopped');
  }

  private async processNextEvent(): Promise<void> {
    const event = this.queue.pop();
    if (!event) return;

    console.log(`⚙️ Processing event: ${event.type} (${event.priority})`);

    try {
      const eventHandlers = this.handlers.get(event.type) || [];
      
      // Параллельная обработка для скорости
      await Promise.all(
        eventHandlers.map(handler => 
          this.executeHandler(handler, event)
        )
      );

      // Отправляем real-time уведомление через WebSocket
      this.wsServer.broadcast({
        type: 'EVENT_PROCESSED',
        eventType: event.type,
        aggregateId: event.aggregateId,
        timestamp: new Date()
      });

      console.log(`✅ Event processed: ${event.type}`);
    } catch (error) {
      console.error(`❌ Error processing event ${event.type}:`, error);
      this.queue.requeue(event);
    }
  }

  private async executeHandler(handler: EventHandler, event: QueuedEvent): Promise<void> {
    try {
      await handler.handle(event);
    } catch (error) {
      console.error(`Handler error:`, error);
      throw error;
    }
  }

  getQueueSize(): number {
    return this.queue.size();
  }
}