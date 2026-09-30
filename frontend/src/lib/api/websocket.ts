type EventHandler = (event: string, data: Record<string, unknown>) => void;

class WSConnection {
  private ws: WebSocket | null = null;
  private handlers: EventHandler[] = [];
  private reconnectTimer: number | null = null;
  public status: 'LIVE' | 'RECONNECTING' | 'OFFLINE' = 'OFFLINE';
  private statusListeners: ((s: string) => void)[] = [];

  connect() {
    const url = (import.meta.env.VITE_WS_BASE_URL || 'ws://localhost:8000') + '/ws/command';
    try {
      this.ws = new WebSocket(url);
      this.ws.onopen = () => { this.status = 'LIVE'; this.notifyStatus(); };
      this.ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          this.handlers.forEach(h => h(msg.event, msg.data));
        } catch {}
      };
      this.ws.onclose = () => {
        this.status = 'RECONNECTING'; this.notifyStatus();
        this.reconnectTimer = window.setTimeout(() => this.connect(), 3000);
      };
      this.ws.onerror = () => { this.status = 'OFFLINE'; this.notifyStatus(); };
    } catch { this.status = 'OFFLINE'; this.notifyStatus(); }
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
