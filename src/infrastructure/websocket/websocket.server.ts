// src/infrastructure/websocket/websocket.server.ts
import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';

export interface WebSocketMessage {
  type: string;
  eventType?: string;
  aggregateId?: string;
  data?: any;
  timestamp: Date;
}

export class WebSocketServer {
  private io: SocketServer;
  private clients: Set<string> = new Set();

  constructor(httpServer: HttpServer) {
    this.io = new SocketServer(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      }
    });

    this.setupHandlers();
    console.log('🔌 WebSocket server initialized');
  }

  private setupHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      console.log(`📱 Client connected: ${socket.id}`);
      this.clients.add(socket.id);

      socket.on('disconnect', () => {
        console.log(`📱 Client disconnected: ${socket.id}`);
        this.clients.delete(socket.id);
      });

      socket.on('subscribe', (eventTypes: string[]) => {
        console.log(`📱 Client ${socket.id} subscribed to:`, eventTypes);
        eventTypes.forEach(type => socket.join(type));
      });
      
      socket.on('unsubscribe', (eventTypes: string[]) => {
        eventTypes.forEach(type => socket.leave(type));
      });
      
      socket.emit('connected', { 
        message: 'Connected to WebSocket server',
        timestamp: new Date()
      });
    });
  }

  broadcast(message: WebSocketMessage): void {
    this.io.emit('event', message);
    console.log(`📢 Broadcast: ${message.type}`);
  }

  sendToRoom(room: string, message: WebSocketMessage): void {
    this.io.to(room).emit('event', message);
  }

  sendToClient(clientId: string, message: WebSocketMessage): void {
    this.io.to(clientId).emit('event', message);
  }

  getClientCount(): number {
    return this.clients.size;
  }
  
  getStats() {
    return {
      clients: this.clients.size,
      rooms: Object.keys(this.io.sockets.adapter.rooms).length
    };
  }
}