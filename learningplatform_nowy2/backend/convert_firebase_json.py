#!/usr/bin/env python
"""
Skrypt pomocniczy do konwersji pliku JSON z Firebase na zmienne środowiskowe .env

Użycie:
1. Pobierz plik JSON z Firebase Console (Settings → Service accounts → Generate new private key)
2. Zapisz jako firebase-credentials.json w katalogu backend
3. Uruchom: python convert_firebase_json.py
4. Skrypt utworzy plik .env z odpowiednimi zmiennymi
"""

import json
import os
from pathlib import Path

def convert_firebase_json_to_env():
    """Konwertuj plik JSON z Firebase na plik .env"""
    
    # Ścieżka do pliku JSON
    json_path = Path(__file__).parent / "firebase-credentials.json"
    env_path = Path(__file__).parent / ".env"
    
    if not json_path.exists():
        print("❌ Nie znaleziono pliku firebase-credentials.json")
        print(f"   Szukam w: {json_path}")
        print("\n📋 Instrukcja:")
        print("1. Przejdź do Firebase Console: https://console.firebase.google.com/")
        print("2. Wybierz projekt: cogito-8443e")
        print("3. Settings → Service accounts")
        print("4. Kliknij 'Generate new private key'")
        print("5. Zapisz pobrany plik jako 'firebase-credentials.json' w katalogu backend")
        return False
    
    try:
        # Wczytaj plik JSON
        with open(json_path, 'r', encoding='utf-8') as f:
            firebase_config = json.load(f)
        
        # Wyciągnij potrzebne wartości
        private_key_id = firebase_config.get('private_key_id', '')
        private_key = firebase_config.get('private_key', '')
        client_email = firebase_config.get('client_email', '')
        client_id = firebase_config.get('client_id', '')
        client_x509_cert_url = firebase_config.get('client_x509_cert_url', '')
        
        # Sprawdź czy wszystkie wartości są obecne
        required_keys = ['private_key_id', 'private_key', 'client_email', 'client_id', 'client_x509_cert_url']
        missing = [key for key in required_keys if not firebase_config.get(key)]
        
        if missing:
            print(f"❌ Brakuje wymaganych pól w pliku JSON: {', '.join(missing)}")
            return False
        
        # Przygotuj klucz prywatny - zamień rzeczywiste nowe linie na \n
        if '\n' in private_key:
            private_key_escaped = private_key.replace('\n', '\\n')
        else:
            private_key_escaped = private_key
        
        # Utwórz zawartość pliku .env
        env_content = f"""# Firebase Configuration
# Wygenerowane automatycznie z firebase-credentials.json
# UWAGA: Ten plik zawiera wrażliwe dane - NIE commituj go do Git!

FIREBASE_PRIVATE_KEY_ID={private_key_id}
FIREBASE_PRIVATE_KEY="{private_key_escaped}"
FIREBASE_CLIENT_EMAIL={client_email}
FIREBASE_CLIENT_ID={client_id}
FIREBASE_CLIENT_CERT_URL={client_x509_cert_url}

# Django Secret Key (opcjonalne - domyślnie używa insecure key dla development)
# SECRET_KEY=your-secret-key-here
"""
        
        # Zapisz plik .env
        with open(env_path, 'w', encoding='utf-8') as f:
            f.write(env_content)
        
        print("✅ Plik .env został utworzony pomyślnie!")
        print(f"   Lokalizacja: {env_path}")
        print("\n⚠️  WAŻNE:")
        print("   - Plik .env zawiera wrażliwe dane")
        print("   - Upewnij się, że .env jest w .gitignore (już jest)")
        print("   - NIE commituj tego pliku do Git!")
        print("\n✅ Możesz teraz uruchomić serwer Django")
        
        return True
        
    except json.JSONDecodeError as e:
        print(f"❌ Błąd parsowania pliku JSON: {e}")
        return False
    except Exception as e:
        print(f"❌ Błąd: {e}")
        return False

if __name__ == "__main__":
    convert_firebase_json_to_env()

