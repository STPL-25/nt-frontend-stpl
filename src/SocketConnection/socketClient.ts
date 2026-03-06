import { io, Socket } from 'socket.io-client';

interface ServerToClientEvents {
  'user-created': (data: any) => void;
  'notification': (data: any) => void;
  'workflow-approved': (data: any) => void;
  'budget-updated': (data: any) => void;
  'kyc-status-changed': (data: any) => void;
}

interface ClientToServerEvents {
  'join-company': (companyId: string) => void;
  'leave-company': (companyId: string) => void;
}

class SocketClient {
  private static instance: SocketClient;
  public socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

  private constructor() {}

  public static getInstance(): SocketClient {
    if (!SocketClient.instance) {
      SocketClient.instance = new SocketClient();
    }
    return SocketClient.instance;
  }

  public connect(url: string): Socket<ServerToClientEvents, ClientToServerEvents> {
    if (!this.socket) {
      this.socket = io(url, {
        withCredentials: true,
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });
    }
    return this.socket;
  }

  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  public getSocket(): Socket<ServerToClientEvents, ClientToServerEvents> | null {
    return this.socket;
  }
}

export default SocketClient.getInstance();
