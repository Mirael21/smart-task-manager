// src/api/dtos/task.dto.ts
import { IsString, IsOptional, IsUUID, MinLength } from 'class-validator';

export class CreateTaskDto {
  @IsString()
  @MinLength(3)
  title!: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class UpdateTaskDto {
  @IsString()
  @MinLength(3)
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;
}

export class TaskResponseDto {
  id!: string;
  title!: string;
  description?: string;
  status!: string;
  createdAt!: Date;
  createdBy!: string;
  completedAt?: Date;
  updatedAt?: Date;
  version!: number;
}