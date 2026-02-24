// src/infrastructure/persistence/repositories/task.repository.ts
import { EventStore } from '../event.store';
import { TaskAggregate } from '../../../core/aggregates/task.aggregate';

export class TaskRepository {
  constructor(private eventStore: EventStore) {}

  async save(aggregate: TaskAggregate): Promise<void> {
    const events = aggregate.getUncommittedEvents();
    
    if (events.length === 0) {
      return;
    }

    await this.eventStore.saveEvents(
      aggregate['id'],
      events.map(e => ({
        aggregateId: e.aggregateId,
        aggregateType: e.aggregateType,
        eventType: e.eventType,
        data: e.data,
        version: e.version,
        metadata: e.metadata,
        timestamp: e.timestamp
      })),
      aggregate.getVersion() - events.length
    );

    aggregate.markEventsAsCommitted();
  }

    async findById(id: string): Promise<TaskAggregate | null> {
  console.log(`🔍 Finding task by id: ${id}`);
  
  const events = await this.eventStore.getEvents(id);
  console.log(`   Found ${events.length} events`);
  
  if (events.length === 0) {
    console.log('   No events found, returning null');
    return null;
  }

  const aggregate = new TaskAggregate(id);
  aggregate.loadFromHistory(events);
  
  console.log(`   Task loaded, version: ${aggregate.getVersion()}`);
  return aggregate;
}
}