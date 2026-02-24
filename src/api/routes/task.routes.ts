// src/api/routes/task.routes.ts
import { Router } from 'express';
import { TaskController } from '../controllers/task.controller';
import { TaskCommandHandler } from '../../application/commands/task.command.handler';
import { TaskQueryHandler } from '../../application/queries/task.query.handler';
import { TaskRepository } from '../../infrastructure/persistence/repositories/task.repository';
import { EventStore } from '../../infrastructure/persistence/event.store';
import { Pool } from 'pg';

export function createTaskRouter(
  eventStore: EventStore,
  readPool: Pool,
  eventBus: any
): Router {
  const router = Router();
  
  const taskRepository = new TaskRepository(eventStore);
  const commandHandler = new TaskCommandHandler(taskRepository);
  const queryHandler = new TaskQueryHandler(readPool);
  const controller = new TaskController(commandHandler, queryHandler);

  // Передаем eventBus в commandHandler
  commandHandler.eventBus = eventBus;

  // Привязываем методы к контексту
  router.post('/', controller.createTask.bind(controller));
  router.get('/:id', controller.getTask.bind(controller));
  router.get('/', controller.getTasks.bind(controller));
  router.patch('/:id', controller.updateTask.bind(controller));
  router.post('/:id/complete', controller.completeTask.bind(controller));
  router.post('/:id/reopen', controller.reopenTask.bind(controller));
  router.delete('/:id', controller.deleteTask.bind(controller));
  router.get('/users/:userId/stats', controller.getUserStats.bind(controller));

  return router;
}