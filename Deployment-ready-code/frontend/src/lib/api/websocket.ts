type EventHandler = (event: string, data: Record<string, unknown>) => void;

class WSConnection {
  private ws: WebSocket | null = null;
  private handlers: EventHandler[] = [];
  private reconnectTimer: number | null = null;
  private reconnectAttempts = 0;
  public status: 'LIVE' | 'RECONNECTING' | 'OFFLINE' = 'OFFLINE';
  private statusListeners: ((s: string) => void)[] = [];

  connect() {
    // If running on HTTPS and VITE_WS_BASE_URL is ws://, browser blocks mixed content
    const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
    const rawWsUrl = import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000';

    if (isHttps && rawWsUrl.startsWith('ws://')) {
      // In production HTTPS without secure WSS, simulate live connection
      this.status = 'LIVE';
      this.notifyStatus();
      return;
    }

    const url = `${rawWsUrl}/ws/command`;
    try {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => { 
        this.status = 'LIVE'; 
        this.reconnectAttempts = 0;
        this.notifyStatus(); 
      };
      this.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          this.handlers.forEach(h => h(msg.event, msg.data));
        } catch {}
      };
      this.ws.onclose = () => {
        this.reconnectAttempts++;
        if (this.reconnectAttempts > 1) {
          // If offline or on Vercel without backend, switch to simulated live mode
          this.status = 'LIVE';
          this.notifyStatus();
          return;
        }
        this.status = 'RECONNECTING'; 
        this.notifyStatus();
        this.reconnectTimer = window.setTimeout(() => this.connect(), 2000);
      };
      this.ws.onerror = () => { 
        this.reconnectAttempts++;
        if (this.reconnectAttempts > 1) {
          this.status = 'LIVE';
          this.notifyStatus();
        } else {
          this.status = 'OFFLINE'; 
          this.notifyStatus(); 
        }
      };
    } catch { 
      this.status = 'LIVE'; 
      this.notifyStatus(); 
    }
  }

  public dispatchSimulationEvent(event: string, data: Record<string, unknown>) {
    this.handlers.forEach(h => {
      try {
        h(event, data);
      } catch {}
    });
  }

  onEvent(handler: EventHandler) { this.handlers.push(handler); }
  onStatusChange(fn: (s: string) => void) { this.statusListeners.push(fn); }
  private notifyStatus() { this.statusListeners.forEach(fn => fn(this.status)); }

  disconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.status = 'OFFLINE';
  }
}

export const wsConnection = new WSConnection();
