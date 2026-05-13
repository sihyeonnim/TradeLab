import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function AdminCoursesPage() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [status, setStatus] = useState({
    loading: true,
    error: "",
    message: "",
  });

  async function loadCourses() {
    const [meResponse, coursesResponse] = await Promise.all([
      api.get("/auth/me"),
      api.get("/admin/courses"),
    ]);

    if (meResponse.data.user.role !== "ADMIN") {
      setStatus({
        loading: false,
        error: "You are not authorized to access admin courses.",
        message: "",
      });
      return;
    }

    setCourses(coursesResponse.data.courses || []);
    setStatus({ loading: false, error: "", message: "" });
  }

  useEffect(() => {
    async function init() {
      try {
        await loadCourses();
      } catch (error) {
        if (error.response?.status === 401) {
          navigate("/login");
          return;
        }

        setStatus({
          loading: false,
          error: error.response?.data?.message || "Failed to load admin courses.",
          message: "",
        });
      }
    }

    init();
  }, [navigate]);

  async function approve(courseId) {
    try {
      const response = await api.patch(`/admin/courses/${courseId}/approve`);
      await loadCourses();

      setStatus({
        loading: false,
        error: "",
        message: response.data.message,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error: error.response?.data?.message || "Failed to approve course.",
        message: "",
      });
    }
  }

  async function reject(courseId) {
    const reason = window.prompt("Rejection reason", "Needs revision.");

    try {
      const response = await api.patch(`/admin/courses/${courseId}/reject`, {
        reason,
      });

      await loadCourses();

      setStatus({
        loading: false,
        error: "",
        message: response.data.message,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error: error.response?.data?.message || "Failed to reject course.",
        message: "",
      });
    }
  }

  if (status.loading) {
    return (
      <main className="dashboard-shell">
        <p>Loading admin courses...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <nav className="dashboard-nav">
        <div>
          <span className="brand-badge">TradeLab</span>
          <h1>Admin Courses</h1>
          <p className="dashboard-subtitle">
            Review and approve instructor-created courses.
          </p>
        </div>

        <Link className="nav-button" to="/dashboard">
          Dashboard
        </Link>
      </nav>

      {status.message && <p className="success">{status.message}</p>}
      {status.error && <p className="error">{status.error}</p>}

      {!status.error && (
        <section className="dashboard-card wide">
          <p className="eyebrow">All courses</p>
          <h3>Course approval queue</h3>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Instructor</th>
                  <th>Status</th>
                  <th>Published</th>
                  <th>Reason</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {courses.map((course) => (
                  <tr key={course.id}>
                    <td>
                      <strong>{course.title}</strong>
                      <span>{course.description}</span>
                    </td>
                    <td>{course.instructor?.name || "-"}</td>
                    <td>{course.approvalStatus}</td>
                    <td>{course.isPublished ? "Yes" : "No"}</td>
                    <td>{course.rejectionReason || "-"}</td>
                    <td>
                      <div className="inline-actions">
                        <button onClick={() => approve(course.id)}>
                          Approve
                        </button>
                        <button
                          className="danger-button"
                          onClick={() => reject(course.id)}
                        >
                          Reject
                        </button>
                        <Link
                          className="secondary-button link-button"
                          to={`/courses/${course.id}`}
                        >
                          View
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}