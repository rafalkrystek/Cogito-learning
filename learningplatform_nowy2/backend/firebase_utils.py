import os
from dotenv import load_dotenv
from pathlib import Path
import firebase_admin
from firebase_admin import credentials, auth
from django.conf import settings

# Load environment variables from .env file
# Try to load from backend directory explicitly (where this file is located)
env_path = Path(__file__).parent.resolve() / '.env'
if env_path.exists():
    load_dotenv(env_path, override=True)
    print(f"[OK] Loaded .env from: {env_path}")
else:
    # Fallback: try loading from current directory (for manage.py)
    load_dotenv(override=True)
    print(f"[WARN] .env not found at {env_path}, trying current directory")

# Required environment variables
required_vars = [
    'FIREBASE_PRIVATE_KEY_ID',
    'FIREBASE_PRIVATE_KEY',
    'FIREBASE_CLIENT_EMAIL',
    'FIREBASE_CLIENT_ID',
    'FIREBASE_CLIENT_CERT_URL'
]

# Check for missing environment variables
missing = [var for var in required_vars if not os.getenv(var)]
if missing:
    # In development, allow the app to start without Firebase credentials
    # Firebase features will be disabled until credentials are provided
    is_production = os.getenv('RENDER') or os.getenv('RAILWAY_ENVIRONMENT')
    if is_production:
        raise Exception(f"Brakuje wymaganych zmiennych środowiskowych: {', '.join(missing)}")
    else:
        print(f"[WARN]  Development mode: Brakuje zmiennych środowiskowych Firebase: {', '.join(missing)}")
        print("[WARN]  Aplikacja uruchomi się, ale funkcje Firebase będą wyłączone.")
        print("[WARN]  Aby włączyć Firebase, utwórz plik .env z wymaganymi zmiennymi.")
        print("[WARN]  Zobacz SETUP_FIREBASE.md dla instrukcji.")

# Get Firebase credentials from environment variables
private_key_id = os.getenv('FIREBASE_PRIVATE_KEY_ID')
private_key = os.getenv('FIREBASE_PRIVATE_KEY')
client_email = os.getenv('FIREBASE_CLIENT_EMAIL')
client_id = os.getenv('FIREBASE_CLIENT_ID')
client_cert_url = os.getenv('FIREBASE_CLIENT_CERT_URL')

# Check if we have all required variables before proceeding
has_all_vars = all([private_key_id, private_key, client_email, client_id, client_cert_url])

# Debug private key format (only first/last 50 chars for security)
if private_key:
    print("=== Firebase Private Key Debug ===")
    print(f"Key exists: True")
    print(f"Key length: {len(private_key)}")
    print(f"First 50 chars: {private_key[:50]}")
    print(f"Last 50 chars: {private_key[-50:]}")
    print(f"Starts with BEGIN: {private_key.strip().startswith('-----BEGIN PRIVATE KEY-----')}")
    print(f"Ends with END: {private_key.strip().endswith('-----END PRIVATE KEY-----')}")
    print(f"Contains literal newlines (\\n): {'\\n' in private_key}")
    print(f"Contains escaped newlines (\\\\n): {'\\\\n' in private_key}")
    print(f"Contains actual newlines: {'\n' in private_key}")
    print("==================================")
else:
    print("[WARN] FIREBASE_PRIVATE_KEY is not set in environment variables!")

