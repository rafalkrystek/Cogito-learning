# ⚠️ KONFIGURACJA POWIADOMIEŃ SMS I EMAIL - WYMAGANE DZIAŁANIA

## 🔴 PROBLEM: Brak konfiguracji Twilio

Z logów wynika, że:
- ❌ **SMS nie działają** - błąd: "Brak konfiguracji Twilio"
- ⚠️ **Email może nie działać** - błąd 500

## ✅ ROZWIĄZANIE - Krok po kroku:

### 1. Utwórz plik `.env.local` w katalogu `frontend/`

Plik został już utworzony, ale musisz wypełnić prawdziwe dane Twilio.

**Lokalizacja:** `learningplatform_nowy2/frontend/.env.local`

### 2. Skonfiguruj Twilio (SMS)

#### Krok 1: Utwórz konto Twilio
1. Przejdź na https://www.twilio.com/
2. Zarejestruj się (darmowe konto trial)
3. Zweryfikuj numer telefonu (w wersji trial możesz wysyłać tylko do zweryfikowanych numerów)

#### Krok 2: Pobierz dane dostępowe
1. Zaloguj się do konsoli Twilio: https://console.twilio.com/
2. Przejdź do **Account** → **API Keys & Tokens** (lub **Dashboard**)
3. Skopiuj:
   - **Account SID** (zaczyna się od `AC...`)
   - **Auth Token** (kliknij "View" aby zobaczyć)

#### Krok 3: Uzyskaj numer telefonu Twilio
1. W konsoli Twilio przejdź do **Phone Numbers** → **Manage** → **Buy a number**
2. Wybierz numer w Polsce (lub innym kraju)
3. Skopiuj numer (format: `+48123456789`)

#### Krok 4: Wypełnij plik `.env.local`

Otwórz plik `learningplatform_nowy2/frontend/.env.local` i wypełnij:

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+48123456789
```

**Przykład:**
```env
TWILIO_ACCOUNT_SID=ACa1b2c3d4e5f6g7h8i9j0k1l2m3n4o5
TWILIO_AUTH_TOKEN=abc123def456ghi789jkl012mno345pqr
TWILIO_PHONE_NUMBER=+48123456789
```

### 3. Uruchom ponownie serwer deweloperski

⚠️ **WAŻNE:** Po dodaniu zmiennych środowiskowych MUSISZ uruchomić serwer ponownie!

```bash
# Zatrzymaj serwer (Ctrl+C)
npm run dev
```

### 4. Zweryfikuj numer telefonu ucznia (wersja trial Twilio)

W wersji trial Twilio możesz wysyłać SMS **tylko do zweryfikowanych numerów**.

1. Zaloguj się do konsoli Twilio: https://console.twilio.com/
2. Przejdź do **Phone Numbers** → **Manage** → **Verified Caller IDs**
3. Kliknij **Add a new Caller ID**
4. Wprowadź numer telefonu ucznia (np. `+48603342460`)
5. Potwierdź weryfikację przez SMS lub telefon

### 5. Sprawdź czy działa

1. Otwórz konsolę przeglądarki (F12)
2. Utwórz nowe wydarzenie
3. Sprawdź logi - powinny pokazać:
   - `✅ SMS wysłany pomyślnie do +48...`
   - `✅ Email wysłany pomyślnie do ...`

## 🔧 Rozwiązywanie problemów

### Problem: "Brak konfiguracji Twilio"
**Rozwiązanie:**
1. Sprawdź czy plik `.env.local` istnieje w `frontend/`
2. Sprawdź czy wszystkie trzy zmienne są ustawione
3. Sprawdź czy nie ma błędów w składni (bez spacji wokół `=`)
4. Uruchom ponownie serwer

### Problem: "Invalid phone number" (Twilio)
**Rozwiązanie:**
1. W wersji trial Twilio możesz wysyłać tylko do zweryfikowanych numerów
2. Zweryfikuj numer telefonu ucznia w konsoli Twilio
3. Sprawdź format numeru (musi być `+48123456789`)

### Problem: Email błąd 500
**Rozwiązanie:**
1. Sprawdź logi serwera (terminal gdzie działa `npm run dev`)
2. Sprawdź czy dane Gmail są poprawne
3. Użyj hasła aplikacji Gmail, nie zwykłego hasła

## 📋 Checklist konfiguracji

- [ ] Plik `.env.local` istnieje w `frontend/`
- [ ] `TWILIO_ACCOUNT_SID` jest wypełnione
- [ ] `TWILIO_AUTH_TOKEN` jest wypełnione
- [ ] `TWILIO_PHONE_NUMBER` jest wypełnione (format: `+48123456789`)
- [ ] Serwer został uruchomiony ponownie po dodaniu zmiennych
- [ ] Numer telefonu ucznia jest zweryfikowany w Twilio (wersja trial)
- [ ] W konsoli przeglądarki nie ma błędów "Brak konfiguracji Twilio"

## 💰 Koszty

- **Twilio Trial:** Darmowe środki do testowania
- **Twilio Paid:** Około $0.0075 (0.03 PLN) za SMS w Polsce
- **Gmail SMTP:** Darmowe do 500 emaili dziennie

## 🔒 Bezpieczeństwo

⚠️ **WAŻNE:** 
- Nigdy nie commituj pliku `.env.local` z prawdziwymi danymi
- Plik jest już w `.gitignore` i nie będzie commitowany
- W produkcji użyj zmiennych środowiskowych na serwerze

## 📞 Kontakt z Twilio

Jeśli masz problemy z konfiguracją Twilio:
- Dokumentacja: https://www.twilio.com/docs
- Support: https://support.twilio.com/

