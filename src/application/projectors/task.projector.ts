// src/application/projectors/task.projector.ts
import { Pool } from 'pg';
import { DomainEvent } from '../../infrastructure/persistence/event.store';

export class TaskProjector {
  constructor(private readPool: Pool) {}

  async project(event: DomainEvent): Promise<void> {
     console.log(`🎯 Projector processing: ${event.eventType} for ${event.aggregateId}`);
  
  switch (event.eventType) {
    case 'TaskCreated':
      console.log('   → Creating task in read model');
      await this.onTaskCreated(event);
      break;
    case 'TaskCompleted':
      console.log('   → Updating task status to done');
      await this.onTaskCompleted(event);
      break;
      case 'TaskUpdated':
        await this.onTaskUpdated(event);
        break;
      case 'TaskReopened':
        await this.onTaskReopened(event);
        break;
      case 'TaskDeleted':
        await this.onTaskDeleted(event);
        break;
    }
     const result = await this.readPool.query(
    'SELECT * FROM task_read_model WHERE id = $1',
    [event.aggregateId]
  );
  console.log(`   → Read model after:`, result.rows[0] || 'not found');

  }

private async onTaskCreated(event: DomainEvent): Promise<void> {
  console.log('📝 Executing onTaskCreated with data:', event.data);
  
  await this.readPool.query(
    `INSERT INTO task_read_model 
     (id, title, description, status, created_at, created_by, version)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       status = EXCLUDED.status,
       created_at = EXCLUDED.created_at,
       created_by = EXCLUDED.created_by,
       version = EXCLUDED.version`,
    [
      event.aggregateId,
      event.data.title,
      event.data.description || null,
      'todo',
      event.timestamp,
      event.data.userId,
      event.version
    ]
  );
  
  console.log('✅ Task created in read model');
}

  private async onTaskUpdated(event: DomainEvent): Promise<void> {
    const updates: string[] = [];
    const values: any[] = [event.aggregateId];
    let paramIndex = 2;

    if (event.data.title) {
      updates.push(`title = $${paramIndex++}`);
      values.push(event.data.title);
    }
    if (event.data.description !== undefined) {
      updates.push(`description = $${paramIndex++}`);
      values.push(event.data.description);
    }

    updates.push(`updated_at = $${paramIndex++}`);
    values.push(event.timestamp);
    updates.push(`version = $${paramIndex++}`);
    values.push(event.version);

    await this.readPool.query(
      `UPDATE task_read_model 
       SET ${updates.join(', ')}
       WHERE id = $1`,
      values
    );
  }

private async onTaskCompleted(event: DomainEvent): Promise<void> {
  console.log('📝 Projector: TaskCompleted', {
    id: event.aggregateId,
    completedAt: event.data.completedAt,
    version: event.version
  });
  
  await this.readPool.query(
    `UPDATE task_read_model 
     SET status = 'done', 
         completed_at = $2,
         updated_at = $2,
         version = $3
     WHERE id = $1`,
    [event.aggregateId, event.data.completedAt, event.version]
  );
  
  // Проверим, обновилось ли
  const result = await this.readPool.query(
    'SELECT status, version FROM task_read_model WHERE id = $1',
    [event.aggregateId]
  );
  console.log('📝 After update:', result.rows[0]);
}

  private async onTaskReopened(event: DomainEvent): Promise<void> {
    await this.readPool.query(
      `UPDATE task_read_model 
       SET status = 'todo', 
           completed_at = NULL,
           updated_at = $2,
           version = $3
       WHERE id = $1`,
      [event.aggregateId, event.timestamp, event.version]
    );
  }

  private async onTaskDeleted(event: DomainEvent): Promise<void> {
    await this.readPool.query(
      `UPDATE task_read_model 
       SET status = 'deleted', 
           updated_at = $2,
           version = $3
       WHERE id = $1`,
      [event.aggregateId, event.timestamp, event.version]
    );
  }

  async rebuild(): Promise<void> {
    // Очищаем таблицу перед перестроением
    await this.readPool.query('TRUNCATE task_read_model');
  }
}