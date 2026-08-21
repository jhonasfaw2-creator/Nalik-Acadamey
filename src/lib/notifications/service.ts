import {
  type NotificationProvider,
  type ApplicantNotificationData,
  type AdminNotificationData,
  type NotificationServiceConfig,
  DEFAULT_NOTIFICATION_CONFIG,
} from "./types";
import { createWhatsAppProvider } from "./providers/whatsapp";
import { createEmailProvider } from "./providers/email";

const STATUS_MESSAGES: Record<string, { applicant: string; subject: string }> = {
  pending: {
    subject: "Application Under Review — Nalik Academy",
    applicant:
      "Your application to Nalik Academy is currently under review. Our team is processing your application and will contact you with the next steps soon.",
  },
  approved: {
    subject: "Congratulations! Your Application Has Been Approved — Nalik Academy",
    applicant:
      "We are pleased to inform you that your application to Nalik Academy has been approved! Welcome to our community of aspiring editors. Our team will contact you shortly with enrollment details, course schedule, and next steps. We look forward to helping you start your video editing journey.",
  },
  rejected: {
    subject: "Application Update — Nalik Academy",
    applicant:
      "Thank you for your interest in Nalik Academy. After careful review, we regret to inform you that we are unable to offer you a place at this time. We encourage you to develop your skills further and apply again in the future. We wish you all the best in your creative journey.",
  },
};

export class NotificationService {
  private providers: Map<string, NotificationProvider>;
  private config: NotificationServiceConfig;

  constructor(config: Partial<NotificationServiceConfig> = {}) {
    this.config = { ...DEFAULT_NOTIFICATION_CONFIG, ...config };
    this.providers = new Map<string, NotificationProvider>([
      ["whatsapp", createWhatsAppProvider()],
      ["email", createEmailProvider()],
    ]);
  }

  /**
   * Notify the applicant about a status change.
   */
  async notifyApplicant(data: ApplicantNotificationData): Promise<{
    whatsapp: boolean;
    email: boolean;
  }> {
    if (!this.config.enabled) {
      return { whatsapp: false, email: false };
    }

    const templates = STATUS_MESSAGES[data.status] || STATUS_MESSAGES.pending;
    const message = templates.applicant;
    const subject = templates.subject;

    const results = { whatsapp: false, email: false };

    // WhatsApp
    if (
      this.config.providers.whatsapp.enabled &&
      data.phone &&
      data.status !== "rejected"
    ) {
      const provider = this.providers.get("whatsapp");
      if (provider) {
        const result = await provider.send({
          to: data.phone,
          channel: "whatsapp",
          message: `${data.applicantName}, ${message}`,
        });
        results.whatsapp = result.success;
      }
    }

    // Email
    if (this.config.providers.email.enabled && data.email) {
      const provider = this.providers.get("email");
      if (provider) {
        const result = await provider.send({
          to: data.email,
          channel: "email",
          subject: `${subject} (Ref: ${data.applicationId})`,
          message: `Dear ${data.applicantName},\n\n${message}\n\nYour application reference: ${data.applicationId}\n\n— Nalik Academy`,
        });
        results.email = result.success;
      }
    }

    return results;
  }

  /**
   * Notify admins about a new application submission.
   */
  async notifyAdmins(data: AdminNotificationData): Promise<{
    whatsapp: boolean;
    email: boolean;
  }> {
    if (!this.config.enabled) {
      return { whatsapp: false, email: false };
    }

    const message = `New application received:\n\nName: ${data.applicantName}\nProgram: ${data.program}\nPhone: ${data.phone}\nApplication ID: ${data.applicationId}\nSubmitted: ${data.submittedAt}`;

    const results = { whatsapp: false, email: false };

    if (this.config.providers.whatsapp.enabled) {
      const provider = this.providers.get("whatsapp");
      if (provider) {
        const adminNumber = process.env.ADMIN_WHATSAPP_NUMBER;
        if (adminNumber) {
          const result = await provider.send({
            to: adminNumber,
            channel: "whatsapp",
            message,
          });
          results.whatsapp = result.success;
        }
      }
    }

    if (this.config.providers.email.enabled) {
      const provider = this.providers.get("email");
      if (provider) {
        const adminEmail = process.env.ADMIN_EMAIL;
        if (adminEmail) {
          const result = await provider.send({
            to: adminEmail,
            channel: "email",
            subject: `New Application: ${data.applicantName} — ${data.program}`,
            message,
          });
          results.email = result.success;
        }
      }
    }

    return results;
  }
}

/**
 * Singleton instance used across API routes.
 */
export const notificationService = new NotificationService();
