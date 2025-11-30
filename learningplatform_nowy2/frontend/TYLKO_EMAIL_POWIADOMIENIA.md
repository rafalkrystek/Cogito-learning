# 📧 Powiadomienia tylko przez Email (bez SMS)

## ✅ Rozwiązanie: Tylko Email

Firebase **NIE MA** natywnej funkcji do wysyłania SMS. Aby wysyłać SMS, musisz użyć zewnętrznego serwisu (MSG91, Twilio, itp.).

**Rozwiązanie:** Wysyłamy **tylko emaile** - to działa bez żadnych zewnętrznych serwisów (oprócz Gmail SMTP, które już mamy skonfigurowane).

## 🚀 Jak to działa

1. **Nauczyciel tworzy wydarzenie** → zapisuje się w Firestore
2. **Cloud Function `onEventCreated`** automatycznie się uruchamia
3. **Function wysyła email** do wszystkich przypisanych uczniów (jeśli mają email)
4. **SMS są wyłączone** - nie wymagamy żadnych zewnętrznych serwisów

## ✅ Zalety

- ✅ **Działa od razu** - bez konfiguracji MSG91/Twilio
- ✅ **Tylko Firebase** - email przez Gmail SMTP (już skonfigurowane)
- ✅ **Zero kosztów** - Gmail SMTP jest darmowe do 500 emaili dziennie
- ✅ **Proste** - nie wymaga żadnych extensionów

## 📧 Email działa automatycznie

Email jest już skonfigurowany w Cloud Function i używa:
- **Gmail SMTP**: `learningplatformcogito@gmail.com`
- **Hasło aplikacji**: już w kodzie

## 🔄 Jeśli chcesz dodać SMS w przyszłości

Możesz później:
1. Zainstalować MSG91 Extension
2. Dodać kod tworzący dokumenty w `sms_messages`
3. Extension automatycznie wyśle SMS

Ale na razie **tylko email wystarczy** - uczniowie dostaną powiadomienia na email.

## 📝 Status

- ✅ **Email**: Działa automatycznie przez Cloud Function
- ❌ **SMS**: Wyłączone (wymaga zewnętrznego serwisu)

