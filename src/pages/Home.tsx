import { useAuth } from "@/hooks/useAuth";
import Dashboard from "./Dashboard";
import StudentDashboard from "./StudentDashboard";

const Home = () => {
  const { hasRole, loading } = useAuth();
  if (loading) return null;
  // Siswa gets their own dashboard; everyone else (admin/guru/kantin) gets the monitoring dashboard
  if (hasRole("siswa") && !hasRole("admin") && !hasRole("guru") && !hasRole("kantin") && !hasRole("wali_kelas") && !hasRole("kepala_sekolah")) {
    return <StudentDashboard />;
  }
  return <Dashboard />;
};

export default Home;
