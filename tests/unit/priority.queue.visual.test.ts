import { PriorityEventQueue, EventToQueue } from '../../src/infrastructure/messaging/event.queue';

describe('PriorityEventQueue - ВИЗУАЛЬНАЯ ПРОВЕРКА', () => {
  it('показывает порядок добавления и извлечения', () => {
    const queue = new PriorityEventQueue();
    
    console.log('\n📊 ДЕМОНСТРАЦИЯ РАБОТЫ ПРИОРИТЕТНОЙ ОЧЕРЕДИ');
    console.log('==========================================\n');
    
    // Добавляем события в разном порядке
    const testEvents = [
      { id: '1', type: 'TaskUpdated', priority: 'LOW' },     // низкий
      { id: '2', type: 'TaskCompleted', priority: 'HIGH' },  // высокий
      { id: '3', type: 'TaskCreated', priority: 'NORMAL' },  // нормальный
      { id: '4', type: 'TaskDeleted', priority: 'HIGH' },    // высокий
      { id: '5', type: 'TaskUpdated', priority: 'LOW' },     // низкий
    ];
    
    console.log('📥 ПОРЯДОК ДОБАВЛЕНИЯ В ОЧЕРЕДЬ:');
    console.log('----------------------------------------');
    testEvents.forEach(event => {
      queue.push({
        id: event.id,
        type: event.type,
        aggregateId: event.id,
        data: {}
      });
      console.log(`   Событие ${event.id}: ${event.type} (${event.priority})`);
    });
    
    console.log('\n📤 ПОРЯДОК ИЗВЛЕЧЕНИЯ ИЗ ОЧЕРЕДИ:');
    console.log('----------------------------------------');
    
    let step = 1;
    let event;
    while ((event = queue.pop()) !== null) {
      console.log(`   ${step}. Событие ${event.aggregateId}: ${event.type} (${event.priority})`);
      step++;
    }
    
    // Тест автоматически пройдет, мы просто смотрим на порядок
    expect(true).toBe(true);
  });
});