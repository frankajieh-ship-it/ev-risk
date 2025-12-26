/**
 * Security Event Logger
 *
 * Logs security-relevant events for monitoring and incident response
 */

export enum SecurityEventType {
  ADMIN_LOGIN_FAILED = "admin_login_failed",
  ADMIN_LOGIN_SUCCESS = "admin_login_success",
  ADMIN_ACCESS_DENIED = "admin_access_denied",
  WEBHOOK_VERIFICATION_FAILED = "webhook_verification_failed",
  REPORT_ACCESS_DENIED = "report_access_denied",
  SUSPICIOUS_ACTIVITY = "suspicious_activity",
}

interface SecurityEvent {
  type: SecurityEventType;
  ip?: string;
  userId?: string;
  reportId?: string;
  details?: string;
  userAgent?: string;
}

class SecurityLogger {
  private logToConsole(event: SecurityEvent) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      ...event,
    };

    // In production, this would go to a logging service
    // For now, we log to console with clear security markers
    console.warn(`[SECURITY] ${timestamp}`, logEntry);
  }

  log(event: SecurityEvent) {
    this.logToConsole(event);

    // TODO: In production, send to logging service
    // - Datadog
    // - Sentry
    // - CloudWatch
    // - Or your preferred monitoring tool
  }

  logAdminLoginFailed(ip: string, details?: string) {
    this.log({
      type: SecurityEventType.ADMIN_LOGIN_FAILED,
      ip,
      details: details || "Invalid credentials",
    });
  }

  logAdminLoginSuccess(ip: string, userId: string) {
    this.log({
      type: SecurityEventType.ADMIN_LOGIN_SUCCESS,
      ip,
      userId,
    });
  }

  logAdminAccessDenied(ip: string, reason: string) {
    this.log({
      type: SecurityEventType.ADMIN_ACCESS_DENIED,
      ip,
      details: reason,
    });
  }

  logWebhookVerificationFailed(ip: string, details: string) {
    this.log({
      type: SecurityEventType.WEBHOOK_VERIFICATION_FAILED,
      ip,
      details,
    });
  }

  logReportAccessDenied(reportId: string, ip: string, reason: string) {
    this.log({
      type: SecurityEventType.REPORT_ACCESS_DENIED,
      reportId,
      ip,
      details: reason,
    });
  }

  logSuspiciousActivity(ip: string, details: string, userAgent?: string) {
    this.log({
      type: SecurityEventType.SUSPICIOUS_ACTIVITY,
      ip,
      details,
      userAgent,
    });
  }
}

export const securityLogger = new SecurityLogger();
