const Notification = require('../models/Notification');
const User = require('../models/User');

// ──────────────────────────────────
// Initialize SDK clients once at module load time (NOT on every call)
// ──────────────────────────────────
const twilioClient = (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
  ? require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

let firebaseAdmin = null;
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
  try {
    firebaseAdmin = require('firebase-admin');
    if (!firebaseAdmin.apps.length) {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }
  } catch (e) {
    console.warn('[PUSH] Firebase admin init failed:', e.message);
    firebaseAdmin = null;
  }
}

// ──────────────────────────────────
// Twilio SMS
// ──────────────────────────────────
const sendSMS = async (phone, content) => {
  try {
    if (!twilioClient) {
      console.warn(`[SMS] Simulation Mode: Twilio not configured. To: ${phone}, Text: ${content}`);
      return { success: true, sid: 'sim_sms_' + Date.now() };
    }
    const message = await twilioClient.messages.create({
      body: content,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phone,
    });
    console.log(`[SMS] Sent to ${phone}: SID ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (error) {
    console.error(`[SMS] Failed to send to ${phone}:`, error.message);
    return { success: false, error: error.message };
  }
};

const sendPush = async (fcmToken, title, content) => {
  try {
    if (!firebaseAdmin) {
      console.warn(`[PUSH] Simulation Mode: Firebase not configured. Title: ${title}`);
      return { success: true, messageId: 'sim_push_' + Date.now() };
    }
    const response = await firebaseAdmin.messaging().send({
      token: fcmToken,
      notification: { title, body: content },
    });
    console.log(`[PUSH] Sent: ${response}`);
    return { success: true, messageId: response };
  } catch (error) {
    console.error(`[PUSH] Failed:`, error.message);
    return { success: false, error: error.message };
  }
};

// ──────────────────────────────────
// SMTP Email
// ──────────────────────────────────
const sendEmail = async (email, title, content) => {
  try {
    const nodemailer = require('nodemailer');
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
      console.warn(`[EMAIL] Simulation Mode: SMTP Host missing. To: ${email}, Subject: ${title}`);
      return { success: true, messageId: 'sim_mail_' + Date.now() };
    }
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT, 10),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: email,
      subject: title,
      text: content,
      html: `<div style="font-family:sans-serif;padding:20px;">
        <h2 style="color:#2d6a4f;">🌾 SCAS Advisory</h2>
        <p>${content}</p>
        <hr/>
        <small style="color:#888;">Smart Crop Advisory System — Government of India</small>
      </div>`,
    });

    console.log(`[EMAIL] Sent to ${email}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`[EMAIL] Failed to send to ${email}:`, error.message);
    return { success: false, error: error.message };
  }
};

// ──────────────────────────────────
// Unified Notification Dispatcher
// ──────────────────────────────────
/**
 * @param {ObjectId} userId - The recipient user ID
 * @param {string} channel - 'sms' | 'push' | 'email'
 * @param {string} title - Notification title
 * @param {string} content - Notification body text
 * @param {ObjectId|null} ticketRef - Optional ticket reference
 */
const sendNotification = async (userId, channel, title, content, ticketRef = null) => {
  const user = await User.findById(userId);
  if (!user) {
    console.error(`[NOTIFY] User ${userId} not found`);
    return;
  }

  // Create notification record
  const notification = await Notification.create({
    recipient: userId,
    channel,
    title,
    content,
    ticketRef,
    status: 'pending',
  });

  let result;

  try {
    switch (channel) {
      case 'sms':
        result = await sendSMS(user.phone, `${title}: ${content}`);
        break;
      case 'push':
        if (user.fcmToken) {
          result = await sendPush(user.fcmToken, title, content);
        } else {
          result = { success: false, error: 'No FCM token registered' };
        }
        break;
      case 'email':
        if (user.email) {
          result = await sendEmail(user.email, title, content);
        } else {
          result = { success: false, error: 'No email registered' };
        }
        break;
      default:
        result = { success: false, error: `Unknown channel: ${channel}` };
    }

    notification.status = result.success ? 'sent' : 'failed';
    notification.metadata = result;
    if (!result.success) notification.errorLog = result.error;
    await notification.save();
  } catch (error) {
    notification.status = 'failed';
    notification.errorLog = error.message;
    await notification.save();
  }

  return notification;
};

module.exports = {
  sendSMS,
  sendPush,
  sendEmail,
  sendNotification,
};
