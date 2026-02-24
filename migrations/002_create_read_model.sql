CREATE TABLE IF NOT EXISTS task_read_model (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    version INT NOT NULL
);

CREATE INDEX idx_task_read_model_status ON task_read_model(status);
CREATE INDEX idx_task_read_model_created_by ON task_read_model(created_by);
CREATE INDEX idx_task_read_model_created_at ON task_read_model(created_at);