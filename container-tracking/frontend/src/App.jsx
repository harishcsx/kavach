import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ManufacturerDashboard from './pages/ManufacturerDashboard';
import ReceiverVerification from './pages/ReceiverVerification';
import EnforcementMonitor from './pages/EnforcementMonitor';
import ContainerDetail from './pages/ContainerDetail';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" />;
  return children;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <div>
            <nav className="navbar">
              <h1>🛡️ Kavach — Tamper-Proof Tracking</h1>
            </nav>
            <main className="main-container">
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/manufacturer" element={
                  <ProtectedRoute allowedRoles={['MANUFACTURER']}>
                    <ManufacturerDashboard />
                  </ProtectedRoute>
                } />
                <Route path="/receiver" element={<ReceiverVerification />} />
                <Route path="/enforcement" element={
                  <ProtectedRoute allowedRoles={['ENFORCEMENT', 'MANUFACTURER']}>
                    <EnforcementMonitor />
                  </ProtectedRoute>
                } />
                <Route path="/container/:id" element={<ContainerDetail />} />
                <Route path="/" element={<Navigate to="/login" />} />
              </Routes>
            </main>
          </div>
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
