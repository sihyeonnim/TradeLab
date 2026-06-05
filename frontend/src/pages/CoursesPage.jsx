import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import BottomNav from "../components/BottomNav.jsx";

export default function CoursesPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [status, setStatus] = useState({
    loading: true,
    error: "",
    message: "",
    submittingId: "",
  });

  async function loadData() {
    const [meResponse, coursesResponse, enrollmentsResponse] = await Promise.all([
      api.get("/auth/me"),
      api.get("/courses"),
      api.get("/enrollments/me").catch(() => ({ data: { enrollments: [] } })),
    ]);

    setUser(meResponse.data.user);
    setCourses(coursesResponse.data.courses || []);
    setEnrollments(enrollmentsResponse.data.enrollments || []);
  }

  useEffect(() => {
    async function init() {
      try {
        await loadData();
        setStatus({ loading: false, error: "", message: "", submittingId: "" });
      } catch (error) {
        if (error.response?.status === 401) {
          navigate("/login");
          return;
        }

        setStatus({
          loading: false,
          error: error.response?.data?.message || "Failed to load courses.",
          message: "",
          submittingId: "",
        });
      }
    }

    init();
  }, [navigate]);

  function getEnrollmentCourseId(enrollment) {
    if (!enrollment?.course) {
      return null;
    }

    if (typeof enrollment.course === "string") {
      return enrollment.course;
    }

    return enrollment.course.id || enrollment.course._id || null;
  }

  function isEnrolled(courseId) {
    return enrollments.some(
      (enrollment) => String(getEnrollmentCourseId(enrollment)) === String(courseId)
    );
  }

  async function enroll(courseId) {
    setStatus((prev) => ({
      ...prev,
      error: "",
      message: "",
      submittingId: courseId,
    }));

    try {
      const response = await api.post(`/courses/${courseId}/enroll`);
      await loadData();

      setStatus({
        loading: false,
        error: "",
        message: response.data.message || "Enrolled successfully.",
        submittingId: "",
      });
    } catch (error) {
      setStatus({
        loading: false,
        error: error.response?.data?.message || "Enrollment failed.",
        message: "",
        submittingId: "",
      });
    }
  }

  async function unenroll(courseId) {
    const confirmed = window.confirm(
      "Do you want to unenroll from this course? You can enroll again later if the course is still available."
    );

    if (!confirmed) {
      return;
    }

    setStatus((prev) => ({
      ...prev,
      error: "",
      message: "",
      submittingId: courseId,
    }));

    try {
      const response = await api.delete(`/courses/${courseId}/enroll`);
      await loadData();

      setStatus({
        loading: false,
        error: "",
        message: response.data.message || "Unenrolled successfully.",
        submittingId: "",
      });
    } catch (error) {
      setStatus({
        loading: false,
        error: error.response?.data?.message || "Unenrollment failed.",
        message: "",
        submittingId: "",
      });
    }
  }

  if (status.loading) {
    return (
      <main className="dashboard-shell with-bottom-nav">
        <p>Loading courses...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-shell with-bottom-nav">
      <nav className="dashboard-nav">
        <div>
          <span className="brand-badge">TradeLab</span>
          <h1>Courses</h1>
          <p className="dashboard-subtitle">
            Learn investing concepts through approved instructor courses.
          </p>
        </div>

        <div className="user-pill">
          {user?.displayName || user?.name || "User"}
        </div>
      </nav>

      {status.message && <p className="success">{status.message}</p>}
      {status.error && <p className="error">{status.error}</p>}

      <section className="course-grid">
        {courses.length === 0 ? (
          <article className="dashboard-card">
            <p>No approved courses yet.</p>
          </article>
        ) : (
          courses.map((course) => {
            const enrolled = isEnrolled(course.id);
            const isSubmitting = status.submittingId === course.id;

            return (
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

                  {user?.role === "USER" ? (
                    enrolled ? (
                      <button
                        type="button"
                        className="danger-button"
                        onClick={() => unenroll(course.id)}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Processing..." : "Unenroll"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => enroll(course.id)}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Processing..." : "Enroll"}
                      </button>
                    )
                  ) : (
                    <button disabled>Users only</button>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>

      <BottomNav user={user} />
    </main>
  );
}
