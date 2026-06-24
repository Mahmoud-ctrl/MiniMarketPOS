import { useState } from "react";
import { User } from "./types";
import LoginScreen from "./screens/LoginScreen";
import POSScreen from "./screens/POSScreen";

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  if (!user) {
    return <LoginScreen onLogin={setUser} />;
  }

  return <POSScreen user={user} onLogout={() => setUser(null)} />;
}