# Initialize Firebase Admin SDK
if not firebase_admin._apps and has_all_vars:
    try:
        # Process private key - handle different formats from hosting environments
        if private_key:
            original_key = private_key
            print("Processing private key...")
            
            # Step 1: Remove any extra quotes if present (common in env vars)
            private_key = private_key.strip('"\'')
            
            # Step 2: Handle different newline formats
            # Case 1: Escaped newlines (\\n) - most common on hosting
            if '\\n' in private_key and '\n' not in private_key:
                print("Converting escaped newlines (\\n) to actual newlines")
                private_key = private_key.replace('\\n', '\n')
            
            # Case 2: Double-escaped newlines (\\\\n) - sometimes in JSON
            if '\\\\n' in private_key:
                print("Converting double-escaped newlines (\\\\n) to actual newlines")
                private_key = private_key.replace('\\\\n', '\n')
            
            # Case 3: Key in one line (no newlines at all) - needs formatting
            if '\n' not in private_key and 'BEGIN PRIVATE KEY' in private_key:
                print("Key is in one line, formatting with proper line breaks")
                begin_marker = '-----BEGIN PRIVATE KEY-----'
                end_marker = '-----END PRIVATE KEY-----'
                
                if begin_marker in private_key and end_marker in private_key:
                    # Extract the key content
                    start_idx = private_key.find(begin_marker) + len(begin_marker)
                    end_idx = private_key.find(end_marker)
                    key_content = private_key[start_idx:end_idx].strip()
                    
                    # Reformat with proper line breaks
                    private_key = f"{begin_marker}\n{key_content}\n{end_marker}"
                    print("Key reformatted with proper line breaks")
            
            # Step 3: Final validation and cleanup
            private_key = private_key.strip()
            
            # Validate format
            if not private_key.startswith('-----BEGIN PRIVATE KEY-----'):
                raise ValueError(f"Private key does not start with BEGIN marker. First 50 chars: {private_key[:50]}")
            if not private_key.endswith('-----END PRIVATE KEY-----'):
                raise ValueError(f"Private key does not end with END marker. Last 50 chars: {private_key[-50:]}")
            
            print("[OK] Private key processed successfully")
            print(f"Final key length: {len(private_key)}")
            print(f"Final key has newlines: {'\n' in private_key}")
        
        cred = credentials.Certificate({
            "type": "service_account",
            "project_id": "cogito-8443e",
            "private_key_id": private_key_id,
            "private_key": private_key,
            "client_email": client_email,
            "client_id": client_id,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
            "client_x509_cert_url": client_cert_url
        })
        
        # Try to initialize Firebase Admin SDK
        try:
            firebase_admin.initialize_app(cred)
            print("[OK] Firebase Admin SDK initialized successfully")
        except Exception as init_error:
            # If initialization fails, it might be due to JWT signature error
            error_str = str(init_error)
            if 'invalid_grant' in error_str or 'JWT' in error_str or 'signature' in error_str.lower():
                print(f"[ERROR] Firebase Admin SDK initialization failed with JWT Signature error: {error_str}")
                print("[WARN] This is likely due to an invalid or expired FIREBASE_PRIVATE_KEY")
                print("[WARN] The app will continue, but set_user_role will not work")
                # Don't raise - allow app to continue
            else:
                # Re-raise other errors
                raise
    except ValueError as e:
        # Invalid key format - don't crash, but log the error
        print(f"[ERROR] Błąd formatu klucza prywatnego Firebase: {str(e)}")
        print("[WARN] Sprawdź format FIREBASE_PRIVATE_KEY w zmiennych środowiskowych")
        print("[WARN] Klucz powinien zawierać znaki nowej linii (\\n) lub być w formacie wieloliniowym")
        # Don't raise - allow app to continue, but set_user_role will fail gracefully
        print("[WARN] Aplikacja będzie działać, ale ustawianie ról użytkowników może nie działać")
    except Exception as e:
        error_msg = str(e)
        print(f"[ERROR] Błąd inicjalizacji Firebase: {error_msg}")
        print(f"Error type: {type(e).__name__}")
        
        # Check if it's a JWT/credential error
        if 'invalid_grant' in error_msg or 'JWT' in error_msg or 'signature' in error_msg.lower():
            print("[WARN] Błąd JWT Signature - problem z kluczem prywatnym Firebase")
            print("[WARN] INSTRUKCJA NAPRAWY:")
            print("   1. Pobierz nowy klucz prywatny z Firebase Console")
            print("   2. W zmiennych środowiskowych hostingu ustaw FIREBASE_PRIVATE_KEY jako:")
            print("      - Wieloliniowy format (zalecane):")
            print('        FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIE...\\n-----END PRIVATE KEY-----\\n"')
            print("      - Lub w jednej linii (automatycznie sformatowane przez kod)")
            print("   3. Upewnij się, że wszystkie znaki są poprawnie escapowane")
        
        import traceback
        traceback.print_exc()
        # Don't raise - allow app to continue, but log the error
        print("[WARN] Aplikacja będzie działać, ale niektóre funkcje Firebase Admin mogą nie działać")
