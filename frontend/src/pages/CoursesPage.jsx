import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

function formatPrice(value) {
  const n = Number(value || 0);
  if (n <= 0) return "Free";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function CoursesPage() {
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [search, setSearch] = useState("");
  const [level, setLevel] = useState("ALL");
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [actionMsg, setActionMsg] = useState("");

  async function load() {
    const params = {};
    if (search.trim()) params.search = search.trim();
    if (level !== "ALL") params.level = level;

    const [browseRes, enrollRes] = await Promise.all([
      api.get("/courses/browse", { params }),
      api.get("/enrollments/me"),
    ]);

    setCourses(browseRes.data.courses || []);
    setEnrollments(enrollRes.data.enrollments || []);
    setStatus({ loading: false, error: "" });
  }

  useEffect(() => {
    async function init() {
      try {
        await load();
      } catch (error) {
        if (error.response?.status === 401) {
          navigate("/login");
          return;
        }
        setStatus({
          loading: false,
          error: error.response?.data?.message || "Failed to load courses.",
        });
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function handleSearch(event) {
    event.preventDefault();
    setStatus((s) => ({ ...s, loading: true }));
    try {
      await load();
    } catch {
      setStatus({ loading: false, error: "Search failed." });
    }
  }

  async function handleEnroll(courseId) {
    setActionMsg("");
    try {
      const res = await api.post(`/courses/${courseId}/enroll`);
      setActionMsg(res.data.message || "Enrolled.");
      await load();
    } catch (error) {
      setActionMsg(error.response?.data?.message || "Enrollment failed.");
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
            Browse approved courses and track your learning.
          </p>
        </div>
        <button className="secondary-button" onClick={() => navigate("/dashboard")}>
          Back to dashboard
        </button>
      </nav>

      <section className="dashboard-grid">
        {enrollments.length > 0 && (
          <article className="dashboard-card wide">
            <p className="eyebrow">My learning</p>
            <h3>Enrolled courses</h3>
            <div className="course-grid">
              {enrollments.map((enrollment) => (
                <button
                  type="button"
                  key={enrollment.id}
                  className="course-tile clickable-row"
                  onClick={() => navigate(`/courses/${enrollment.course.id}`)}
                >
                  <strong>{enrollment.course.title}</strong>
                  <span>{enrollment.course.instructor?.name || "Instructor"}</span>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${enrollment.progressPercent}%` }}
                    />
                  </div>
                  <em>{enrollment.progressPercent}% complete</em>
                </button>
              ))}
            </div>
          </article>
        )}

        <article className="dashboard-card wide">
          <div className="section-title-row">
            <div>
              <p className="eyebrow">Catalog</p>
              <h3>Explore courses</h3>
            </div>
          </div>

          <form className="filters-row" onSubmit={handleSearch}>
            <label>
              Search
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Title, tag, keyword"
              />
            </label>
            <label>
              Level
              <select value={level} onChange={(e) => setLevel(e.target.value)}>
                <option value="ALL">All levels</option>
                <option value="BEGINNER">Beginner</option>
                <option value="INTERMEDIATE">Intermediate</option>
                <option value="ADVANCED">Advanced</option>
              </select>
            </label>
            <button className="secondary-button" type="submit">
              Apply
            </button>
          </form>

          {actionMsg && <p className="success">{actionMsg}</p>}
          {status.error && <p className="error">{status.error}</p>}

          {courses.length === 0 ? (
            <p>No courses match your filters.</p>
          ) : (
            <div className="course-grid">
              {courses.map((course) => (
                <div className="course-tile" key={course.id}>
                  <div
                    className="course-tile-body clickable-row"
                    onClick={() => navigate(`/courses/${course.id}`)}
                  >
                    <div className="course-tile-head">
                      <strong>{course.title}</strong>
                      <span className="level-pill">{course.level}</span>
                    </div>
                    <p className="course-desc">{course.description}</p>
                    <span className="course-meta">
                      {course.instructor?.name || "Instructor"} ·{" "}
                      {course.lessonCount} lessons · {formatPrice(course.price)}
                    </span>
                  </div>
                  {course.isEnrolled ? (
                    <button
                      className="secondary-button"
                      onClick={() => navigate(`/courses/${course.id}`)}
                    >
                      Continue
                    </button>
                  ) : (
                    <button onClick={() => handleEnroll(course.id)}>Enroll</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </article>
      </section>
    </main>
  );
}
