// src/infrastructure/persistence/event.store.ts
import { Pool } from 'pg';

export interface DomainEvent {
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  data: any;
  version: number;
  metadata?: any;
  timestamp?: Date;
}

export class EventStore {
  constructor(private pool: Pool) {}

  async saveEvents(aggregateId: string, events: DomainEvent[], expectedVersion: number): Promise<void> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Проверяем версию (оптимистичная блокировка)
      const result = await client.query(
        'SELECT MAX(version) as current_version FROM events WHERE aggregate_id = $1',
        [aggregateId]
      );
      
      const currentVersion = result.rows[0]?.current_version || 0;
      
      if (currentVersion !== expectedVersion) {
        throw new Error(`Concurrency conflict: expected version ${expectedVersion}, but current is ${currentVersion}`);
      }
      
      // Сохраняем события
      for (let i = 0; i < events.length; i++) {
        const event = events[i];
        await client.query(
          `INSERT INTO events 
           (aggregate_id, aggregate_type, event_type, event_data, version, metadata) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            aggregateId,
            event.aggregateType,
            event.eventType,
            JSON.stringify(event.data),
            expectedVersion + i + 1,
            JSON.stringify(event.metadata || {})
          ]
        );
      }
      
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getEvents(aggregateId: string): Promise<DomainEvent[]> {
    const result = await this.pool.query(
      'SELECT * FROM events WHERE aggregate_id = $1 ORDER BY version ASC',
      [aggregateId]
    );
    
    return result.rows.map(row => ({
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      eventType: row.event_type,
      data: row.event_data,
      version: row.version,
      metadata: row.metadata,
      timestamp: row.timestamp
    }));
  }

  async getAllEvents(aggregateType?: string): Promise<DomainEvent[]> {
    let query = 'SELECT * FROM events ORDER BY timestamp ASC';
    const params = [];
    
    if (aggregateType) {
      query = 'SELECT * FROM events WHERE aggregate_type = $1 ORDER BY timestamp ASC';
      params.push(aggregateType);
    }
    
    const result = await this.pool.query(query, params);
    
    return result.rows.map(row => ({
      aggregateId: row.aggregate_id,
      aggregateType: row.aggregate_type,
      eventType: row.event_type,
      data: row.event_data,
      version: row.version,
      metadata: row.metadata,
      timestamp: row.timestamp
    }));
  }
}