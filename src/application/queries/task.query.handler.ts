// src/application/queries/task.query.handler.ts
import { Pool } from 'pg';

export interface TaskFilters {
  status?: string;
  createdBy?: string;
  fromDate?: Date;
  toDate?: Date;
  search?: string;
  page?: number;
  limit?: number;
}

export class TaskQueryHandler {
  constructor(private readPool: Pool) {}

  async getTaskById(id: string) {
    const result = await this.readPool.query(
      'SELECT * FROM task_read_model WHERE id = $1',
      [id]
    );
    
    return result.rows[0] || null;
  }

  async getTasks(filters: TaskFilters = {}) {
    let query = 'SELECT * FROM task_read_model WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.status && filters.status !== 'all') {
      query += ` AND status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.createdBy) {
      query += ` AND created_by = $${paramIndex++}`;
      values.push(filters.createdBy);
    }

    if (filters.fromDate) {
      query += ` AND created_at >= $${paramIndex++}`;
      values.push(filters.fromDate);
    }

    if (filters.toDate) {
      query += ` AND created_at <= $${paramIndex++}`;
      values.push(filters.toDate);
    }

    if (filters.search) {
      query += ` AND (title ILIKE $${paramIndex++} OR description ILIKE $${paramIndex++})`;
      const searchPattern = `%${filters.search}%`;
      values.push(searchPattern, searchPattern);
    }

    // Пагинация
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;
    
    query += ` ORDER BY created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    values.push(limit, offset);

    const result = await this.readPool.query(query, values);
    
    // Получаем общее количество для пагинации
    const countResult = await this.getTotalCount(filters);
    
    return {
      tasks: result.rows,
      page,
      limit,
      total: parseInt(countResult.count)
    };
  }

  private async getTotalCount(filters: TaskFilters): Promise<{ count: string }> {
    let query = 'SELECT COUNT(*) FROM task_read_model WHERE 1=1';
    const values: any[] = [];
    let paramIndex = 1;

    if (filters.status && filters.status !== 'all') {
      query += ` AND status = $${paramIndex++}`;
      values.push(filters.status);
    }

    if (filters.createdBy) {
      query += ` AND created_by = $${paramIndex++}`;
      values.push(filters.createdBy);
    }

    if (filters.fromDate) {
      query += ` AND created_at >= $${paramIndex++}`;
      values.push(filters.fromDate);
    }

    if (filters.toDate) {
      query += ` AND created_at <= $${paramIndex++}`;
      values.push(filters.toDate);
    }

    if (filters.search) {
      query += ` AND (title ILIKE $${paramIndex++} OR description ILIKE $${paramIndex++})`;
      const searchPattern = `%${filters.search}%`;
      values.push(searchPattern, searchPattern);
    }

    const result = await this.readPool.query(query, values);
    return result.rows[0];
  }

  async getUserStats(userId: string) {
    const result = await this.readPool.query(
      `SELECT 
         COUNT(*) as total_tasks,
         COUNT(CASE WHEN status = 'done' THEN 1 END) as completed_tasks,
         COUNT(CASE WHEN status = 'todo' THEN 1 END) as pending_tasks,
         COUNT(CASE WHEN status = 'deleted' THEN 1 END) as deleted_tasks,
         AVG(CASE 
           WHEN status = 'done' AND completed_at IS NOT NULL 
           THEN EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600 
         END) as avg_completion_hours
       FROM task_read_model
       WHERE created_by = $1`,
      [userId]
    );
    
    return result.rows[0];
  }
}