import { useState } from "react";
import { User } from "./types";
import { ThemeProvider } from "./context/ThemeContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import { CartProvider } from "./context/CartContext";
import { LanguageProvider } from "./context/LanguageContext";
import LoginScreen from "./screens/LoginScreen";
import POSScreen from "./screens/POSScreen";

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  return (
    <LanguageProvider>
      <ThemeProvider>
        <CurrencyProvider>
          {!user ? (
            <LoginScreen onLogin={setUser} />
          ) : (
            <CartProvider>
              <POSScreen user={user} onLogout={() => setUser(null)} />
            </CartProvider>
          )}
        </CurrencyProvider>
      </ThemeProvider>
    </LanguageProvider>
  );
}
