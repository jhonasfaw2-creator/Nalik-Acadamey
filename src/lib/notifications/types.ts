// ──────────────────────────────────────────────
// Notification provider types
// ──────────────────────────────────────────────

export type NotificationChannel = "whatsapp" | "email";

export type NotificationStatus = "pending" | "approved" | "rejected";

export interface NotificationPayload {
  to: string;
  channel: NotificationChannel;
  subject?: string;
  message: string;
}

export interface ApplicantNotificationData {
  applicantName: string;
  program: string;
  status: NotificationStatus;
  applicationId: string;
  phone?: string;
  email?: string;
}

export interface AdminNotificationData {
  applicantName: string;
  program: string;
  phone: string;
  applicationId: string;
  submittedAt: string;
}

export interface NotificationProvider {
  name: string;
  send(payload: NotificationPayload): Promise<{ success: boolean; error?: string }>;
}

export interface NotificationServiceConfig {
  enabled: boolean;
  defaultChannel: NotificationChannel;
  providers: {
    whatsapp: { enabled: boolean };
    email: { enabled: boolean };
  };
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationServiceConfig = {
  enabled: true,
  defaultChannel: "whatsapp",
  providers: {
    whatsapp: { enabled: true },
    email: { enabled: true },
  },
};