elif not has_all_vars:
    print("[WARN] Firebase Admin SDK nie zostanie zainicjalizowany - brakuje zmiennych środowiskowych")

def set_user_role(uid, role):
    """Set custom claims for a user to define their role."""
    try:
        # Verify that Firebase Admin is initialized
        if not firebase_admin._apps:
            print("[WARN] Firebase Admin SDK not initialized, cannot set user role")
            return False
        
        # Check if user exists
        try:
            user = auth.get_user(uid)
            print(f"[OK] User {uid} exists, setting role {role}")
        except Exception as e:
            print(f"[WARN] User {uid} does not exist in Firebase Auth: {str(e)}")
            return False
        
        # Set custom claims
        try:
            auth.set_custom_user_claims(uid, {'role': role})
            print(f"[OK] Set role {role} for UID {uid}")
            return True
        except Exception as claims_error:
            error_str = str(claims_error)
            # Check if it's a JWT signature error during claims setting
            if 'invalid_grant' in error_str or 'Invalid JWT Signature' in error_str or 'JWT' in error_str:
                print(f"[ERROR] JWT Signature error while setting custom claims: {error_str}")
                print("[WARN] This indicates the FIREBASE_PRIVATE_KEY is invalid or expired")
                print("[WARN] Solution: Generate a new private key in Firebase Console and update FIREBASE_PRIVATE_KEY in hosting environment variables")
                # Don't raise - return False to indicate failure
                return False
            else:
                # Re-raise other errors
                raise
    except ValueError as e:
        # Invalid UID format
        print(f"[ERROR] Invalid UID format: {str(e)}")
        return False
    except firebase_admin.exceptions.NotFoundError as e:
        # User not found
        print(f"[ERROR] User {uid} not found: {str(e)}")
        return False
    except Exception as e:
        error_str = str(e)
        print(f"[ERROR] Error setting user role: {error_str}")
        print(f"Error type: {type(e).__name__}")
        
        # Check if it's a JWT signature error
        if 'invalid_grant' in error_str or 'Invalid JWT Signature' in error_str:
            print("[WARN] JWT Signature error - this may indicate a problem with Firebase credentials")
            print("[WARN] Check FIREBASE_PRIVATE_KEY format in environment variables")
            print("[INFO] NOTE: This error does NOT block calendar event creation (events are created directly in Firestore)")
            print("[INFO] NOTE: This only affects setting user roles during login - app will continue to work")
        
        # Only print full traceback in debug mode, otherwise just log the error
        import os
        if os.getenv('DEBUG', 'False').lower() == 'true':
            import traceback
            traceback.print_exc()
        
        return False

def get_firestore_client():
    """
    Get Firestore client, ensuring Firebase Admin SDK is initialized.
    Returns None if initialization failed.
    """
    try:
        # Check if Firebase Admin SDK is initialized
        if not firebase_admin._apps:
            print("[WARN] Firebase Admin SDK not initialized, cannot get Firestore client")
            print("[WARN] This usually means FIREBASE_PRIVATE_KEY is invalid or missing")
            return None
        
        from firebase_admin import firestore
        return firestore.client()
    except Exception as e:
        error_str = str(e)
        print(f"[ERROR] Error getting Firestore client: {error_str}")
        
        if 'invalid_grant' in error_str or 'JWT' in error_str or 'signature' in error_str.lower():
            print("[WARN] JWT Signature error - FIREBASE_PRIVATE_KEY is invalid or expired")
            print("[WARN] Solution: Generate a new private key in Firebase Console and update FIREBASE_PRIVATE_KEY")
        
        return None

def verify_token(token: str):
    """
    Verify Firebase ID token
    """
    try:
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        print(f"Error verifying token: {e}")
        return None

def delete_user_from_firebase_auth(uid: str):
    """
    Delete user from Firebase Authentication
    """
    try:
        auth.delete_user(uid)
        print(f"Successfully deleted user {uid} from Firebase Auth")
        return True
    except Exception as e:
        print(f"Error deleting user from Firebase Auth: {str(e)}")
        return False 