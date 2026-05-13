import { Navigate, Route, Routes } from "react-router-dom";

import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";
import VerifyEmailPage from "./pages/VerifyEmailPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import CoursesPage from "./pages/CoursesPage.jsx";
import CourseDetailPage from "./pages/CourseDetailPage.jsx";
import InstructorCoursesPage from "./pages/InstructorCoursesPage.jsx";
import InstructorCourseEditPage from "./pages/InstructorCourseEditPage.jsx";
import AdminCoursesPage from "./pages/AdminCoursesPage.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />

      <Route path="/courses" element={<CoursesPage />} />
      <Route path="/courses/:courseId" element={<CourseDetailPage />} />

      <Route path="/instructor/courses" element={<InstructorCoursesPage />} />
      <Route
        path="/instructor/courses/:courseId/edit"
        element={<InstructorCourseEditPage />}
      />

      <Route path="/admin/courses" element={<AdminCoursesPage />} />
    </Routes>
  );
}