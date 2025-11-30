import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

/**
 * Endpoint do wysyłania emaili przez Gmail SMTP
 * 
 * Wymaga konfiguracji w kodzie (lub zmiennych środowiskowych):
 * - GMAIL_USER - Adres email Gmail
 * - GMAIL_PASS - Hasło aplikacji Gmail
 */
export async function POST(request: NextRequest) {
  console.log('📧 ========== ENDPOINT EMAIL - START ==========');
  console.log('📧 Czas:', new Date().toISOString());
  
  try {
    const formData = await request.formData();
    const to = formData.get('to') as string;
    const subject = formData.get('subject') as string;
    const body = formData.get('body') as string;
    const attachments = formData.getAll('attachments');

    console.log('📧 Otrzymane dane:', { 
      to, 
      subject, 
      bodyLength: body?.length || 0,
      attachmentsCount: attachments.length 
    });

    if (!to || !subject || !body) {
      console.error('❌ Brak wymaganych pól:', { to: !!to, subject: !!subject, body: !!body });
      return NextResponse.json(
        { error: 'Brak wymaganych pól: to, subject, body' },
        { status: 400 }
      );
    }

    // Konfiguracja Gmail SMTP
    const gmailUser = process.env.GMAIL_USER || 'learningplatformcogito@gmail.com';
    const gmailPass = process.env.GMAIL_PASS || 'uzky synx oxaz nenb';

    console.log('📧 Konfiguracja Gmail:', {
      user: gmailUser,
      pass: gmailPass ? `${gmailPass.substring(0, 4)}...` : 'BRAK'
    });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    });

    // Przygotuj załączniki jeśli są
    const emailAttachments: any[] = [];
    if (attachments.length > 0) {
      for (const attachment of attachments) {
        if (attachment instanceof File) {
          const buffer = Buffer.from(await attachment.arrayBuffer());
          emailAttachments.push({
            filename: attachment.name,
            content: buffer,
          });
        }
      }
    }

    console.log('📧 Wysyłam email:');
    console.log('   Od:', gmailUser);
    console.log('   Do:', to);
    console.log('   Temat:', subject);
    console.log('   Treść (pierwsze 50 znaków):', body.substring(0, 50) + '...');
    console.log('   Załączniki:', emailAttachments.length);

    const result = await transporter.sendMail({
      from: gmailUser,
      to,
      subject,
      text: body,
      attachments: emailAttachments,
    });

    console.log('✅ ========== EMAIL WYSŁANY POMYŚLNIE ==========');
    console.log('✅ Message ID:', result.messageId);
    console.log('✅ Do:', to);
    console.log('📧 ========== ENDPOINT EMAIL - KONIEC (SUKCES) ==========');

    return NextResponse.json({
      success: true,
      message: 'Email został wysłany pomyślnie',
      messageId: result.messageId,
      to: to
    });

  } catch (error) {
    console.error('❌ ========== BŁĄD WYSYŁANIA EMAIL ==========');
    console.error('❌ Czas błędu:', new Date().toISOString());
    console.error('❌ Typ błędu:', error instanceof Error ? error.constructor.name : typeof error);
    
    if (error instanceof Error) {
      console.error('❌ Nazwa błędu:', error.name);
      console.error('❌ Wiadomość błędu:', error.message);
      console.error('❌ Stack trace:', error.stack);
      
      // Sprawdź typowe błędy Gmail
      if (error.message.includes('Invalid login') || error.message.includes('535')) {
        console.error('❌ Błąd autoryzacji Gmail - sprawdź dane logowania');
        return NextResponse.json(
          { 
            error: 'Błąd autoryzacji Gmail',
            details: 'Sprawdź czy dane logowania są poprawne. Użyj hasła aplikacji, nie zwykłego hasła.'
          },
          { status: 500 }
        );
      }
      
      if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
        console.error('❌ Błąd połączenia z serwerem SMTP');
        return NextResponse.json(
          { 
            error: 'Błąd połączenia z serwerem SMTP',
            details: error.message
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { 
          error: 'Błąd wysyłania email',
          details: error.message,
          name: error.name
        },
        { status: 500 }
      );
    }
    
    console.error('❌ Błąd nie jest instancją Error:', error);
    return NextResponse.json(
      { 
        error: 'Błąd wysyłania email',
        details: String(error)
      },
      { status: 500 }
    );
  }
}

