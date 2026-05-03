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

export interface PongMessage {
  type: "pong";
}

export type AlertMessage = ChargeAlertMessage | MemberAlertMessage;
export type WebsocketMessage = AlertMessage | PingMessage;
