# Konfiguracja Twilio do wysyłania SMS

## Instalacja

Pakiet `twilio` jest już zainstalowany w projekcie.

## Konfiguracja

1. **Utwórz konto w Twilio** (jeśli jeszcze nie masz):
   - Przejdź na https://www.twilio.com/
   - Zarejestruj się i zweryfikuj konto
   - Uzyskaj numer telefonu do wysyłania SMS

2. **Pobierz dane dostępowe**:
   - Zaloguj się do konsoli Twilio: https://console.twilio.com/
   - Przejdź do **Account** → **API Keys & Tokens**
   - Skopiuj:
     - **Account SID**
     - **Auth Token**

3. **Utwórz plik `.env.local`** w katalogu `frontend/`:
   ```env
   TWILIO_ACCOUNT_SID=your_account_sid_here
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_PHONE_NUMBER=+48123456789
   ```
   
   **Uwaga**: 
   - Zastąp `your_account_sid_here`, `your_auth_token_here` i `+48123456789` prawdziwymi wartościami
   - Numer telefonu musi być w formacie międzynarodowym z `+` (np. `+48123456789` dla Polski)
   - Plik `.env.local` jest ignorowany przez git i nie będzie commitowany

4. **Uruchom ponownie serwer deweloperski**:
   ```bash
   npm run dev
   ```

## Testowanie

Po utworzeniu wydarzenia w kalendarzu przez nauczyciela (`http://localhost:3000/homelogin/teacher/calendar`), uczniowie z numerem telefonu w profilu powinni otrzymać SMS.

## Rozwiązywanie problemów

### Błąd: "Brak konfiguracji Twilio"
- Sprawdź czy plik `.env.local` istnieje w katalogu `frontend/`
- Sprawdź czy wszystkie trzy zmienne są ustawione
- Uruchom ponownie serwer deweloperski po dodaniu zmiennych

### Błąd: "Invalid phone number"
- Upewnij się, że numer telefonu w `.env.local` jest w formacie międzynarodowym z `+` (np. `+48123456789`)
- Sprawdź czy numer telefonu ucznia w bazie danych jest w poprawnym formacie

### SMS nie docierają
- Sprawdź w konsoli Twilio czy wiadomości są wysyłane (https://console.twilio.com/us1/monitor/logs/sms)
- Sprawdź czy masz wystarczające środki na koncie Twilio
- Sprawdź czy numer telefonu odbiorcy jest zweryfikowany (w wersji trial Twilio możesz wysyłać tylko do zweryfikowanych numerów)

## Koszty

Twilio oferuje darmowy okres próbny z ograniczoną liczbą SMS. Po wyczerpaniu darmowych środków, każdy SMS kosztuje około $0.0075 (około 0.03 PLN) dla numerów w Polsce.

## Bezpieczeństwo

⚠️ **WAŻNE**: Nigdy nie commituj pliku `.env.local` z prawdziwymi danymi do repozytorium git!

Plik `.env.local` jest już dodany do `.gitignore` i nie będzie commitowany.

