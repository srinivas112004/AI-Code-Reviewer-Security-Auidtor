"""
Email Service - SMTP-based email sending for OTP verification and password reset.
Supports Gmail, Outlook, and custom SMTP servers.
"""

import os
import smtplib
import random
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


def get_smtp_config():
    """Read SMTP configuration from environment variables."""
    return {
        'host': os.environ.get('SMTP_HOST', 'smtp.gmail.com'),
        'port': int(os.environ.get('SMTP_PORT', 587)),
        'username': os.environ.get('SMTP_USERNAME', ''),
        'password': os.environ.get('SMTP_PASSWORD', ''),
        'from_email': os.environ.get('SMTP_FROM_EMAIL', ''),
        'from_name': os.environ.get('SMTP_FROM_NAME', 'AI Code Reviewer'),
        'use_tls': os.environ.get('SMTP_USE_TLS', 'true').lower() == 'true',
    }


def is_smtp_configured():
    """Check if SMTP is properly configured."""
    cfg = get_smtp_config()
    return bool(cfg['host'] and cfg['username'] and cfg['password'] and cfg['from_email'])


def generate_otp(length=6):
    """Generate a random numeric OTP."""
    return ''.join([str(random.randint(0, 9)) for _ in range(length)])


def _build_otp_email(to_email, otp, purpose="verification"):
    """Build a styled HTML email with OTP."""
    cfg = get_smtp_config()

    if purpose == "password_reset":
        subject = "Password Reset Code - AI Code Reviewer And Security Auditor"
        heading = "Password Reset Request"
        intro = "We received a request to reset your password. Use the code below to proceed:"
        footer_note = "If you didn't request a password reset, you can safely ignore this email."
    else:
        subject = "Verify Your Email - AI Code Reviewer And Security Auditor"
        heading = "Email Verification"
        intro = "Welcome! Please use the code below to verify your email address:"
        footer_note = "If you didn't create an account, you can safely ignore this email."

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin:0;padding:0;background-color:#0a0b14;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0b14;padding:40px 20px;">
        <tr>
          <td align="center">
            <table width="480" cellpadding="0" cellspacing="0" style="background:linear-gradient(180deg,rgba(255,255,255,0.12),rgba(255,255,255,0.05));border:1px solid rgba(255,255,255,0.2);border-radius:16px;overflow:hidden;">
              <!-- Header -->
              <tr>
                <td style="padding:32px 32px 0;text-align:center;">
                  <div style="display:inline-block;width:48px;height:48px;background:linear-gradient(135deg,#6366f1,#8b5cf6,#7c3aed);border-radius:12px;line-height:48px;text-align:center;">
                    <span style="color:#fff;font-weight:bold;font-size:16px;font-style:italic;">Ai</span>
                  </div>
                  <h1 style="color:#ffffff;font-size:22px;margin:16px 0 4px;font-weight:700;">{heading}</h1>
                  <p style="color:#9ca3af;font-size:14px;margin:0 0 24px;">{intro}</p>
                </td>
              </tr>
              <!-- OTP Code -->
              <tr>
                <td style="padding:0 32px;">
                  <div style="background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);border-radius:12px;padding:24px;text-align:center;">
                    <span style="font-family:'Courier New',monospace;font-size:36px;font-weight:bold;letter-spacing:12px;color:#a5b4fc;">{otp}</span>
                  </div>
                </td>
              </tr>
              <!-- Expiry Note -->
              <tr>
                <td style="padding:16px 32px 0;text-align:center;">
                  <p style="color:#f59e0b;font-size:13px;margin:0;">
                    ⏱ This code expires in <strong>15 minutes</strong>
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="padding:24px 32px 32px;">
                  <hr style="border:none;border-top:1px solid rgba(255,255,255,0.1);margin:0 0 16px;">
                  <p style="color:#6b7280;font-size:12px;margin:0;text-align:center;">
                    {footer_note}<br><br>
                    &copy; AI Code Reviewer &amp; Security Auditor
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
    """

    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From'] = f"{cfg['from_name']} <{cfg['from_email']}>"
    msg['To'] = to_email

    # Plain text fallback
    plain = f"{heading}\n\nYour verification code is: {otp}\n\nThis code expires in 15 minutes.\n\n{footer_note}"
    msg.attach(MIMEText(plain, 'plain'))
    msg.attach(MIMEText(html, 'html'))

    return msg, subject


def send_otp_email(to_email, otp, purpose="verification"):
    """
    Send an OTP email via SMTP.
    Returns (success: bool, error_message: str or None)
    """
    cfg = get_smtp_config()

    if not is_smtp_configured():
        return False, "SMTP is not configured. Set SMTP_HOST, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM_EMAIL in your .env file."

    try:
        msg, subject = _build_otp_email(to_email, otp, purpose)

        if cfg['use_tls']:
            server = smtplib.SMTP(cfg['host'], cfg['port'], timeout=15)
            server.ehlo()
            server.starttls()
            server.ehlo()
        else:
            server = smtplib.SMTP_SSL(cfg['host'], cfg['port'], timeout=15)

        server.login(cfg['username'], cfg['password'])
        server.sendmail(cfg['from_email'], to_email, msg.as_string())
        server.quit()

        return True, None

    except smtplib.SMTPAuthenticationError:
        return False, "SMTP authentication failed. Check your SMTP_USERNAME and SMTP_PASSWORD. For Gmail, use an App Password."
    except smtplib.SMTPConnectError:
        return False, f"Could not connect to SMTP server {cfg['host']}:{cfg['port']}"
    except smtplib.SMTPException as e:
        return False, f"SMTP error: {str(e)}"
    except Exception as e:
        return False, f"Email sending failed: {str(e)}"
