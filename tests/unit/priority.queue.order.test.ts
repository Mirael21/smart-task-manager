import { PriorityEventQueue, EventToQueue } from '../../src/infrastructure/messaging/event.queue';

describe('PriorityEventQueue - Визуальная проверка порядка', () => {
  let queue: PriorityEventQueue;

  beforeEach(() => {
    queue = new PriorityEventQueue();
    // Отключаем логи для чистоты теста
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('должен соблюдать порядок: все HIGH, потом NORMAL, потом LOW', () => {
    console.log('\n📊 ТЕСТ: Проверка приоритетов');
    console.log('==========================================');
    
    // Создаем события в хаотичном порядке
    const events: { type: string; priority: string; index: number }[] = [
      { type: 'TaskUpdated', priority: 'LOW', index: 1 },      // low
      { type: 'TaskCompleted', priority: 'HIGH', index: 2 },   // high
      { type: 'TaskCreated', priority: 'NORMAL', index: 3 },   // normal
      { type: 'TaskDeleted', priority: 'HIGH', index: 4 },     // high
      { type: 'TaskUpdated', priority: 'LOW', index: 5 },      // low
      { type: 'TaskCreated', priority: 'NORMAL', index: 6 },   // normal
      { type: 'TaskCompleted', priority: 'HIGH', index: 7 },   // high
      { type: 'TaskUpdated', priority: 'LOW', index: 8 },      // low
      { type: 'TaskCreated', priority: 'NORMAL', index: 9 },   // normal
      { type: 'TaskCompleted', priority: 'HIGH', index: 10 },  // high
    ];

    console.log('\n📥 ПОРЯДОК ДОБАВЛЕНИЯ В ОЧЕРЕДЬ:');
    console.log('------------------------------------------');
    events.forEach(e => {
      queue.push({
        id: `${e.index}`,
        type: e.type,
        aggregateId: `${e.index}`,
        data: { index: e.index }
      });
      console.log(`   ${e.index.toString().padStart(2)}. ${e.type.padEnd(15)} (${e.priority})`);
    });

    console.log('\n📤 ПОРЯДОК ИЗВЛЕЧЕНИЯ ИЗ ОЧЕРЕДИ:');
    console.log('------------------------------------------');
    
    const processed: { index: number; type: string; priority: string }[] = [];
    let event;
    let step = 1;
    
    while ((event = queue.pop()) !== null) {
      const priority = event.priority === 'high' ? 'HIGH' : 
                      event.priority === 'normal' ? 'NORMAL' : 'LOW';
      
      processed.push({
        index: parseInt(event.aggregateId),
        type: event.type,
        priority
      });
      
      console.log(`   ${(step++).toString().padStart(2)}. ${event.type.padEnd(15)} (${priority}) [был добавлен под номером ${event.aggregateId}]`);
    }

    console.log('\n📊 СРАВНЕНИЕ ПОРЯДКА:');
    console.log('------------------------------------------');
    console.log('Добавление: 1(LOW), 2(HIGH), 3(NORMAL), 4(HIGH), 5(LOW), 6(NORMAL), 7(HIGH), 8(LOW), 9(NORMAL), 10(HIGH)');
    console.log('Извлечение: ', processed.map(p => p.index).join(', '));

    // Проверяем, что все HIGH (2,4,7,10) идут первыми
    const highIndices = processed.slice(0, 4).map(p => p.index).sort((a,b) => a-b);
    expect(highIndices).toEqual([2,4,7,10]);
    
    // Проверяем, что все NORMAL (3,6,9) идут после HIGH
    const normalIndices = processed.slice(4, 7).map(p => p.index).sort((a,b) => a-b);
    expect(normalIndices).toEqual([3,6,9]);
    
    // Проверяем, что все LOW (1,5,8) идут последними
    const lowIndices = processed.slice(7, 10).map(p => p.index).sort((a,b) => a-b);
    expect(lowIndices).toEqual([1,5,8]);
  });

  it('должен сохранять порядок внутри одной группы приоритетов', () => {
    console.log('\n📊 ТЕСТ: Порядок внутри группы NORMAL');
    console.log('==========================================');
    
    // Добавляем 5 NORMAL событий в определенном порядке
    for (let i = 1; i <= 5; i++) {
      queue.push({
        id: `${i}`,
        type: 'TaskCreated',
        aggregateId: `${i}`,
        data: { index: i }
      });
      console.log(`   Добавлен TaskCreated ${i}`);
    }

    console.log('\n📤 Извлечение:');
    let step = 1;
    let event;
    while ((event = queue.pop()) !== null) {
      console.log(`   Извлечен TaskCreated ${event.aggregateId} (шаг ${step++})`);
      expect(parseInt(event.aggregateId)).toBe(step - 1); // Должны идти по порядку 1,2,3,4,5
    }
  });

  it('должен показать смешанный приоритетный порядок', () => {
    console.log('\n📊 ТЕСТ: Сложный сценарий с 15 случайными событиями');
    console.log('==========================================');
    
    // Генерируем 15 событий с разными приоритетами
    const events: { index: number; type: string; priority: string }[] = [];
    
    for (let i = 1; i <= 15; i++) {
      const rand = Math.random();
      let type: string;
      let priority: string;
      
      if (rand < 0.3) {
        type = 'TaskCompleted';
        priority = 'HIGH';
      } else if (rand < 0.6) {
        type = 'TaskCreated';
        priority = 'NORMAL';
      } else {
        type = 'TaskUpdated';
        priority = 'LOW';
      }
      
      events.push({ index: i, type, priority });
    }

    // Выводим порядок добавления
    console.log('\n📥 ПОРЯДОК ДОБАВЛЕНИЯ:');
    events.forEach(e => {
      queue.push({
        id: `${e.index}`,
        type: e.type,
        aggregateId: `${e.index}`,
        data: { index: e.index }
      });
      console.log(`   ${e.index.toString().padStart(2)}. ${e.type.padEnd(15)} (${e.priority})`);
    });

    // Извлекаем и выводим порядок обработки
    console.log('\n📤 ПОРЯДОК ОБРАБОТКИ:');
    const processed: { index: number; priority: string }[] = [];
    let step = 1;
    let event;
    
    while ((event = queue.pop()) !== null) {
      const priority = event.priority === 'high' ? 'HIGH' : 
                      event.priority === 'normal' ? 'NORMAL' : 'LOW';
      
      processed.push({
        index: parseInt(event.aggregateId),
        priority
      });
      
      console.log(`   ${(step++).toString().padStart(2)}. Событие ${event.aggregateId} (${priority})`);
    }

    // Анализируем порядок
    console.log('\n📊 АНАЛИЗ ПОРЯДКА:');
    
    const highIndices = processed.filter(p => p.priority === 'HIGH').map(p => p.index);
    const normalIndices = processed.filter(p => p.priority === 'NORMAL').map(p => p.index);
    const lowIndices = processed.filter(p => p.priority === 'LOW').map(p => p.index);
    
    console.log(`   HIGH события (индексы): ${highIndices.join(', ')}`);
    console.log(`   NORMAL события (индексы): ${normalIndices.join(', ')}`);
    console.log(`   LOW события (индексы): ${lowIndices.join(', ')}`);
    
    // Проверяем, что все HIGH идут до первого NORMAL
    const firstNormalIndex = processed.findIndex(p => p.priority === 'NORMAL');
    if (firstNormalIndex !== -1) {
      const beforeNormal = processed.slice(0, firstNormalIndex);
      expect(beforeNormal.every(p => p.priority === 'HIGH')).toBe(true);
      console.log(`\n✅ Все события до первого NORMAL (позиция ${firstNormalIndex + 1}) - HIGH приоритет`);
    }
    
    // Проверяем, что все NORMAL идут до первого LOW
    const firstLowIndex = processed.findIndex(p => p.priority === 'LOW');
    if (firstLowIndex !== -1) {
      const beforeLow = processed.slice(0, firstLowIndex);
      const hasHighAfterNormal = beforeLow.some((p, i) => {
        if (i > 0 && p.priority === 'HIGH' && beforeLow[i-1].priority === 'NORMAL') {
          return true;
        }
        return false;
      });
      expect(hasHighAfterNormal).toBe(false);
      console.log(`✅ Нет HIGH событий после NORMAL`);
    }
  });
});