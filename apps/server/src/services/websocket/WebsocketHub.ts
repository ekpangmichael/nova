import type { JsonValue, WebsocketEnvelope, WebsocketEventType } from "@nova/shared";
import type WebSocket from "ws";

export class WebsocketHub {
  #connections = new Set<WebSocket>();

  handleConnection(socket: WebSocket) {
    this.#connections.add(socket);
    socket.on("close", () => {
      this.#connections.delete(socket);
    });
  }

  broadcast<TPayload extends JsonValue | Record<string, unknown>>(
    type: WebsocketEventType,
    payload: TPayload
  ) {
    const envelope: WebsocketEnvelope<TPayload> = {
      type,
      payload,
      sentAt: new Date().toISOString(),
    };

    const message = JSON.stringify(envelope);

    for (const socket of this.#connections) {
      if (socket.readyState === socket.OPEN) {
        socket.send(message);
      }
    }
  }
}
