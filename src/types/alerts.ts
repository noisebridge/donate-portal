import { z } from "zod";
import type { Cents } from "~/types/cents";

export interface ChargeAlertMessage {
  type: "charge_alert";
  id: string;
  date: string;
  amount: Cents;
  productName: string;
}

export interface MemberAlertMessage {
  type: "member_alert";
  id: string;
  date: string;
  productName: string;
}

export interface PingMessage {
  type: "ping";
  history: AlertMessage[];
}

export const pongMessageSchema = z.object({
  type: z.literal("pong"),
});
export type PongMessage = z.infer<typeof pongMessageSchema>;

export type AlertMessage = ChargeAlertMessage | MemberAlertMessage;
/** Sent by the server to connected clients. */
export type ServerMessage = AlertMessage | PingMessage;
/** Sent by clients back to the server. */
export const clientMessageSchema = pongMessageSchema;
export type ClientMessage = PongMessage;
export type WebsocketMessage = ServerMessage | ClientMessage;
