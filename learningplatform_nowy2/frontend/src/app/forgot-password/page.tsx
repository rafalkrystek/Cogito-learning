"use client";
import React, { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../../config/firebase";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/ThemeToggle";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Link do resetowania hasła został wysłany na podany adres e-mail.");
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError("Nie udało się wysłać linku. Sprawdź adres e-mail lub spróbuj ponownie później.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e3eafe] to-[#f5f7ff] relative w-full overflow-x-hidden" style={{ maxWidth: '100vw' }}>
      {/* Theme Toggle */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggle />
      </div>
      
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md border border-[#e3eafe]">
        <h2 className="text-2xl font-bold text-[#4067EC] mb-2 text-center">Resetowanie hasła</h2>
        <p className="text-gray-500 mb-6 text-center">Podaj swój adres e-mail, aby otrzymać link do zmiany hasła.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            className="w-full py-3 px-4 rounded bg-[#f5f7ff] border border-[#e3eafe] focus:outline-none text-[#222]"
            placeholder="Adres e-mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            className="w-full bg-[#4067EC] text-white font-semibold py-3 rounded shadow hover:bg-[#3050b3] transition"
            disabled={loading}
          >
            {loading ? "Wysyłanie..." : "Wyślij link resetujący hasło"}
          </button>
        </form>
        {message && <div className="mt-4 text-green-600 text-center font-semibold">{message}</div>}
        {error && <div className="mt-4 text-red-600 text-center font-semibold">{error}</div>}
        <button
          className="mt-6 w-full text-[#4067EC] hover:underline text-sm"
          onClick={() => router.push('/homelogin')}
        >
          Powrót do strony głównej
        </button>
      </div>
    </div>
  );
} 