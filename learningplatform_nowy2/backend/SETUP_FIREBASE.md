# Konfiguracja Firebase - Instrukcja krok po kroku

## Szybki start (automatyczna konwersja)

1. **Pobierz plik JSON z Firebase Console:**
   - Przejdź do: https://console.firebase.google.com/project/cogito-8443e/settings/serviceaccounts/adminsdk
   - Kliknij **"Generate new private key"**
   - Zapisz pobrany plik jako `firebase-credentials.json` w katalogu `backend/`

2. **Uruchom skrypt konwersji:**
   ```powershell
   cd learningplatform_nowy2\backend
   python convert_firebase_json.py
   ```

3. **Gotowe!** Plik `.env` został automatycznie utworzony z odpowiednimi wartościami.

---

## Ręczna konfiguracja

Jeśli wolisz skonfigurować ręcznie:

1. **Pobierz plik JSON z Firebase Console:**
   - Przejdź do: https://console.firebase.google.com/project/cogito-8443e/settings/serviceaccounts/adminsdk
   - Kliknij **"Generate new private key"**
   - Pobierz plik JSON

2. **Otwórz plik JSON** i skopiuj wartości do pliku `.env`:

   ```json
   {
     "private_key_id": "skopiuj_tutaj",
     "private_key": "skopiuj_tutaj",
     "client_email": "skopiuj_tutaj",
     "client_id": "skopiuj_tutaj",
     "client_x509_cert_url": "skopiuj_tutaj"
   }
   ```

3. **Edytuj plik `.env`** w katalogu `backend/`:

   ```env
   FIREBASE_PRIVATE_KEY_ID=skopiowana_wartość_z_private_key_id
   FIREBASE_PRIVATE_KEY="skopiowana_wartość_z_private_key"
   FIREBASE_CLIENT_EMAIL=skopiowana_wartość_z_client_email
   FIREBASE_CLIENT_ID=skopiowana_wartość_z_client_id
   FIREBASE_CLIENT_CERT_URL=skopiowana_wartość_z_client_x509_cert_url
   ```

   **UWAGA dla FIREBASE_PRIVATE_KEY:**
   - Jeśli klucz ma rzeczywiste znaki nowej linii, zamień je na `\n`
   - Lub użyj formatu z `\n`: `"-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"`

---

## Weryfikacja

Po skonfigurowaniu, uruchom serwer:

```powershell
cd learningplatform_nowy2\backend
.\venv\Scripts\Activate.ps1
python manage.py runserver
```

W logach powinieneś zobaczyć:
```
✅ Firebase Admin SDK initialized successfully
```

---

## Bezpieczeństwo

⚠️ **WAŻNE:**
- Plik `.env` jest już w `.gitignore` - **NIE commituj go do Git!**
- Plik `firebase-credentials.json` jest również w `.gitignore`
- Klucz prywatny jest wrażliwy - trzymaj go w tajemnicy
- Jeśli klucz wycieknie, wygeneruj nowy w Firebase Console

---

## Rozwiązywanie problemów

### Błąd: "Brakuje wymaganych zmiennych środowiskowych"
- Sprawdź czy wszystkie zmienne są w pliku `.env`
- Sprawdź czy plik `.env` jest w katalogu `backend/`
- Sprawdź czy nie ma błędów w formatowaniu (cudzysłowy, znaki nowej linii)

### Błąd: "Invalid JWT Signature"
- Sprawdź format `FIREBASE_PRIVATE_KEY` - powinien zawierać `\n` dla nowych linii
- Upewnij się, że klucz nie wygasł (wygeneruj nowy w Firebase Console)
- Sprawdź czy wszystkie wartości są poprawnie skopiowane z pliku JSON

### Błąd: "Firebase Admin SDK not initialized"
- Sprawdź logi dla szczegółów błędu
- Upewnij się, że wszystkie zmienne środowiskowe są ustawione
- Sprawdź czy plik `.env` jest poprawnie sformatowany

---

## Linki

- Firebase Console: https://console.firebase.google.com/project/cogito-8443e
- Service Accounts: https://console.firebase.google.com/project/cogito-8443e/settings/serviceaccounts/adminsdk
- Dokumentacja: Zobacz `FIREBASE_SETUP_HOSTING.md` dla szczegółów dotyczących hostingu

