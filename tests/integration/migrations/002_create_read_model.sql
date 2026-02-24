-- tests/integration/migrations/002_create_read_model.sql
CREATE TABLE IF NOT EXISTS task_read_model (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    version INT NOT NULL,
    
    -- Для быстрых запросов
    is_overdue BOOLEAN GENERATED ALWAYS AS (
        status != 'done' AND 
        updated_at < NOW() - INTERVAL '7 days'
    ) STORED
);

CREATE INDEX idx_task_read_model_status ON task_read_model(status);
CREATE INDEX idx_task_read_model_created_by ON task_read_model(created_by);
CREATE INDEX idx_task_read_model_created_at ON task_read_model(created_at);