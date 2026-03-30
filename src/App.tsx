import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ChatPage from "./pages/ChatPage";
import GuestChatPage from "./pages/GuestChatPage";
import NotFound from "./pages/NotFound";
import AuthLayout from "./components/layout/AuthLayout";
import { Toaster } from "@/components/ui/sonner";
import SessionContextProvider from "./components/SessionContextProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import GuestRoute from "./components/GuestRoute";
import { ThemeProvider } from "@/components/theme-provider";

const App = () => (
  <BrowserRouter>
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <SessionContextProvider>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<AuthLayout><LoginPage /></AuthLayout>} />
          <Route path="/register" element={<AuthLayout><RegisterPage /></AuthLayout>} />
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/chat/guest" element={<GuestRoute><GuestChatPage /></GuestRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Toaster />
      </SessionContextProvider>
    </ThemeProvider>
  </BrowserRouter>
);

export default App;
