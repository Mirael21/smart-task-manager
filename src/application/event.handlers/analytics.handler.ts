// src/application/event.handlers/analytics.handler.ts
import { EventHandler } from '../../event-loop/event.processor';
import { QueuedEvent } from '../../infrastructure/messaging/event.queue';

export class AnalyticsHandler implements EventHandler {
  private stats: Map<string, number> = new Map();

  async handle(event: QueuedEvent): Promise<void> {
    console.log(`📊 Updating analytics for ${event.type}`);
    
    // Считаем статистику
    const count = this.stats.get(event.type) || 0;
    this.stats.set(event.type, count + 1);
    
    console.log(`   → Статистика:`, Object.fromEntries(this.stats));
  }

  getStats(): Record<string, number> {
    return Object.fromEntries(this.stats);
  }
}