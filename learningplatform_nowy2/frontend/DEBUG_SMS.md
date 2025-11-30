# Debugowanie SMS - Instrukcja

## Problem: Nie otrzymuję SMS po utworzeniu wydarzenia

### Krok 1: Sprawdź konfigurację Twilio

1. **Sprawdź czy plik `.env.local` istnieje** w katalogu `frontend/`:
   ```bash
   cd frontend
   ls -la .env.local
   ```

2. **Sprawdź zawartość pliku `.env.local`**:
   ```env
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=your_auth_token_here
   TWILIO_PHONE_NUMBER=+48123456789
   ```

3. **Upewnij się, że serwer został uruchomiony ponownie** po dodaniu zmiennych:
   ```bash
   # Zatrzymaj serwer (Ctrl+C)
   npm run dev
   ```

### Krok 2: Sprawdź konsolę przeglądarki

1. Otwórz konsolę przeglądarki (F12)
2. Przejdź do zakładki "Console"
3. Utwórz wydarzenie jako nauczyciel
4. Sprawdź logi w konsoli - powinny pojawić się:
   - `📋 Dane uczniów pobrane z bazy:` - lista uczniów z ich danymi
   - `📱 Przetwarzanie SMS dla ucznia:` - informacja o przetwarzaniu SMS
   - `📱 Sformatowany numer:` - sformatowany numer telefonu
   - `✅ SMS wysłany do` lub `❌ Błąd wysyłania SMS`

### Krok 3: Sprawdź błędy

Jeśli widzisz błędy w konsoli:

#### Błąd: "Brak konfiguracji Twilio"
**Rozwiązanie:**
- Sprawdź czy plik `.env.local` istnieje
- Sprawdź czy wszystkie trzy zmienne są ustawione
- Uruchom ponownie serwer

#### Błąd: "Nieprawidłowy format numeru telefonu"
**Rozwiązanie:**
- Sprawdź format numeru telefonu w bazie danych
- Numer powinien być w formacie: `+48123456789` (9 cyfr po +48)
- Sprawdź w konsoli jaki numer jest wysyłany (`📱 Sformatowany numer:`)

#### Błąd: "Invalid phone number" (z Twilio)
**Rozwiązanie:**
- Sprawdź czy numer telefonu jest poprawny
- W wersji trial Twilio możesz wysyłać tylko do zweryfikowanych numerów
- Sprawdź w konsoli Twilio: https://console.twilio.com/us1/monitor/logs/sms

### Krok 4: Sprawdź czy numer telefonu jest w bazie

1. Otwórz Firebase Console: https://console.firebase.google.com/
2. Przejdź do Firestore Database
3. Znajdź kolekcję `users`
4. Znajdź dokument z Twoim UID
5. Sprawdź czy pole `phone` istnieje i ma wartość

### Krok 5: Sprawdź logi serwera

1. Sprawdź terminal, w którym działa `npm run dev`
2. Szukaj logów:
   - `[SMS] SMS wysłany pomyślnie do` - SMS został wysłany
   - `[SMS] Błąd wysyłania SMS:` - wystąpił błąd
   - `[SMS] Brak konfiguracji Twilio` - brak konfiguracji

### Krok 6: Test ręczny endpointu SMS

Możesz przetestować endpoint ręcznie:

```javascript
// W konsoli przeglądarki (F12)
fetch('/api/send-sms', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: '+48123456789', // Twój numer telefonu
    message: 'Test SMS'
  }),
})
.then(res => res.json())
.then(data => console.log('Odpowiedź:', data))
.catch(error => console.error('Błąd:', error));
```

### Krok 7: Sprawdź Twilio Console

1. Zaloguj się do Twilio: https://console.twilio.com/
2. Przejdź do **Monitor** → **Logs** → **SMS**
3. Sprawdź czy są próby wysłania SMS
4. Sprawdź status wiadomości (delivered, failed, etc.)

### Najczęstsze problemy:

1. **Brak pliku `.env.local`** - utwórz plik z danymi Twilio
2. **Serwer nie został uruchomiony ponownie** - uruchom ponownie po dodaniu zmiennych
3. **Nieprawidłowy format numeru** - użyj formatu `+48123456789`
4. **Brak numeru telefonu w bazie** - dodaj numer w profilu
5. **Twilio trial account** - w wersji trial możesz wysyłać tylko do zweryfikowanych numerów
6. **Brak środków na koncie Twilio** - sprawdź saldo konta

### Sprawdź czy wszystko działa:

1. ✅ Plik `.env.local` istnieje i zawiera dane Twilio
2. ✅ Serwer został uruchomiony ponownie
3. ✅ Numer telefonu jest w bazie danych (pole `phone` w kolekcji `users`)
4. ✅ Numer telefonu jest w poprawnym formacie (`+48123456789`)
5. ✅ W konsoli przeglądarki nie ma błędów
6. ✅ W konsoli Twilio są logi prób wysłania SMS

