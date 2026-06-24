import { useState } from "react";
import { User } from "./types";
import { CartProvider } from "./context/CartContext";
import LoginScreen from "./screens/LoginScreen";
import POSScreen from "./screens/POSScreen";

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  return (
    <CartProvider>
      <POSScreen user={user} onLogout={() => setUser(null)} />
    </CartProvider>
  );
}
