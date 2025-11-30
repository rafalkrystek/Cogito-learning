# 🔥 Konfiguracja Firebase Cloud Functions - Automatyczne powiadomienia SMS i Email

## 📋 Przegląd

System powiadomień działa **automatycznie przez Firebase Cloud Functions**. Po utworzeniu wydarzenia w kalendarzu, Cloud Function automatycznie:
- ✅ Wysyła email do przypisanych uczniów
- ✅ Wysyła SMS do przypisanych uczniów (jeśli mają numer telefonu)

**Nie wymaga żadnej konfiguracji na froncie!** Wszystko dzieje się automatycznie w chmurze.

## 🚀 Jak to działa

1. **Nauczyciel tworzy wydarzenie** w kalendarzu (przez `CreateEvent` lub szybki formularz)
2. **Wydarzenie jest zapisywane** w kolekcji `events` w Firestore
3. **Firebase Cloud Function** (`onEventCreated`) automatycznie się uruchamia (trigger: `onDocumentCreated`)
4. **Function pobiera dane uczniów** z Firestore (email i telefon)
5. **Function wysyła email i SMS** do wszystkich przypisanych uczniów

## ⚙️ Konfiguracja

### 1. Zainstaluj zależności w Cloud Functions

```bash
cd functions
npm install
```

### 2. Skonfiguruj zmienne środowiskowe w Firebase

Musisz ustawić zmienne środowiskowe w Firebase Console lub przez CLI:

#### Opcja A: Przez Firebase Console
1. Przejdź do [Firebase Console](https://console.firebase.google.com/)
2. Wybierz projekt
3. Przejdź do **Functions** → **Config**
4. Dodaj zmienne:
   - `TWILIO_ACCOUNT_SID` - Twój Account SID z Twilio
   - `TWILIO_AUTH_TOKEN` - Twój Auth Token z Twilio
   - `TWILIO_PHONE_NUMBER` - Numer telefonu Twilio (format: `+48123456789`)
   - `GMAIL_USER` - Adres email Gmail (opcjonalnie, domyślnie używa `learningplatformcogito@gmail.com`)
   - `GMAIL_PASS` - Hasło aplikacji Gmail (opcjonalnie)

#### Opcja B: Przez Firebase CLI

```bash
firebase functions:config:set \
  twilio.account_sid="ACtwoj_account_sid" \
  twilio.auth_token="twoj_auth_token" \
  twilio.phone_number="+48123456789" \
  gmail.user="learningplatformcogito@gmail.com" \
  gmail.pass="uzky synx oxaz nenb"
```

**Uwaga:** W Firebase Functions v2 używa się `process.env` zamiast `functions.config()`, więc zmienne muszą być ustawione jako secrets lub environment variables.

#### Opcja C: Użyj Firebase Secrets (Zalecane dla produkcji)

```bash
# Ustaw secrets
firebase functions:secrets:set TWILIO_ACCOUNT_SID
firebase functions:secrets:set TWILIO_AUTH_TOKEN
firebase functions:secrets:set TWILIO_PHONE_NUMBER
firebase functions:secrets:set GMAIL_USER
firebase functions:secrets:set GMAIL_PASS
```

Następnie w `functions/src/index.ts` użyj:
```typescript
import { defineSecret } from "firebase-functions/params";

const twilioAccountSid = defineSecret("TWILIO_ACCOUNT_SID");
const twilioAuthToken = defineSecret("TWILIO_AUTH_TOKEN");
const twilioPhoneNumber = defineSecret("TWILIO_PHONE_NUMBER");
```

I w funkcji:
```typescript
export const onEventCreated = onDocumentCreated({
  secrets: [twilioAccountSid, twilioAuthToken, twilioPhoneNumber],
}, 'events/{eventId}', async (event) => {
  const accountSid = twilioAccountSid.value();
  // ...
});
```

### 3. Zbuduj i wdróż Cloud Functions

```bash
cd functions
npm run build
firebase deploy --only functions
```

## 📝 Struktura kodu

### Cloud Function: `onEventCreated`

**Lokalizacja:** `functions/src/index.ts`

**Trigger:** `onDocumentCreated('events/{eventId}')`

**Co robi:**
1. Nasłuchuje na utworzenie nowego dokumentu w kolekcji `events`
2. Pobiera dane wydarzenia
3. Sprawdza czy są przypisani uczniowie (`assignedTo` lub `students`)
4. Pobiera dane uczniów z Firestore (email i telefon)
5. Wysyła email do uczniów z adresem email
6. Wysyła SMS do uczniów z numerem telefonu

## 🔍 Debugowanie

### Sprawdź logi Cloud Functions

```bash
firebase functions:log
```

Lub w Firebase Console:
1. Przejdź do **Functions** → **Logs**
2. Filtruj po `onEventCreated`

### Typowe problemy

#### Problem: "Brak konfiguracji Twilio"
**Rozwiązanie:** Upewnij się, że zmienne środowiskowe są ustawione w Firebase

#### Problem: "Email nie wysyła się"
**Rozwiązanie:** 
- Sprawdź logi Cloud Functions
- Upewnij się, że `GMAIL_USER` i `GMAIL_PASS` są poprawne
- Użyj hasła aplikacji Gmail, nie zwykłego hasła

#### Problem: "SMS nie wysyła się"
**Rozwiązanie:**
- Sprawdź logi Cloud Functions
- Upewnij się, że wszystkie zmienne Twilio są ustawione
- W wersji trial Twilio możesz wysyłać tylko do zweryfikowanych numerów

## 📊 Monitoring

W Firebase Console możesz monitorować:
- **Liczbę wywołań funkcji**
- **Czas wykonania**
- **Błędy**
- **Koszty**

## 💰 Koszty

- **Firebase Functions:** Darmowe do 2 milionów wywołań/miesiąc
- **Twilio SMS:** Około $0.0075 (0.03 PLN) za SMS w Polsce
- **Gmail SMTP:** Darmowe do 500 emaili dziennie

## 🔒 Bezpieczeństwo

- ✅ Klucze API są przechowywane bezpiecznie w Firebase (secrets)
- ✅ Nie są dostępne w kodzie frontendowym
- ✅ Cloud Functions działają w izolowanym środowisku
- ✅ Automatyczne skalowanie i zarządzanie

## 📚 Dokumentacja

- [Firebase Cloud Functions](https://firebase.google.com/docs/functions)
- [Firestore Triggers](https://firebase.google.com/docs/functions/firestore-events)
- [Twilio Node.js SDK](https://www.twilio.com/docs/libraries/node)
- [Nodemailer](https://nodemailer.com/)

