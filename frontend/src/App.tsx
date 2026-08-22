import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { Layout } from './layouts/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PurchaseRequestsPage } from './pages/PurchaseRequestsPage';
import { CreatePurchaseRequestPage } from './pages/CreatePurchaseRequestPage';
import { PurchaseRequestDetailPage } from './pages/PurchaseRequestDetailPage';
import { PendingApprovalsPage } from './pages/PendingApprovalsPage';
import { SignatureSettingsPage } from './pages/SignatureSettingsPage';
import { ApprovedRequestPrintPage } from './pages/ApprovedRequestPrintPage';
import { LoadingSpinner } from './components/ui/LoadingSpinner';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={
        <PublicRoute>
          <LoginPage />
        </PublicRoute>
      } />
      
      <Route element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/purchase-requests" element={<PurchaseRequestsPage />} />
        <Route path="/purchase-requests/create" element={<CreatePurchaseRequestPage />} />
        <Route path="/purchase-requests/:id" element={<PurchaseRequestDetailPage />} />
        <Route path="/purchase-requests/:id/print" element={<ApprovedRequestPrintPage />} />
        <Route path="/pending-approvals" element={<PendingApprovalsPage />} />
        <Route path="/settings/signature" element={<SignatureSettingsPage />} />
      </Route>

      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}