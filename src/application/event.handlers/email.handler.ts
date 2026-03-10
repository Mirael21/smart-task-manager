// src/application/event.handlers/email.handler.ts
import { EventHandler } from '../../event-loop/event.processor';
import { QueuedEvent } from '../../infrastructure/messaging/event.queue';

// Имитация email сервиса
export class EmailHandler implements EventHandler {
  async handle(event: QueuedEvent): Promise<void> {
    console.log(`📧 Sending email for ${event.type}`);
    
    // Имитация отправки email
    await new Promise(resolve => setTimeout(resolve, 50));
    
    switch (event.type) {
      case 'TaskCompleted':
        console.log(`   → Email: Задача ${event.aggregateId} завершена`);
        break;
      case 'TaskCreated':
        console.log(`   → Email: Создана новая задача`);
        break;
    }
  }
}