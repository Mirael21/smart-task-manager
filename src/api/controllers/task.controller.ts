// src/api/controllers/task.controller.ts
import { Request, Response } from 'express';
import { TaskCommandHandler } from '../../application/commands/task.command.handler';
import { TaskQueryHandler } from '../../application/queries/task.query.handler';
import { validateOrReject, ValidationError } from 'class-validator';
import { CreateTaskDto, UpdateTaskDto } from '../dtos/task.dto';

export class TaskController {
  constructor(
    private commandHandler: TaskCommandHandler,
    private queryHandler: TaskQueryHandler
  ) {}

  // Вспомогательный метод для безопасного получения строки из params
  private getStringParam(param: string | string[] | undefined): string | undefined {
    if (Array.isArray(param)) {
      return param[0];
    }
    return param;
  }

  // POST /api/tasks
  async createTask(req: Request, res: Response): Promise<void> {
    try {
      const dto = new CreateTaskDto();
      Object.assign(dto, req.body);
      
      await validateOrReject(dto);
      
      // Используем user из запроса или system по умолчанию
      const userId = (req as any).user?.id || 'system';
      
      const result = await this.commandHandler.createTask({
        ...dto,
        userId
      });
      
      res.status(201).json(result);
    } catch (error) {
      if (Array.isArray(error) && error[0] instanceof ValidationError) {
        // Ошибки валидации
        res.status(400).json({ 
          errors: error.map(e => ({
            property: e.property,
            constraints: e.constraints
          }))
        });
      } else if (error instanceof Error) {
        // Обычные ошибки
        res.status(500).json({ error: error.message });
      } else {
        // Неизвестные ошибки
        res.status(500).json({ error: 'Unknown error occurred' });
      }
    }
  }

  // GET /api/tasks/:id
  async getTask(req: Request, res: Response): Promise<void> {
    try {
      const taskIdParam = req.params.id;
      const taskId = this.getStringParam(taskIdParam);
      
      if (!taskId) {
        res.status(400).json({ error: 'Task ID is required' });
        return;
      }
      
      const task = await this.queryHandler.getTaskById(taskId);
      
      if (!task) {
        res.status(404).json({ error: 'Task not found' });
        return;
      }
      
      res.json(task);
    } catch (error) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Unknown error occurred' });
      }
    }
  }

  // GET /api/tasks
  async getTasks(req: Request, res: Response): Promise<void> {
    try {
      // Преобразуем query параметры с правильной типизацией
      const filters = {
        status: typeof req.query.status === 'string' ? req.query.status : undefined,
        createdBy: typeof req.query.userId === 'string' ? req.query.userId : undefined,
        fromDate: typeof req.query.fromDate === 'string' ? new Date(req.query.fromDate) : undefined,
        toDate: typeof req.query.toDate === 'string' ? new Date(req.query.toDate) : undefined,
        search: typeof req.query.search === 'string' ? req.query.search : undefined,
        page: typeof req.query.page === 'string' ? parseInt(req.query.page) : 1,
        limit: typeof req.query.limit === 'string' ? parseInt(req.query.limit) : 20
      };
      
      const result = await this.queryHandler.getTasks(filters);
      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Unknown error occurred' });
      }
    }
  }

  // PATCH /api/tasks/:id
  async updateTask(req: Request, res: Response): Promise<void> {
    try {
      const dto = new UpdateTaskDto();
      Object.assign(dto, req.body);
      
      await validateOrReject(dto);
      
      const taskIdParam = req.params.id;
      const taskId = this.getStringParam(taskIdParam);
      const userId = (req as any).user?.id || 'system';
      
      if (!taskId) {
        res.status(400).json({ error: 'Task ID is required' });
        return;
      }
      
      const result = await this.commandHandler.updateTask({
        taskId,
        updates: dto,
        userId
      });
      
      res.json(result);
    } catch (error) {
      if (Array.isArray(error) && error[0] instanceof ValidationError) {
        res.status(400).json({ 
          errors: error.map(e => ({
            property: e.property,
            constraints: e.constraints
          }))
        });
      } else if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Unknown error occurred' });
      }
    }
  }

  // POST /api/tasks/:id/complete
  async completeTask(req: Request, res: Response): Promise<void> {
  try {
    console.log('=== COMPLETE TASK DEBUG ===');
    console.log('Params:', req.params);
    console.log('ID from params:', req.params.id);
    
    const taskIdParam = req.params.id;
    const taskId = this.getStringParam(taskIdParam);
    const userId = (req as any).user?.id || 'system';
    
    console.log('Task ID after getStringParam:', taskId);
    
    if (!taskId) {
      console.log('No task ID provided');
      res.status(400).json({ error: 'Task ID is required' });
      return;
    }
    
    console.log('Calling commandHandler.completeTask with:', { taskId, userId });
    const result = await this.commandHandler.completeTask({
      taskId,
      userId
    });
    
    console.log('Result:', result);
    res.json(result);
  } catch (error) {
    console.error('Error in completeTask:', error);
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: 'Unknown error occurred' });
    }
  }
} 

  // POST /api/tasks/:id/reopen
  async reopenTask(req: Request, res: Response): Promise<void> {
    try {
      const taskIdParam = req.params.id;
      const taskId = this.getStringParam(taskIdParam);
      const userId = (req as any).user?.id || 'system';
      
      if (!taskId) {
        res.status(400).json({ error: 'Task ID is required' });
        return;
      }
      
      const result = await this.commandHandler.reopenTask({
        taskId,
        userId
      });
      
      res.json(result);
    } catch (error) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Unknown error occurred' });
      }
    }
  }

  // DELETE /api/tasks/:id
  async deleteTask(req: Request, res: Response): Promise<void> {
    try {
      const taskIdParam = req.params.id;
      const taskId = this.getStringParam(taskIdParam);
      const userId = (req as any).user?.id || 'system';
      const reason = typeof req.body.reason === 'string' ? req.body.reason : undefined;
      
      if (!taskId) {
        res.status(400).json({ error: 'Task ID is required' });
        return;
      }
      
      await this.commandHandler.deleteTask({
        taskId,
        userId,
        reason
      });
      
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Unknown error occurred' });
      }
    }
  }

  // GET /api/users/:userId/stats
  async getUserStats(req: Request, res: Response): Promise<void> {
    try {
      const userIdParam = req.params.userId;
      const userId = this.getStringParam(userIdParam);
      
      if (!userId) {
        res.status(400).json({ error: 'User ID is required' });
        return;
      }
      
      const stats = await this.queryHandler.getUserStats(userId);
      res.json(stats);
    } catch (error) {
      if (error instanceof Error) {
        res.status(500).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Unknown error occurred' });
      }
    }
  }
}