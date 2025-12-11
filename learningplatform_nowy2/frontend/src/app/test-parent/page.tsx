'use client';

import { useAuth } from '@/context/AuthContext';

export default function TestParent() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-8 w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      <h1 className="text-2xl font-bold mb-4">Test Strony Rodzica</h1>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-2">Informacje o użytkowniku:</h2>
        
        {user ? (
          <div>
            <p><strong>UID:</strong> {user.uid}</p>
            <p><strong>Email:</strong> {user.email}</p>
            <p><strong>Rola:</strong> {user.role}</p>
            <p><strong>Zalogowany:</strong> Tak</p>
          </div>
        ) : (
          <p>Użytkownik niezalogowany</p>
        )}
      </div>

      <div className="mt-6">
        <a 
          href="/homelogin/parent" 
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Przejdź do panelu rodzica
        </a>
      </div>
    </div>
  );
}









