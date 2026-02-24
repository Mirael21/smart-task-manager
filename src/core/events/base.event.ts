// src/core/events/base.event.ts
export abstract class BaseEvent {
  public readonly aggregateId: string;
  public readonly aggregateType: string;
  public readonly eventType: string;
  public readonly timestamp: Date;
  public readonly data: any;
  public readonly metadata?: any;
  public version: number = 0;

  constructor(
    aggregateId: string,
    aggregateType: string,
    eventType: string,
    data: any,
    metadata?: any
  ) {
    this.aggregateId = aggregateId;
    this.aggregateType = aggregateType;
    this.eventType = eventType;
    this.data = data;
    this.metadata = metadata;
    this.timestamp = new Date();
  }
}