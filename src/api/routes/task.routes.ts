// src/api/routes/task.routes.ts
import { Router } from 'express';
import { TaskController } from '../controllers/task.controller';
import { TaskCommandHandler } from '../../application/commands/task.command.handler';
import { TaskQueryHandler } from '../../application/queries/task.query.handler';
import { TaskRepository } from '../../infrastructure/persistence/repositories/task.repository';
import { EventStore } from '../../infrastructure/persistence/event.store';
import { PriorityEventQueue } from '../../infrastructure/messaging/event.queue';
import { Pool } from 'pg';

export function createTaskRouter(
  eventStore: EventStore,
  readPool: Pool,
  eventQueue: PriorityEventQueue
): Router {
  const router = Router();
  
  const taskRepository = new TaskRepository(eventStore);
  const commandHandler = new TaskCommandHandler(taskRepository, eventQueue);
  const queryHandler = new TaskQueryHandler(readPool);
  const controller = new TaskController(commandHandler, queryHandler);

  // Сохраняем ссылки для доступа (если нужно)
  (controller as any).eventQueue = eventQueue;

  // Основные CRUD операции
  router.post('/', controller.createTask.bind(controller));
  router.get('/:id', controller.getTask.bind(controller));
  router.get('/', controller.getTasks.bind(controller));
  router.patch('/:id', controller.updateTask.bind(controller));
  
  // Специальные операции
  router.post('/:id/complete', controller.completeTask.bind(controller));
  router.post('/:id/reopen', controller.reopenTask.bind(controller));
  router.delete('/:id', controller.deleteTask.bind(controller));
  
  // Статистика
  router.get('/users/:userId/stats', controller.getUserStats.bind(controller));
  
  // Bulk операции (для тестирования)
  router.post('/bulk/:count', async (req, res) => {
    try {
      const count = parseInt(req.params.count) || 10;
      const userId = (req as any).user?.id || 'system';
      
      const taskIds = await commandHandler.createBulkTasks(count, userId);
      
      res.json({ 
        message: `Created ${taskIds.length} tasks`,
        taskIds 
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  return router;
}