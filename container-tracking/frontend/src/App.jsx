import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

// Placeholder Components
const Login = () => <div className="p-4"><h1 className="text-2xl">Login Page</h1></div>;
const ManufacturerDashboard = () => <div className="p-4"><h1 className="text-2xl">Manufacturer Dashboard</h1></div>;
const ReceiverVerification = () => <div className="p-4"><h1 className="text-2xl">Receiver Verification</h1></div>;
const EnforcementMonitor = () => <div className="p-4"><h1 className="text-2xl">Enforcement Monitor</h1></div>;
const ContainerDetail = () => <div className="p-4"><h1 className="text-2xl">Container Detail</h1></div>;

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
          <div className="min-h-screen bg-gray-100 text-gray-900">
            <nav className="bg-blue-600 text-white p-4 shadow-md flex justify-between items-center">
              <h1 className="text-xl font-bold">Tamper-Proof Tracking System</h1>
            </nav>
            <main className="container mx-auto py-6">
              <Routes>
                <Route path="/login" element={<Login />} />

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
