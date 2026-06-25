import { useState } from "react";
import { User } from "./types";
import { CurrencyProvider } from "./context/CurrencyContext";
import { CartProvider } from "./context/CartContext";
import LoginScreen from "./screens/LoginScreen";
import POSScreen from "./screens/POSScreen";

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  return (
    <CurrencyProvider>
      {!user ? (
        <LoginScreen onLogin={setUser} />
      ) : (
        <CartProvider>
          <POSScreen user={user} onLogout={() => setUser(null)} />
        </CartProvider>
      )}
    </CurrencyProvider>
  );
}
