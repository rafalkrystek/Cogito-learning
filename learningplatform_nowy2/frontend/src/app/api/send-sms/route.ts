import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';

/**
 * Endpoint do wysyłania SMS przez Twilio
 * 
 * Wymaga konfiguracji zmiennych środowiskowych w .env.local:
 * - TWILIO_ACCOUNT_SID - Twój Account SID z Twilio
 * - TWILIO_AUTH_TOKEN - Twój Auth Token z Twilio
 * - TWILIO_PHONE_NUMBER - Numer telefonu Twilio (format: +48123456789)
 * 
 * Jeśli zmienne nie są ustawione, endpoint zwróci błąd.
 */
export async function POST(request: NextRequest) {
  console.log('📱 ========== ENDPOINT SMS - START ==========');
  console.log('📱 Czas:', new Date().toISOString());
  
  try {
    const body = await request.json();
    console.log('📱 Otrzymane dane:', { to: body.to, messageLength: body.message?.length || 0 });
    const { to, message } = body;

    if (!to || !message) {
      console.error('❌ Brak wymaganych pól:', { to: !!to, message: !!message });
      return NextResponse.json(
        { error: 'Brak wymaganych pól: to, message' },
        { status: 400 }
      );
    }

    // Walidacja numeru telefonu (format: +48123456789)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    const cleanPhone = to.replace(/\s/g, '');
    console.log('📱 Numer telefonu do walidacji:', cleanPhone);
    
    if (!phoneRegex.test(cleanPhone)) {
      console.error('❌ Nieprawidłowy format numeru telefonu:', cleanPhone);
      return NextResponse.json(
        { error: 'Nieprawidłowy format numeru telefonu. Użyj formatu: +48123456789' },
        { status: 400 }
      );
    }
    console.log('✅ Numer telefonu poprawny:', cleanPhone);

    // Sprawdź czy zmienne środowiskowe są ustawione
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

    console.log('📱 Sprawdzam konfigurację Twilio:');
    console.log('   Account SID:', accountSid ? `${accountSid.substring(0, 10)}...` : 'BRAK');
    console.log('   Auth Token:', authToken ? `${authToken.substring(0, 10)}...` : 'BRAK');
    console.log('   Phone Number:', phoneNumber || 'BRAK');

    if (!accountSid || !authToken || !phoneNumber) {
      console.error('❌ ========== BRAK KONFIGURACJI TWILIO ==========');
      console.error('❌ Account SID:', !accountSid ? 'BRAK' : 'OK');
      console.error('❌ Auth Token:', !authToken ? 'BRAK' : 'OK');
      console.error('❌ Phone Number:', !phoneNumber ? 'BRAK' : 'OK');
      console.error('❌ Sprawdź plik .env.local w katalogu frontend/');
      return NextResponse.json(
        { 
          error: 'Brak konfiguracji Twilio',
          details: 'Ustaw zmienne środowiskowe: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER'
        },
        { status: 500 }
      );
    }

    // Inicjalizuj klienta Twilio
    console.log('📱 Inicjalizuję klienta Twilio...');
    const client = twilio(accountSid, authToken);
    console.log('✅ Klient Twilio zainicjalizowany');

    // Wyślij SMS
    console.log('📱 Wysyłam SMS:');
    console.log('   Od:', phoneNumber);
    console.log('   Do:', cleanPhone);
    console.log('   Treść:', message.substring(0, 50) + '...');
    
    const result = await client.messages.create({
      body: message,
      from: phoneNumber,
      to: cleanPhone
    });

    console.log('✅ ========== SMS WYSŁANY POMYŚLNIE ==========');
    console.log('✅ Message SID:', result.sid);
    console.log('✅ Status:', result.status);
    console.log('✅ Do:', cleanPhone);
    console.log('📱 ========== ENDPOINT SMS - KONIEC (SUKCES) ==========');
    
    return NextResponse.json({
      success: true,
      message: 'SMS został wysłany pomyślnie',
      messageId: result.sid,
      to: cleanPhone,
      status: result.status
    });

  } catch (error) {
    console.error('❌ ========== BŁĄD WYSYŁANIA SMS ==========');
    console.error('❌ Czas błędu:', new Date().toISOString());
    console.error('❌ Typ błędu:', error instanceof Error ? error.constructor.name : typeof error);
    
    // Obsługa błędów Twilio
    if (error instanceof Error) {
      console.error('❌ Nazwa błędu:', error.name);
      console.error('❌ Wiadomość błędu:', error.message);
      console.error('❌ Stack trace:', error.stack);
      
      // Sprawdź czy to błąd Twilio
      if (error.message.includes('Twilio') || error.name === 'TwilioError') {
        console.error('❌ To jest błąd Twilio');
        return NextResponse.json(
          { 
            error: 'Błąd Twilio',
            details: error.message,
            name: error.name
          },
          { status: 500 }
        );
      }
      
      // Sprawdź typowe błędy Twilio
      if (error.message.includes('20003') || error.message.includes('Authenticate')) {
        console.error('❌ Błąd autoryzacji Twilio - sprawdź Account SID i Auth Token');
        return NextResponse.json(
          { 
            error: 'Błąd autoryzacji Twilio',
            details: 'Sprawdź czy Account SID i Auth Token są poprawne'
          },
          { status: 500 }
        );
      }
      
      if (error.message.includes('21211') || error.message.includes('Invalid')) {
        console.error('❌ Nieprawidłowy numer telefonu');
        return NextResponse.json(
          { 
            error: 'Nieprawidłowy numer telefonu',
            details: error.message
          },
          { status: 400 }
        );
      }
      
      console.error('❌ Nieznany błąd');
      return NextResponse.json(
        { 
          error: 'Błąd wysyłania SMS',
          details: error.message,
          name: error.name
        },
        { status: 500 }
      );
    }
    
    console.error('❌ Błąd nie jest instancją Error:', error);
    return NextResponse.json(
      { 
        error: 'Błąd wysyłania SMS',
        details: String(error)
      },
      { status: 500 }
    );
  }
}

