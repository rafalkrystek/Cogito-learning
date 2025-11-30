# Konfiguracja powiadomień SMS i Email dla wydarzeń w kalendarzu

## Przegląd

System automatycznie wysyła powiadomienia SMS i email do uczniów po utworzeniu wydarzenia w kalendarzu przez nauczyciela.

## Funkcjonalności

1. **Nauczyciel tworzy wydarzenie** w kalendarzu (`/homelogin/teacher/calendar`)
2. **Wybierze uczniów**, których dotyczy wydarzenie
3. **System automatycznie**:
   - Tworzy powiadomienie w systemie
   - Wysyła email do każdego ucznia (jeśli ma email w profilu)
   - Wysyła SMS do każdego ucznia (jeśli ma numer telefonu w profilu)

## Konfiguracja

### 1. Konfiguracja Twilio (SMS)

#### Krok 1: Utwórz konto Twilio
1. Przejdź na https://www.twilio.com/
2. Zarejestruj się i zweryfikuj konto
3. Uzyskaj numer telefonu do wysyłania SMS

#### Krok 2: Pobierz dane dostępowe
1. Zaloguj się do konsoli Twilio: https://console.twilio.com/
2. Przejdź do **Account** → **API Keys & Tokens**
3. Skopiuj:
   - **Account SID**
   - **Auth Token**

#### Krok 3: Utwórz plik `.env.local`
W katalogu `frontend/` utwórz plik `.env.local`:

```env
TWILIO_ACCOUNT_SID=your_account_sid_here
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+48123456789
```

**Uwaga**: 
- Zastąp wartości prawdziwymi danymi z Twilio
- Numer telefonu musi być w formacie międzynarodowym z `+` (np. `+48123456789` dla Polski)
- Plik `.env.local` jest ignorowany przez git

#### Krok 4: Uruchom ponownie serwer
```bash
npm run dev
```

### 2. Konfiguracja Email (Gmail SMTP)

Email jest już skonfigurowany i używa Gmail SMTP. Dane dostępowe są w:
- `learningplatform_nowy2/frontend/src/pages/api/send-email.ts`

**Uwaga**: W produkcji należy przenieść dane dostępowe do zmiennych środowiskowych.

### 3. Dodawanie numeru telefonu przez ucznia

Uczeń może dodać swój numer telefonu w profilu:

1. Przejdź do `/homelogin/student/profile`
2. W sekcji "Edycja profilu" znajdź pole "Numer telefonu"
3. Wprowadź numer w formacie:
   - `+48123456789` (format międzynarodowy)
   - `123456789` (format krajowy - automatycznie dodane zostanie +48)
   - `0123456789` (format z zerem - automatycznie zamienione na +48)
4. Kliknij "Zapisz zmiany"

**Walidacja**:
- Numer musi mieć minimum 9 cyfr po kodzie kraju (+48)
- Format: `+48XXXXXXXXX` (gdzie X to 9 cyfr)

## Testowanie

### Test 1: Dodanie numeru telefonu przez ucznia
1. Zaloguj się jako uczeń
2. Przejdź do `/homelogin/student/profile`
3. Dodaj numer telefonu (np. `+48123456789`)
4. Zapisz zmiany
5. Sprawdź w konsoli Firebase czy numer został zapisany

### Test 2: Utworzenie wydarzenia przez nauczyciela
1. Zaloguj się jako nauczyciel
2. Przejdź do `/homelogin/teacher/calendar`
3. Kliknij "Rozwiń formularz"
4. Wypełnij:
   - Tytuł: "Test wydarzenia"
   - Data: wybierz datę
   - Godzina rozpoczęcia: np. 10:00
   - Godzina zakończenia: np. 11:00
   - Wybierz ucznia z numerem telefonu
