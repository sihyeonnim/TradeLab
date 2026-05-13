import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";

export default function InstructorCoursesPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({
    title: "",
    description: "",
    level: "BEGINNER",
    tags: "",
  });

  const [status, setStatus] = useState({
    loading: true,
    error: "",
    message: "",
  });

  async function loadData() {
    const [meResponse, coursesResponse] = await Promise.all([
      api.get("/auth/me"),
      api.get("/instructor/courses"),
    ]);

    const currentUser = meResponse.data.user;

    if (!["INSTRUCTOR", "ADMIN"].includes(currentUser.role)) {
      setStatus({
        loading: false,
        error: "You are not authorized to access instructor courses.",
        message: "",
      });
      return;
    }

    setUser(currentUser);
    setCourses(coursesResponse.data.courses || []);
    setStatus({ loading: false, error: "", message: "" });
  }

  useEffect(() => {
    async function init() {
      try {
        await loadData();
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

  function updateField(event) {
    setForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  }

  async function createCourse(event) {
    event.preventDefault();

    try {
      const response = await api.post("/instructor/courses", form);
      setForm({
        title: "",
        description: "",
        level: "BEGINNER",
        tags: "",
      });

      await loadData();

      setStatus({
        loading: false,
        error: "",
        message: response.data.message,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error: error.response?.data?.message || "Failed to create course.",
        message: "",
      });
    }
  }

  async function deleteCourse(courseId) {
    if (!window.confirm("Delete this course?")) {
      return;
    }

    try {
      await api.delete(`/instructor/courses/${courseId}`);
      await loadData();
    } catch (error) {
      setStatus({
        loading: false,
        error: error.response?.data?.message || "Failed to delete course.",
        message: "",
      });
    }
  }

  if (status.loading) {
    return (
      <main className="dashboard-shell">
        <p>Loading instructor courses...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <nav className="dashboard-nav">
        <div>
          <span className="brand-badge">TradeLab</span>
          <h1>Instructor Courses</h1>
          <p className="dashboard-subtitle">
            Create courses and submit them for admin approval.
          </p>
        </div>

        <Link className="nav-button" to="/dashboard">
          Dashboard
        </Link>
      </nav>

      {status.message && <p className="success">{status.message}</p>}
      {status.error && <p className="error">{status.error}</p>}

      {!status.error && (
        <section className="dashboard-grid">
          <article className="dashboard-card wide">
            <p className="eyebrow">Create course</p>
            <h3>New instructor course</h3>

            <form className="course-form" onSubmit={createCourse}>
              <label>
                Title
                <input
                  name="title"
                  value={form.title}
                  onChange={updateField}
                  required
                />
              </label>

              <label>
                Description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={updateField}
                  required
                />
              </label>

              <label>
                Level
                <select name="level" value={form.level} onChange={updateField}>
                  <option value="BEGINNER">BEGINNER</option>
                  <option value="INTERMEDIATE">INTERMEDIATE</option>
                  <option value="ADVANCED">ADVANCED</option>
                </select>
              </label>

              <label>
                Tags
                <input
                  name="tags"
                  value={form.tags}
                  onChange={updateField}
                  placeholder="ETF, stock, risk"
                />
              </label>

              <button>Create course</button>
            </form>
          </article>

          <article className="dashboard-card wide">
            <p className="eyebrow">My courses</p>
            <h3>Course management</h3>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Level</th>
                    <th>Status</th>
                    <th>Published</th>
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
                      <td>{course.level}</td>
                      <td>{course.approvalStatus}</td>
                      <td>{course.isPublished ? "Yes" : "No"}</td>
                      <td>
                        <div className="inline-actions">
                          <Link
                            className="secondary-button link-button"
                            to={`/instructor/courses/${course.id}/edit`}
                          >
                            Edit
                          </Link>
                          <button
                            className="danger-button"
                            onClick={() => deleteCourse(course.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      )}
    </main>
  );
}