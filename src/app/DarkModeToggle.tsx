"use client";
import { useState, useEffect } from "react";

export default function DarkModeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [dark]);
  return (
    <button
      onClick={() => setDark((d) => !d)}
      className="fixed bottom-4 right-4 z-50 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-full p-2 shadow-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
      aria-label="Cambiar modo oscuro"
    >
      {dark ? "🌙" : "☀️"}
    </button>
  );
} 