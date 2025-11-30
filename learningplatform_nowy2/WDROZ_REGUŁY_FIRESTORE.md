# ⚠️ WAŻNE: Wdróż reguły Firestore!

## Problem
Błąd "Missing or insufficient permissions" występuje, ponieważ reguły Firestore nie są wdrożone w Firebase.

## Rozwiązanie

### Opcja 1: Przez Firebase Console (NAJŁATWIEJSZE)
1. Otwórz [Firebase Console](https://console.firebase.google.com/)
2. Wybierz projekt: `cogito-8443e`
3. Przejdź do **Firestore Database** > **Rules**
4. Skopiuj zawartość pliku `firestore.rules`
5. Wklej do edytora reguł w konsoli
6. Kliknij **Publish**

### Opcja 2: Przez Firebase CLI
```bash
# W katalogu głównym projektu
cd learningplatform_nowy2

# Ustaw projekt (jeśli nie jest ustawiony)
firebase use cogito-8443e

# Wdróż reguły
firebase deploy --only firestore:rules
```

## Sprawdzenie czy reguły są wdrożone
Po wdrożeniu, spróbuj utworzyć klasę ponownie. Jeśli nadal występuje błąd:
1. Sprawdź w konsoli przeglądarki logi `🎫 Token claims`
2. Upewnij się że `teacher_id` w danych == `request.auth.uid`
3. Sprawdź czy reguły są aktywne w Firebase Console

## Reguły dla klas (już w pliku firestore.rules):
```javascript
match /classes/{classId} {
  allow read: if request.auth != null;
  allow create: if request.auth != null && (
    request.resource.data.teacher_id == request.auth.uid ||
    request.auth.token.role == 'teacher' || 
    request.auth.token.role == 'admin'
  );
  allow update: if request.auth != null && (
    resource.data.teacher_id == request.auth.uid ||
    request.auth.token.role == 'admin'
  );
  allow delete: if request.auth != null && (
    resource.data.teacher_id == request.auth.uid ||
    request.auth.token.role == 'admin'
  );
}
```

