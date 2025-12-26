import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';
import DashboardLayout from '../layouts/DashboardLayout';
import LoginPageNew from './LoginPageNew';
import RegisterPage from './RegisterPage';

import DashboardPage from './DashboardPage';
import UnauthorizedPage from './UnauthorizedPage';

// Examples (for reference/reuse)
// import { ExamPageExample } from './ExamPageExample';
// import { SecureExamPageExample } from './SecureExamPageExample';

// Active: Mock Exam
import { MockExamPage } from './MockExamPage';

// Profile & Exam Queue
import { ProfileCompletionPage } from './ProfileCompletionPage';
import { ExamQueueSnapshotPage } from './ExamQueueSnapshotPage';
import { ExamWaitingRoom } from './ExamWaitingRoom';

// Proctor Dashboard (New)
import { ProctorDashboard } from './ProctorDashboard';

// Candidate pages
import { ExamsPage } from './roles/ExamsPage';
import { MyResultsPage } from './roles/MyResultsPage';
import { MyViolationsPage } from './roles/MyViolationsPage';
import { StudentStartExamPage } from './roles/StudentStartExamPage';

// Admin pages
import { AdminExamsPage } from './roles/AdminExamsPage';
import { AdminCreateExamPage } from './roles/AdminCreateExamPage';
import { AdminUsersPage } from './roles/AdminUsersPage';
import { AdminSystemPage } from './roles/AdminSystemPage';
import { AdminViolationsPage } from './roles/AdminViolationsPage';

// Proctor role pages
import ProctorActiveExamsPage from './roles/ProctorActiveExamsPage';
import ProctorViolationsPage from './roles/ProctorViolationsPage';
import ProctorDashboardRole from './roles/ProctorDashboard';
import ProctorVideoAnalysisPage from './roles/ProctorVideoAnalysisPage';
import ProctorVideoAnalysisListPage from './roles/ProctorVideoAnalysisListPage';
import ProctorBehaviorAnalysisPage from './roles/ProctorBehaviorAnalysisPage';
import ProctorBehaviorAnalysisListPage from './roles/ProctorBehaviorAnalysisListPage';



const App: React.FC = () => {
  return (
    <AuthProvider>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPageNew />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Protected routes with Dashboard Layout */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardLayout>
                <DashboardPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />




        {/* Candidate routes */}
        <Route
          path="/candidate/exams"
          element={
            <ProtectedRoute allowedRoles={['CANDIDATE']}>
              <DashboardLayout>
                <ExamsPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/exams"
          element={<Navigate to="/candidate/exams" replace />}
        />
        {/* Profile completion (after first login) */}
        <Route
          path="/profile/complete"
          element={
            <ProtectedRoute>
              <ProfileCompletionPage />
            </ProtectedRoute>
          }
        />

        {/* Exam queue snapshot (face verification before exam) */}
        <Route
          path="/exam/:examId/verify"
          element={
            <ProtectedRoute skipProfileCheck>
              <ExamQueueSnapshotPage />
            </ProtectedRoute>
          }
        />

        {/* Exam Landing / Start Page */}
        <Route
          path="/exams/:examId/start"
          element={
            <ProtectedRoute skipProfileCheck>
              <StudentStartExamPage />
            </ProtectedRoute>
          }
        />

        {/* Waiting room after verification */}
        <Route
          path="/exam/:examId/waiting-room"
          element={
            <ProtectedRoute skipProfileCheck>
              <ExamWaitingRoom />
            </ProtectedRoute>
          }
        />

        {/* Calibration page removed - detection uses relaxed default thresholds */}

        {/* Actual exam page - uses state-based question navigation */}
        <Route
          path="/exam-start/:examId"
          element={
            <ProtectedRoute skipProfileCheck>
              <MockExamPage />
            </ProtectedRoute>
          }
        />

        {/* Legacy route redirect - in case old URL is used */}
        <Route
          path="/exam-start/:examId/question/:questionIndex"
          element={
            <ProtectedRoute skipProfileCheck>
              <MockExamPage />
            </ProtectedRoute>
          }
        />

        {/* Secure exam example removed - see SecureExamPageExample.tsx for reference */}

        {/* Redirect mock-exam URL directly to exam-start */}
        <Route
          path="/mock-exam/:examId"
          element={
            <Navigate to="/exam-start/:examId" replace />
          }
        />
        <Route
          path="/candidate/my-results"
          element={
            <ProtectedRoute allowedRoles={['CANDIDATE']}>
              <DashboardLayout>
                <MyResultsPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-results"
          element={<Navigate to="/candidate/my-results" replace />}
        />
        <Route
          path="/candidate/my-violations"
          element={
            <ProtectedRoute allowedRoles={['CANDIDATE']}>
              <DashboardLayout>
                <MyViolationsPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-violations"
          element={<Navigate to="/candidate/my-violations" replace />}
        />

        {/* Admin routes */}
        <Route
          path="/admin/exams"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <DashboardLayout>
                <AdminExamsPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/exams/create"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <DashboardLayout>
                <AdminCreateExamPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/exams/:examId"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <DashboardLayout>
                <AdminCreateExamPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <DashboardLayout>
                <AdminUsersPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/system"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <DashboardLayout>
                <AdminSystemPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/incidents"
          element={
            <ProtectedRoute allowedRoles={['ADMIN']}>
              <DashboardLayout>
                <AdminViolationsPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />

        {/* Proctor routes (also accessible by REVIEWER) */}
        <Route
          path="/proctor/active-exams"
          element={
            <ProtectedRoute allowedRoles={['PROCTOR', 'REVIEWER']}>
              <DashboardLayout>
                <ProctorActiveExamsPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/proctor/violations"
          element={
            <ProtectedRoute allowedRoles={['PROCTOR', 'REVIEWER']}>
              <DashboardLayout>
                <ProctorViolationsPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/proctor"
          element={
            <ProtectedRoute allowedRoles={['PROCTOR', 'REVIEWER']}>
              <DashboardLayout>
                <ProctorDashboardRole />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/proctor/video-analysis"
          element={
            <ProtectedRoute allowedRoles={['PROCTOR', 'REVIEWER']}>
              <DashboardLayout>
                <ProctorVideoAnalysisListPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/proctor/behavior-analysis"
          element={
            <ProtectedRoute allowedRoles={['PROCTOR', 'REVIEWER']}>
              <DashboardLayout>
                <ProctorBehaviorAnalysisListPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/proctor/video-analysis/:incidentId"
          element={
            <ProtectedRoute allowedRoles={['PROCTOR', 'REVIEWER']}>
              <DashboardLayout>
                <ProctorVideoAnalysisPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/proctor/behavior-analysis/:sessionId"
          element={
            <ProtectedRoute allowedRoles={['PROCTOR', 'REVIEWER']}>
              <DashboardLayout>
                <ProctorBehaviorAnalysisPage />
              </DashboardLayout>
            </ProtectedRoute>
          }
        />


        {/* Proctor Dashboard - Real-time exam monitoring */}
        <Route
          path="/proctor/dashboard/:examId"
          element={
            <ProtectedRoute allowedRoles={['PROCTOR', 'REVIEWER', 'ADMIN']}>
              <ProctorDashboard />
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </AuthProvider>
  );
};

export default App;
