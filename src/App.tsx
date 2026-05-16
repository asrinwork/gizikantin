import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Transactions from "./pages/Transactions";
import Foods from "./pages/Foods";
import Students from "./pages/Students";
import Target from "./pages/Target";
import Classes from "./pages/Classes";
import Users from "./pages/Users";
import Charts from "./pages/Charts";
import StudentMenu from "./pages/StudentMenu";
import StudentOrders from "./pages/StudentOrders";
import StudentProfile from "./pages/StudentProfile";
import CanteenOrders from "./pages/CanteenOrders";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Home />} />
              <Route path="/transaksi" element={<ProtectedRoute roles={["kantin","admin"]}><Transactions /></ProtectedRoute>} />
              <Route path="/pesanan-masuk" element={<ProtectedRoute roles={["kantin","admin"]}><CanteenOrders /></ProtectedRoute>} />
              <Route path="/makanan" element={<ProtectedRoute roles={["kantin","admin"]}><Foods /></ProtectedRoute>} />
              <Route path="/siswa" element={<ProtectedRoute roles={["admin"]}><Students /></ProtectedRoute>} />
              <Route path="/kelas" element={<ProtectedRoute roles={["admin"]}><Classes /></ProtectedRoute>} />
              <Route path="/users" element={<ProtectedRoute roles={["admin"]}><Users /></ProtectedRoute>} />
              <Route path="/target" element={<ProtectedRoute roles={["admin"]}><Target /></ProtectedRoute>} />
              <Route path="/grafik" element={<ProtectedRoute roles={["admin","guru"]}><Charts /></ProtectedRoute>} />
              <Route path="/menu" element={<ProtectedRoute roles={["siswa"]}><StudentMenu /></ProtectedRoute>} />
              <Route path="/orders" element={<ProtectedRoute roles={["siswa"]}><StudentOrders /></ProtectedRoute>} />
              <Route path="/profil" element={<ProtectedRoute roles={["siswa"]}><StudentProfile /></ProtectedRoute>} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
