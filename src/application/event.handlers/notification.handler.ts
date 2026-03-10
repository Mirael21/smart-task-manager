// src/application/event.handlers/notification.handler.ts
import { EventHandler } from '../../event-loop/event.processor';
import { QueuedEvent } from '../../infrastructure/messaging/event.queue';

export class NotificationHandler implements EventHandler {
  async handle(event: QueuedEvent): Promise<void> {
    console.log(`🔔 Sending notification for ${event.type}`);
    
    // Имитация пуш-уведомления
    await new Promise(resolve => setTimeout(resolve, 30));
    
    // Можно сохранять уведомления в БД
  }
}