5. Kliknij "Utwórz wydarzenie"
6. Sprawdź:
   - Czy uczeń otrzymał powiadomienie w systemie
   - Czy uczeń otrzymał email (jeśli ma email)
   - Czy uczeń otrzymał SMS (jeśli ma numer telefonu)

### Test 3: Sprawdzenie logów
1. Sprawdź konsolę przeglądarki (F12) - powinny być logi o wysłaniu emaili i SMS
2. Sprawdź konsolę Twilio (https://console.twilio.com/us1/monitor/logs/sms) - powinny być logi wysłanych SMS

## Rozwiązywanie problemów

### Problem: SMS nie są wysyłane
**Rozwiązanie**:
1. Sprawdź czy plik `.env.local` istnieje i zawiera poprawne dane
2. Sprawdź czy serwer został uruchomiony ponownie po dodaniu zmiennych
3. Sprawdź w konsoli przeglądarki czy są błędy
4. Sprawdź w konsoli Twilio czy są błędy
5. Sprawdź czy numer telefonu ucznia jest w poprawnym formacie

### Problem: Email nie są wysyłane
**Rozwiązanie**:
1. Sprawdź w konsoli przeglądarki czy są błędy
2. Sprawdź czy uczeń ma email w profilu
3. Sprawdź czy endpoint `/api/send-email` działa

### Problem: Numer telefonu nie jest zapisywany
**Rozwiązanie**:
1. Sprawdź w konsoli przeglądarki czy są błędy
2. Sprawdź czy format numeru jest poprawny
3. Sprawdź w konsoli Firebase czy numer został zapisany

### Problem: Błąd "Brak konfiguracji Twilio"
**Rozwiązanie**:
1. Sprawdź czy plik `.env.local` istnieje w katalogu `frontend/`
2. Sprawdź czy wszystkie trzy zmienne są ustawione:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER`
3. Uruchom ponownie serwer deweloperski

### Problem: Błąd "Invalid phone number"
**Rozwiązanie**:
1. Sprawdź czy numer telefonu w `.env.local` jest w formacie międzynarodowym z `+` (np. `+48123456789`)
2. Sprawdź czy numer telefonu ucznia w bazie danych jest w poprawnym formacie
3. Upewnij się, że numer ma minimum 9 cyfr po kodzie kraju

## Koszty

### Twilio SMS
- **Darmowy okres próbny**: Oferuje darmowe środki do testowania
- **Koszt SMS w Polsce**: Około $0.0075 (około 0.03 PLN) za SMS
- **Limit w wersji trial**: Możesz wysyłać tylko do zweryfikowanych numerów

### Email (Gmail SMTP)
- **Darmowe**: Gmail SMTP jest darmowe do 500 emaili dziennie

## Bezpieczeństwo

⚠️ **WAŻNE**: 
- Nigdy nie commituj pliku `.env.local` z prawdziwymi danymi do repozytorium git
- Plik `.env.local` jest już dodany do `.gitignore`
- W produkcji użyj zmiennych środowiskowych na serwerze (np. Vercel, Heroku)

## Struktura danych

### Pole `phone` w kolekcji `users`
- **Typ**: String
- **Format**: `+48123456789` (format międzynarodowy)
- **Walidacja**: Minimum 9 cyfr po kodzie kraju
- **Opcjonalne**: Tak (może być puste)

## Pliki związane z funkcjonalnością

- `learningplatform_nowy2/frontend/src/components/CreateEvent.tsx` - Komponent tworzenia wydarzeń
- `learningplatform_nowy2/frontend/src/app/api/send-sms/route.ts` - Endpoint wysyłania SMS
- `learningplatform_nowy2/frontend/src/pages/api/send-email.ts` - Endpoint wysyłania email
- `learningplatform_nowy2/frontend/src/app/homelogin/student/profile/page.tsx` - Profil ucznia z polem telefonu
- `learningplatform_nowy2/frontend/TWILIO_SMS_SETUP.md` - Szczegółowa dokumentacja Twilio

