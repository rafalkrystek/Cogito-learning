# 🚀 Wdrożenie Cloud Functions - Krok po kroku

## ⚠️ Problem: SMS nie są wysyłane

Cloud Function **nie jest jeszcze wdrożona** na Firebase. Musisz ją wdrożyć, aby działała automatycznie.

## 📋 Krok po kroku:

### 1. Napraw błąd w tsconfig.json

Otwórz `functions/tsconfig.json` i zmień:

```json
{
  "compilerOptions": {
    "module": "commonjs",  // ← zmień na "NodeNext"
    "moduleResolution": "NodeNext"
  }
}
```

Na:

```json
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

### 2. Ustaw projekt Firebase

```bash
cd functions
firebase use cogito-8443e
# lub
firebase use --add
```

### 3. Skonfiguruj zmienne środowiskowe (Secrets)

**Opcja A: Przez Firebase Console (Zalecane)**
1. Przejdź do [Firebase Console](https://console.firebase.google.com/)
2. Wybierz projekt `cogito-8443e`
3. Przejdź do **Functions** → **Secrets**
4. Dodaj secrets:
   - `TWILIO_ACCOUNT_SID` - Twój Account SID z Twilio
   - `TWILIO_AUTH_TOKEN` - Twój Auth Token z Twilio
   - `TWILIO_PHONE_NUMBER` - Numer telefonu Twilio (format: `+48123456789`)

**Opcja B: Przez Firebase CLI**

```bash
firebase functions:secrets:set TWILIO_ACCOUNT_SID
# Wprowadź wartość gdy zostaniesz poproszony

firebase functions:secrets:set TWILIO_AUTH_TOKEN
# Wprowadź wartość gdy zostaniesz poproszony

firebase functions:secrets:set TWILIO_PHONE_NUMBER
# Wprowadź wartość gdy zostaniesz poproszony
```

### 4. Zaktualizuj kod Cloud Function do używania secrets

Otwórz `functions/src/index.ts` i zmień:

```typescript
import { defineSecret } from "firebase-functions/params";

const twilioAccountSid = defineSecret("TWILIO_ACCOUNT_SID");
const twilioAuthToken = defineSecret("TWILIO_AUTH_TOKEN");
const twilioPhoneNumber = defineSecret("TWILIO_PHONE_NUMBER");
```

I w funkcji `onEventCreated`:

```typescript
export const onEventCreated = onDocumentCreated({
  secrets: [twilioAccountSid, twilioAuthToken, twilioPhoneNumber],
}, 'events/{eventId}', async (event) => {
  // ...
  const accountSid = twilioAccountSid.value();
  const authToken = twilioAuthToken.value();
  const twilioPhone = twilioPhoneNumber.value();
  // ...
});
```

### 5. Zbuduj funkcję

```bash
cd functions
npm run build
```

### 6. Wdróż funkcję

```bash
firebase deploy --only functions:onEventCreated
```

Lub wdróż wszystkie funkcje:

```bash
firebase deploy --only functions
```

### 7. Sprawdź logi

Po utworzeniu wydarzenia, sprawdź logi:

```bash
firebase functions:log
```

Lub w Firebase Console:
1. Przejdź do **Functions** → **Logs**
2. Filtruj po `onEventCreated`

## 🔍 Debugowanie

### Problem: "Brak konfiguracji Twilio"

**Rozwiązanie:** Upewnij się, że secrets są ustawione i funkcja używa ich poprawnie.

### Problem: "Function nie uruchamia się"

**Rozwiązanie:**
1. Sprawdź czy funkcja jest wdrożona: `firebase functions:list`
2. Sprawdź logi: `firebase functions:log`
3. Sprawdź czy wydarzenie ma pole `assignedTo` lub `students` z tablicą ID uczniów

### Problem: "SMS nie wysyła się"

**Rozwiązanie:**
1. Sprawdź logi Cloud Functions
2. Upewnij się, że numer telefonu ucznia jest w formacie `+48123456789`
3. W wersji trial Twilio możesz wysyłać tylko do zweryfikowanych numerów

## ✅ Testowanie

1. Utwórz nowe wydarzenie w kalendarzu
2. Sprawdź logi Cloud Functions
3. Powinieneś zobaczyć:
   - `📅 ========== TRIGGER: UTWORZONO WYDARZENIE ==========`
   - `📧 Wysyłam email do ...`
   - `📱 Wysyłam SMS do ...`
   - `✅ Email wysłany do ...`
   - `✅ SMS wysłany do ...`

## 📞 Potrzebujesz pomocy?

- Sprawdź logi: `firebase functions:log`
- Sprawdź dokumentację: `FIREBASE_CLOUD_FUNCTIONS_SETUP.md`
- Sprawdź Firebase Console → Functions → Logs

