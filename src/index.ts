// src/index.ts - добавьте импорт в начале файла
import express from 'express';
import http from 'http';
import { Pool } from 'pg';
import path from 'path';

import { EventStore } from './infrastructure/persistence/event.store';
import { createTaskRouter } from './api/routes/task.routes';
import { TaskProjector } from './application/projectors/task.projector';
import { TaskRepository } from './infrastructure/persistence/repositories/task.repository';
import { PriorityEventQueue } from './infrastructure/messaging/event.queue';
import { WebSocketServer } from './infrastructure/websocket/websocket.server';
import { EventProcessor, EventHandler } from './event-loop/event.processor';  // ← ИМПОРТИРУЕМ EventHandler!
import { EmailHandler } from './application/event.handlers/email.handler';
import { NotificationHandler } from './application/event.handlers/notification.handler';
import { AnalyticsHandler } from './application/event.handlers/analytics.handler';

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'api/views')));

const PORT = process.env.PORT || 3000;

async function bootstrap() {
  try {
    // Подключение к базам данных
    const eventStorePool = new Pool({
      host: process.env.EVENTSTORE_HOST || 'localhost',
      port: parseInt(process.env.EVENTSTORE_PORT || '5432'),
      database: process.env.EVENTSTORE_DB || 'eventstore',
      user: process.env.EVENTSTORE_USER || 'admin',
      password: process.env.EVENTSTORE_PASSWORD || 'secret'
    });

    const readPool = new Pool({
      host: process.env.READMODEL_HOST || 'localhost',
      port: parseInt(process.env.READMODEL_PORT || '5433'),
      database: process.env.READMODEL_DB || 'readmodel',
      user: process.env.READMODEL_USER || 'admin',
      password: process.env.READMODEL_PASSWORD || 'secret'
    });

    await eventStorePool.query('SELECT 1');
    console.log('✅ Connected to EventStore');
    
    await readPool.query('SELECT 1');
    console.log('✅ Connected to ReadModel');

    // Инициализация компонентов
    const eventStore = new EventStore(eventStorePool);
    const projector = new TaskProjector(readPool);
    const wsServer = new WebSocketServer(server);
    const eventQueue = new PriorityEventQueue();

    // Регистрируем обработчики событий
    const handlers = new Map<string, EventHandler[]>();  // ← ТЕПЕРЬ EventHandler найден!

    // ВАЖНО: проектор теперь может быть добавлен как обработчик!
    handlers.set('TaskCreated', [
      new EmailHandler(),
      new NotificationHandler(),
      new AnalyticsHandler(),
      projector  // ← projector implements EventHandler
    ]);

    handlers.set('TaskCompleted', [
      new EmailHandler(),
      new NotificationHandler(),
      new AnalyticsHandler(),
      projector
    ]);

    handlers.set('TaskUpdated', [
      new AnalyticsHandler(),
      projector
    ]);

    handlers.set('TaskReopened', [
      new AnalyticsHandler(),
      projector
    ]);

    handlers.set('TaskDeleted', [
      new AnalyticsHandler(),
      projector
    ]);

    console.log('📋 Registered handlers for:', Array.from(handlers.keys()).join(', '));

    // Создаем и запускаем Event Processor
    const eventProcessor = new EventProcessor(
      eventQueue,
      handlers,
      wsServer,
      eventStore
    );
    
    console.log('🤖 Starting Event Processor...');
    eventProcessor.start(100);
    console.log('✅ Event Processor started');

    // Восстанавливаем проекции
    console.log('🔄 Rebuilding projections...');
    await projector.rebuild();
    const events = await eventStore.getAllEvents('Task');
    for (const event of events) {
      await projector.project(event);
    }
    console.log(`✅ Rebuilt ${events.length} projections`);

    // Сохраняем компоненты в app.locals
    app.locals.eventQueue = eventQueue;
    app.locals.wsServer = wsServer;
    app.locals.eventProcessor = eventProcessor;

    // Роуты API
    app.use('/api/tasks', createTaskRouter(eventStore, readPool, eventQueue));

    // HTML страница
    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'api/views/index.html'));
    });

    // Debug эндпоинты
    app.get('/debug/events', async (req, res) => {
      try {
        const events = await eventStore.getAllEvents('Task');
        const readModelCount = await readPool.query('SELECT COUNT(*) FROM task_read_model');
        res.json({ 
          eventStore: events.length,
          readModel: readModelCount.rows[0].count
        });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    app.get('/debug/events/:id', async (req, res) => {
      try {
        const { id } = req.params;
        const events = await eventStore.getEvents(id);
        res.json(events);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    app.post('/debug/refresh/:id', async (req, res) => {
      try {
        const { id } = req.params;
        console.log(`🔄 Manually refreshing task ${id}`);
        
        const events = await eventStore.getEvents(id);
        console.log(`   Found ${events.length} events`);
        
        for (const event of events) {
          console.log(`   → Applying ${event.eventType}`);
          await projector.project(event);
        }
        
        const result = await readPool.query('SELECT * FROM task_read_model WHERE id = $1', [id]);
        
        res.json({ 
          message: 'Refreshed', 
          eventsProcessed: events.length,
          taskInReadModel: result.rows[0] || null
        });
      } catch (error) {
        console.error('Error refreshing:', error);
        res.status(500).json({ error: String(error) });
      }
    });

// src/index.ts - debug эндпоинт для очереди
app.get('/debug/queue', (req, res) => {
  try {
    const stats = eventQueue.getStats ? eventQueue.getStats() : { 
      high: 0, normal: 0, low: 0, total: eventQueue.size() 
    };
    
    res.json({ 
      size: eventQueue.size(),
      details: stats,
      clients: wsServer.getClientCount(),
      processorRunning: eventProcessor['isRunning']
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 API: http://localhost:${PORT}/api/tasks`);
      console.log(`🖥️  UI: http://localhost:${PORT}/`);
      console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();