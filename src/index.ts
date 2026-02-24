// src/index.ts
import express from 'express';
import { Pool } from 'pg';
import { EventStore, DomainEvent } from './infrastructure/persistence/event.store';
import { createTaskRouter } from './api/routes/task.routes';
import { TaskProjector } from './application/projectors/task.projector';
import { TaskRepository } from './infrastructure/persistence/repositories/task.repository';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Simple Event Bus в памяти (с отладкой)
class SimpleEventBus {
  private subscribers: Map<string, Function[]> = new Map();
  
  subscribe(eventType: string, callback: (event: DomainEvent) => Promise<void>) {
    if (!this.subscribers.has(eventType)) {
      this.subscribers.set(eventType, []);
    }
    this.subscribers.get(eventType)!.push(callback);
    console.log(`📡 Subscribed to ${eventType}`);
  }
  
  async publish(event: DomainEvent): Promise<void> {
    console.log(`📢 Publishing event: ${event.eventType} for ${event.aggregateId}`);
    const callbacks = this.subscribers.get(event.eventType) || [];
    console.log(`   → ${callbacks.length} subscribers`);
    
    for (const callback of callbacks) {
      try {
        await callback(event);
        console.log(`   ✅ Handled by ${callback.name}`);
      } catch (error) {
        console.error(`   ❌ Error in handler:`, error);
      }
    }
  }
}

async function bootstrap() {
  try {
    // Подключение к Event Store
    const eventStorePool = new Pool({
      host: process.env.EVENTSTORE_HOST || 'localhost',
      port: parseInt(process.env.EVENTSTORE_PORT || '5432'),
      database: process.env.EVENTSTORE_DB || 'eventstore',
      user: process.env.EVENTSTORE_USER || 'admin',
      password: process.env.EVENTSTORE_PASSWORD || 'secret'
    });

    // Подключение к Read Model
    const readPool = new Pool({
      host: process.env.READMODEL_HOST || 'localhost',
      port: parseInt(process.env.READMODEL_PORT || '5433'),
      database: process.env.READMODEL_DB || 'readmodel',
      user: process.env.READMODEL_USER || 'admin',
      password: process.env.READMODEL_PASSWORD || 'secret'
    });

    // Проверяем подключения
    await eventStorePool.query('SELECT 1');
    console.log('✅ Connected to EventStore');
    
    await readPool.query('SELECT 1');
    console.log('✅ Connected to ReadModel');

    const eventStore = new EventStore(eventStorePool);
    const projector = new TaskProjector(readPool);
    const eventBus = new SimpleEventBus();

    // Подписываем проектор на все события
    eventBus.subscribe('TaskCreated', async (event: DomainEvent) => {
      console.log('📢 EventBus received TaskCreated for:', event.aggregateId);
      await projector.project(event);
    });

    eventBus.subscribe('TaskUpdated', async (event: DomainEvent) => {
      console.log('📢 EventBus received TaskUpdated for:', event.aggregateId);
      await projector.project(event);
    });

    eventBus.subscribe('TaskCompleted', async (event: DomainEvent) => {
      console.log('📢 EventBus received TaskCompleted for:', event.aggregateId);
      await projector.project(event);
    });

    eventBus.subscribe('TaskReopened', async (event: DomainEvent) => {
      console.log('📢 EventBus received TaskReopened for:', event.aggregateId);
      await projector.project(event);
    });

    eventBus.subscribe('TaskDeleted', async (event: DomainEvent) => {
      console.log('📢 EventBus received TaskDeleted for:', event.aggregateId);
      await projector.project(event);
    });

    // При запуске восстанавливаем все проекции из существующих событий
    console.log('🔄 Rebuilding projections from history...');
    
    // Очищаем read model перед перестроением
    await projector.rebuild();

    const events = await eventStore.getAllEvents('Task');
    for (const event of events) {
      await projector.project(event);
    }
    console.log(`✅ Rebuilt ${events.length} projections`);

    // Сохраняем eventBus в app.locals для доступа из контроллеров
    app.locals.eventBus = eventBus;

    // Роуты
    app.use('/api/tasks', createTaskRouter(eventStore, readPool, eventBus));

    // Health check
    app.get('/health', (req, res) => {
      res.json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    // Debug эндпоинты
    app.get('/debug/events', async (req, res) => {
      const events = await eventStore.getAllEvents('Task');
      const readModelCount = await readPool.query('SELECT COUNT(*) FROM task_read_model');
      res.json({ 
        eventStore: events.length,
        readModel: readModelCount.rows[0].count
      });
    });

    app.get('/debug/events/:id', async (req, res) => {
      const { id } = req.params;
      const events = await eventStore.getEvents(id);
      res.json(events);
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

    app.get('/debug/task/:id', async (req, res) => {
      const { id } = req.params;
      const taskRepository = new TaskRepository(eventStore);
      const task = await taskRepository.findById(id);
      
      const readModel = await readPool.query('SELECT * FROM task_read_model WHERE id = $1', [id]);
      
      res.json({
        id,
        existsInEventStore: !!(await eventStore.getEvents(id)).length,
        aggregateState: task ? task.getState() : null,
        readModelState: readModel.rows[0] || null
      });
    });

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📝 API available at http://localhost:${PORT}/api/tasks`);
      console.log(`🔍 Debug: http://localhost:${PORT}/debug/events`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

bootstrap();