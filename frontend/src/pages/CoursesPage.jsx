import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function CoursesPage() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [status, setStatus] = useState({
    loading: true,
    error: "",
    message: "",
  });

  async function loadData() {
    const [coursesResponse, enrollmentsResponse] = await Promise.all([
      api.get("/courses"),
      api.get("/enrollments/me"),
    ]);

    setCourses(coursesResponse.data.courses || []);
    setEnrollments(enrollmentsResponse.data.enrollments || []);
  }

  useEffect(() => {
    async function init() {
      try {
        await loadData();
        setStatus({ loading: false, error: "", message: "" });
      } catch (error) {
        if (error.response?.status === 401) {
          navigate("/login");
          return;
        }

        setStatus({
          loading: false,
          error: error.response?.data?.message || "Failed to load courses.",
          message: "",
        });
      }
    }

    init();
  }, [navigate]);

  function isEnrolled(courseId) {
    return enrollments.some((enrollment) => enrollment.course?.id === courseId);
  }

  async function enroll(courseId) {
    setStatus((prev) => ({ ...prev, error: "", message: "" }));

    try {
      const response = await api.post(`/courses/${courseId}/enroll`);
      await loadData();

      setStatus({
        loading: false,
        error: "",
        message: response.data.message,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error: error.response?.data?.message || "Enrollment failed.",
        message: "",
      });
    }
  }

  if (status.loading) {
    return (
      <main className="dashboard-shell">
        <p>Loading courses...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <nav className="dashboard-nav">
        <div>
          <span className="brand-badge">TradeLab</span>
          <h1>Courses</h1>
          <p className="dashboard-subtitle">
            Learn investing concepts through approved instructor courses.
          </p>
        </div>

        <Link className="nav-button" to="/dashboard">
          Dashboard
        </Link>
      </nav>

      {status.message && <p className="success">{status.message}</p>}
      {status.error && <p className="error">{status.error}</p>}

      <section className="course-grid">
        {courses.length === 0 ? (
          <article className="dashboard-card">
            <p>No approved courses yet.</p>
          </article>
        ) : (
          courses.map((course) => (
            <article className="dashboard-card" key={course.id}>
              <p className="eyebrow">{course.level || "COURSE"}</p>
              <h3>{course.title}</h3>
              <p>{course.description}</p>

              {course.instructor?.name && (
                <p className="muted-text">Instructor: {course.instructor.name}</p>
              )}

              <div className="tag-row">
                {(course.tags || []).map((tag) => (
                  <span className="tag" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>

              <div className="action-row">
                <Link className="secondary-button link-button" to={`/courses/${course.id}`}>
                  View Details
                </Link>

                <button
                  onClick={() => enroll(course.id)}
                  disabled={isEnrolled(course.id)}
                >
                  {isEnrolled(course.id) ? "Enrolled" : "Enroll"}
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}