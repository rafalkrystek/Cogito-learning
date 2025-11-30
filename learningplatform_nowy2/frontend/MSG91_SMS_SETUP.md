# 📱 Konfiguracja SMS przez MSG91 Firebase Extension

## ✅ Dlaczego MSG91 Extension?

- ✅ **Działa tylko przez Firebase** - bez zewnętrznych API
- ✅ **Automatyczna integracja** - nie wymaga własnego kodu
- ✅ **Działa przez Firestore** - tworzysz dokument, extension wysyła SMS
- ✅ **Kosztowe rozwiązanie** - tańsze niż Twilio
- ✅ **Zero konfiguracji kodu** - wszystko przez Firebase Console

## 🚀 Instalacja MSG91 Extension

### Krok 1: Zainstaluj Extension w Firebase Console

1. Przejdź do [Firebase Console](https://console.firebase.google.com/)
2. Wybierz projekt `cogito-8443e`
3. Przejdź do **Extensions** (lub **Build** → **Extensions**)
4. Kliknij **Browse Extensions** lub **Discover Extensions**
5. Wyszukaj: **"Send Messages with MSG91"**
6. Kliknij **Install**

### Krok 2: Konfiguracja Extension

Podczas instalacji musisz podać:

1. **Collection path** - kolekcja gdzie będą dokumenty SMS (np. `sms_messages`)
2. **MSG91 Auth Key** - klucz z panelu MSG91
3. **Sender ID** - ID nadawcy (opcjonalnie)

### Krok 3: Uzyskaj MSG91 Auth Key

1. Zarejestruj się na [MSG91](https://msg91.com/)
2. Zaloguj się do panelu MSG91
3. Przejdź do **Auth Key** (z menu użytkownika)
4. Wprowadź zarejestrowany numer telefonu i zweryfikuj OTP
5. Kliknij **Create New**
6. Nazwij Auth Key (bez znaków specjalnych)
7. Wybierz "where are you integrating" → Firebase
8. Skopiuj utworzony klucz

## 📝 Jak to działa

### Wysyłanie SMS przez Firestore:

```typescript
// W komponencie CreateEvent.tsx lub Calendar.tsx
import { collection, addDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

// Po utworzeniu wydarzenia, wyślij SMS:
const sendSMS = async (phoneNumber: string, message: string) => {
  await addDoc(collection(db, 'sms_messages'), {
    to: phoneNumber,        // Numer telefonu (format: +48123456789)
    message: message,       // Treść SMS
    status: 'pending'       // Status (opcjonalnie)
  });
  
  // Extension automatycznie:
  // 1. Wysyła SMS przez MSG91
  // 2. Aktualizuje dokument ze statusem (sent/failed)
};
```

## 🔧 Integracja z naszym kodem

### Zaktualizuj Cloud Function:

Zamiast wysyłać SMS bezpośrednio przez Twilio, Cloud Function będzie tworzyć dokumenty w kolekcji `sms_messages`, a MSG91 Extension automatycznie je wyśle.

### Przykład użycia:

```typescript
// W functions/src/index.ts
export const onEventCreated = onDocumentCreated(
  {
    document: 'events/{eventId}',
  },
  async (event) => {
    // ... pobierz dane uczniów ...
    
    // Zamiast wysyłać SMS przez Twilio, tworzymy dokumenty:
    const smsPromises = studentsData
      .filter(student => student.phone)
      .map(async (student) => {
        const phoneNumber = formatPhoneNumber(student.phone);
        const smsMessage = `Nowe wydarzenie: ${eventData.title}\nData: ${formattedDate}\nGodzina: ${timeRange}`;
        
        // Utwórz dokument w kolekcji sms_messages
        await db.collection('sms_messages').add({
          to: phoneNumber,
          message: smsMessage,
          status: 'pending',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      });
    
    await Promise.all(smsPromises);
  }
);
```

## 💰 Koszty

- **MSG91**: Około $0.002-0.005 za SMS (tańsze niż Twilio)
- **Firebase Extension**: Darmowe (tylko koszty Firestore i Functions)
- **Firestore**: Darmowe do 50k operacji dziennie

## ✅ Zalety MSG91 Extension

1. **Zero kodu** - wszystko przez Firestore
2. **Automatyczne** - extension obsługuje wysyłkę
3. **Status tracking** - dokument jest aktualizowany ze statusem
4. **Tańsze** - niż Twilio
5. **Zintegrowane z Firebase** - nie wymaga zewnętrznych API

## 📚 Dokumentacja

- [MSG91 Extension](https://extensions.dev/extensions/msg91/msg91-send-msg)
- [MSG91 Panel](https://msg91.com/)
- [Firebase Extensions](https://firebase.google.com/products/extensions)

## 🔄 Migracja z Twilio

1. **Usuń Twilio z Cloud Functions** - nie potrzebujemy już Twilio SDK
2. **Zainstaluj MSG91 Extension** - przez Firebase Console
3. **Zaktualizuj kod** - zamiast `twilio.messages.create()`, użyj `db.collection('sms_messages').add()`
4. **Usuń secrets Twilio** - nie są już potrzebne

