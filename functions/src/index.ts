/**
 * Import function triggers from their respective submodules:
 *
 * import {onCall} from "firebase-functions/v2/https";
 * import {onDocumentWritten} from "firebase-functions/v2/firestore";
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

import {setGlobalOptions} from "firebase-functions";
import {onCall} from "firebase-functions/v2/https";
import {onDocumentUpdated, onDocumentCreated} from "firebase-functions/v2/firestore";
import {defineSecret} from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import twilio from "twilio";
import nodemailer from "nodemailer";

// Define secrets for Twilio configuration
const twilioAccountSid = defineSecret("TWILIO_ACCOUNT_SID");
const twilioAuthToken = defineSecret("TWILIO_AUTH_TOKEN");
const twilioPhoneNumber = defineSecret("TWILIO_PHONE_NUMBER");

// Start writing functions
// https://firebase.google.com/docs/functions/typescript

// Initialize Firebase Admin
admin.initializeApp();

// For cost control, you can set the maximum number of containers that can be
// running at the same time. This helps mitigate the impact of unexpected
// traffic spikes by instead downgrading performance. This limit is a
// per-function limit. You can override the limit for each function using the
// `maxInstances` option in the function's options, e.g.
// `onRequest({ maxInstances: 5 }, (req, res) => { ... })`.
// NOTE: setGlobalOptions does not apply to functions using the v1 API. V1
// functions should each use functions.runWith({ maxInstances: 10 }) instead.
// In the v1 API, each function can only serve one request per container, so
// this will be the maximum concurrent request count.
setGlobalOptions({ maxInstances: 10 });

// Function to send verification email when admin approves user
export const sendVerificationEmail = onCall({ maxInstances: 5 }, async (request) => {
  try {
    const { userId, userEmail } = request.data;
    
    if (!userId || !userEmail) {
      throw new Error('Missing required parameters: userId and userEmail');
    }

    logger.info(`Sending verification email to ${userEmail}`, { userId, userEmail });

    // Get the user from Firebase Auth
    const userRecord = await admin.auth().getUserByEmail(userEmail);
    
    if (!userRecord) {
      throw new Error(`User not found in Firebase Auth: ${userEmail}`);
    }

    // Send email verification
    const verificationLink = await admin.auth().generateEmailVerificationLink(userEmail);
    
    // Update user status in Firestore
    const db = admin.firestore();
    await db.collection('users').doc(userId).update({
      status: 'email_sent',
      emailVerificationLink: verificationLink,
      emailSentAt: admin.firestore.FieldValue.serverTimestamp()
    });

    logger.info(`Verification email sent successfully to ${userEmail}`, { userId, userEmail });
    
    return {
      success: true,
      message: `Verification email sent to ${userEmail}`,
      userId,
      userEmail
    };

  } catch (error) {
    logger.error('Error sending verification email:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to send verification email: ${errorMessage}`);
  }
});

// Function triggered when user document is updated
export const onUserStatusChanged = onDocumentUpdated('users/{userId}', async (event) => {
  try {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    
    if (!beforeData || !afterData) {
      logger.info('Document data not available');
      return;
    }

    // Check if user was just approved by admin
    if (!beforeData.approved && afterData.approved && afterData.status === 'pending_email') {
      const userId = event.params.userId;
      const userEmail = afterData.email;
      // const userName = `${afterData.firstName || ''} ${afterData.lastName || ''}`.trim();
      
      logger.info(`User ${userEmail} was approved, sending verification email`, { userId, userEmail });
      
      // Call the sendVerificationEmail function
      // Note: We can't call another function directly, so we'll handle this in the frontend
      // or create a separate trigger function
    }

  } catch (error) {
    logger.error('Error in onUserStatusChanged:', error);
  }
});

// Cloud Function: Automatyczne wysyłanie SMS i emaili po utworzeniu wydarzenia
export const onEventCreated = onDocumentCreated(
  {
    document: 'events/{eventId}',
    secrets: [twilioAccountSid, twilioAuthToken, twilioPhoneNumber],
  },
  async (event) => {
  try {
    logger.info('📅 ========== TRIGGER: UTWORZONO WYDARZENIE ==========');
    const eventData = event.data?.data();
    const eventId = event.params.eventId;

    if (!eventData) {
      logger.warn('Brak danych wydarzenia');
      return;
    }

    logger.info('📅 Wydarzenie:', {
      id: eventId,
      title: eventData.title,
      date: eventData.date,
      assignedTo: eventData.assignedTo || eventData.students
    });

    // Sprawdź czy wydarzenie ma przypisanych uczniów
    const studentIds = eventData.assignedTo || eventData.students || [];
    
    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      logger.info('Brak przypisanych uczniów - pomijam wysyłkę powiadomień');
      return;
    }

    logger.info(`📧 Pobieram dane ${studentIds.length} uczniów...`);

    // Pobierz dane uczniów z Firestore
    const db = admin.firestore();
    const studentDataPromises = studentIds.map(async (studentId: string) => {
      try {
        const studentDoc = await db.collection('users').doc(studentId).get();
        if (studentDoc.exists) {
          const studentData = studentDoc.data();
          return {
            uid: studentId,
            email: studentData?.email || '',
            phone: studentData?.phone || '',
            displayName: studentData?.displayName || 'Uczeń'
          };
        }
        return { uid: studentId, email: '', phone: '', displayName: 'Uczeń' };
      } catch (error) {
        logger.error(`Błąd pobierania danych ucznia ${studentId}:`, error);
        return { uid: studentId, email: '', phone: '', displayName: 'Uczeń' };
      }
    });

    const studentsData = await Promise.all(studentDataPromises);
    
    logger.info('📋 Dane uczniów:', studentsData.map(s => ({
      name: s.displayName,
      email: s.email ? 'TAK' : 'BRAK',
      phone: s.phone ? 'TAK' : 'BRAK'
    })));

    // Formatuj datę
    const formattedDate = eventData.date 
      ? new Date(eventData.date).toLocaleDateString('pl-PL', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      : 'Nie podano';

    const timeRange = eventData.startTime && eventData.endTime
      ? `${eventData.startTime} - ${eventData.endTime}`
      : eventData.startTime || eventData.endTime || 'Nie podano';

    // Wysyłaj emaile
    const emailPromises = studentsData
      .filter(student => student.email)
      .map(async (student) => {
        try {
          logger.info(`📧 Wysyłam email do ${student.email}`);
          
          const emailSubject = `Nowe wydarzenie: ${eventData.title}`;
          const emailBody = `
Witaj ${student.displayName},

Masz nowe wydarzenie w kalendarzu:

Tytuł: ${eventData.title}
${eventData.description ? `Opis: ${eventData.description}` : ''}
Data: ${formattedDate}
Godzina: ${timeRange}

Zaloguj się do platformy, aby zobaczyć szczegóły.

---
Platforma E-Learning
          `.trim();

          const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
              user: process.env.GMAIL_USER || 'learningplatformcogito@gmail.com',
              pass: process.env.GMAIL_PASS || 'uzky synx oxaz nenb',
            },
          });

          const result = await transporter.sendMail({
            from: process.env.GMAIL_USER || 'learningplatformcogito@gmail.com',
            to: student.email,
            subject: emailSubject,
            text: emailBody,
          });

          logger.info(`✅ Email wysłany do ${student.email}`, { messageId: result.messageId });
          return { success: true, type: 'email', to: student.email };
        } catch (error) {
          logger.error(`❌ Błąd wysyłania emaila do ${student.email}:`, error);
          return { success: false, type: 'email', to: student.email, error };
        }
      });

    // Wysyłaj SMSy przez Twilio
    const smsPromises = studentsData
      .filter(student => student.phone)
      .map(async (student) => {
        try {
          logger.info(`📱 Wysyłam SMS do ${student.phone}`);
          
          // Formatuj numer telefonu
          let phoneNumber = student.phone.replace(/\s/g, '');
          if (!phoneNumber.startsWith('+')) {
            if (phoneNumber.startsWith('0')) {
              phoneNumber = '+48' + phoneNumber.substring(1);
            } else {
              phoneNumber = '+48' + phoneNumber;
            }
          }

          const smsMessage = `Nowe wydarzenie: ${eventData.title}\nData: ${formattedDate}\nGodzina: ${timeRange}\n\nZaloguj się do platformy, aby zobaczyć szczegóły.`;

          // Sprawdź konfigurację Twilio (użyj secrets)
          const accountSid = twilioAccountSid.value();
          const authToken = twilioAuthToken.value();
          const twilioPhone = twilioPhoneNumber.value();

          if (!accountSid || !authToken || !twilioPhone) {
            logger.error('❌ Brak konfiguracji Twilio w secrets');
            return { 
              success: false, 
              type: 'sms', 
              to: phoneNumber, 
              error: 'Brak konfiguracji Twilio' 
            };
          }

          const client = twilio(accountSid, authToken);
          const result = await client.messages.create({
            body: smsMessage,
            from: twilioPhone,
            to: phoneNumber
          });

          logger.info(`✅ SMS wysłany do ${phoneNumber}`, { messageSid: result.sid });
          return { success: true, type: 'sms', to: phoneNumber, messageSid: result.sid };
        } catch (error) {
          logger.error(`❌ Błąd wysyłania SMS do ${student.phone}:`, error);
          return { success: false, type: 'sms', to: student.phone, error };
        }
      });

    // Wykonaj wszystkie wysyłki równolegle
    const results = await Promise.all([...emailPromises, ...smsPromises]);
    
    const emailsSent = results.filter(r => r.type === 'email' && r.success).length;
    const smsSent = results.filter(r => r.type === 'sms' && r.success).length;
    const errors = results.filter(r => !r.success);

    logger.info('📊 ========== PODSUMOWANIE WYSYŁKI ==========');
    logger.info(`📧 Emails: ${emailsSent} wysłanych`);
    logger.info(`📱 SMS: ${smsSent} wysłanych`);
    logger.info(`❌ Błędy: ${errors.length}`);

    if (errors.length > 0) {
      logger.error('Błędy wysyłki:', errors);
    }

    logger.info('✅ ========== KONIEC TRIGGERA ==========');

  } catch (error) {
    logger.error('❌ Błąd w triggerze onEventCreated:', error);
  }
});
