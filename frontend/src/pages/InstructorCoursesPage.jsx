import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { api } from "../api";
import BottomNav from "../components/BottomNav.jsx";

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

const defaultForm = {
  title: "",
  description: "",
  level: "BEGINNER",
  tags: "",
};

export default function InstructorCoursesPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedEnrollments, setSelectedEnrollments] = useState([]);
  const [form, setForm] = useState(defaultForm);

  const [status, setStatus] = useState({
    loading: true,
    error: "",
    message: "",
    submitting: false,
  });

  const selectedCourse = useMemo(() => {
    return courses.find((course) => course.id === selectedCourseId) || null;
  }, [courses, selectedCourseId]);

  async function loadCourseEnrollments(courseId) {
    if (!courseId) {
      setSelectedEnrollments([]);
      return;
    }

    const response = await api.get(
      `/instructor/courses/${courseId}/enrollments`
    );

    setSelectedEnrollments(response.data.enrollments || []);
  }

  async function loadData(nextSelectedId) {
    const [meResponse, coursesResponse] = await Promise.all([
      api.get("/auth/me"),
      api.get("/instructor/courses"),
    ]);

    const currentUser = meResponse.data.user;

    if (currentUser.role !== "INSTRUCTOR") {
      setUser(currentUser);
      setStatus({
        loading: false,
        error: "Only INSTRUCTOR accounts can access this page.",
        message: "",
        submitting: false,
      });
      return;
    }

    const nextCourses = coursesResponse.data.courses || [];
    const nextId = nextSelectedId || selectedCourseId || nextCourses[0]?.id || "";

    setUser(currentUser);
    setCourses(nextCourses);
    setSelectedCourseId(nextId);

    if (nextId) {
      await loadCourseEnrollments(nextId);
    } else {
      setSelectedEnrollments([]);
    }

    setStatus({
      loading: false,
      error: "",
      message: "",
      submitting: false,
    });
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
          submitting: false,
        });
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  useEffect(() => {
    async function updateEnrollments() {
      try {
        await loadCourseEnrollments(selectedCourseId);
      } catch {
        setSelectedEnrollments([]);
      }
    }

    if (selectedCourseId) {
      updateEnrollments();
    }
  }, [selectedCourseId]);

  function updateField(event) {
    setForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  }

  async function createCourse(event) {
    event.preventDefault();

    setStatus((prev) => ({
      ...prev,
      error: "",
      message: "",
      submitting: true,
    }));

    try {
      const response = await api.post("/instructor/courses", form);
      const createdId = response.data.course?.id || "";

      setForm(defaultForm);

      await loadData(createdId);

      setStatus({
        loading: false,
        error: "",
        message: response.data.message || "Course created.",
        submitting: false,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error: error.response?.data?.message || "Failed to create course.",
        message: "",
        submitting: false,
      });
    }
  }

  async function deleteCourse(courseId) {
    if (!window.confirm("Delete this course?")) {
      return;
    }

    try {
      await api.delete(`/instructor/courses/${courseId}`);

      const nextCourse = courses.find((course) => course.id !== courseId);
      await loadData(nextCourse?.id || "");

      setStatus({
        loading: false,
        error: "",
        message: "Course deleted.",
        submitting: false,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error: error.response?.data?.message || "Failed to delete course.",
        message: "",
        submitting: false,
      });
    }
  }

  if (status.loading) {
    return (
      <main className="dashboard-shell with-bottom-nav">
        <p>Loading instructor courses...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-shell with-bottom-nav">
      <nav className="dashboard-nav">
        <div>
          <span className="brand-badge">TradeLab</span>
          <h1>Instructor Courses</h1>
          <p className="dashboard-subtitle">
            Manage your courses, lessons, videos, and enrolled users.
          </p>
        </div>

        <div className="user-pill">
          {user?.displayName || user?.name || "Instructor"}
        </div>
      </nav>

      {status.message && <p className="success">{status.message}</p>}
      {status.error && <p className="error">{status.error}</p>}

      {!status.error && (
        <section className="dashboard-grid instructor-grid">
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

              <button disabled={status.submitting}>
                {status.submitting ? "Creating..." : "Create course"}
              </button>
            </form>
          </article>

          <article className="dashboard-card wide">
            <p className="eyebrow">My courses</p>
            <h3>Course management</h3>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Course</th>
                    <th>Level</th>
                    <th>Status</th>
                    <th>Published</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {courses.length === 0 ? (
                    <tr>
                      <td colSpan="6">No courses yet.</td>
                    </tr>
                  ) : (
                    courses.map((course) => (
                      <tr
                        key={course.id}
                        className={
                          selectedCourseId === course.id ? "selected-row" : ""
                        }
                      >
                        <td>
                          <strong>{course.title}</strong>
                          <span>{course.description}</span>
                        </td>
                        <td>{course.level}</td>
                        <td>{course.approvalStatus}</td>
                        <td>{course.isPublished ? "Yes" : "No"}</td>
                        <td>{formatDate(course.createdAt)}</td>
                        <td>
                          <div className="inline-actions">
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() => setSelectedCourseId(course.id)}
                            >
                              View users
                            </button>
                            <Link
                              className="secondary-button link-button"
                              to={`/instructor/courses/${course.id}/edit`}
                            >
                              Edit lessons
                            </Link>
                            <button
                              type="button"
                              className="danger-button"
                              onClick={() => deleteCourse(course.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="dashboard-card wide">
            <p className="eyebrow">Selected course</p>
            <h3>{selectedCourse?.title || "Select a course"}</h3>

            {!selectedCourse ? (
              <p className="muted-text">
                Select a course to see enrolled users.
              </p>
            ) : (
              <>
                <div className="compact-list">
                  <div className="compact-row">
                    <div>
                      <strong>Status</strong>
                      <span>{selectedCourse.approvalStatus}</span>
                    </div>
                    <em>{selectedCourse.isPublished ? "Published" : "Hidden"}</em>
                  </div>

                  <div className="compact-row">
                    <div>
                      <strong>Enrollment count</strong>
                      <span>Users currently enrolled in this course</span>
                    </div>
                    <em>{selectedEnrollments.length}</em>
                  </div>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Progress</th>
                        <th>Enrolled at</th>
                      </tr>
                    </thead>

                    <tbody>
                      {selectedEnrollments.length === 0 ? (
                        <tr>
                          <td colSpan="5">No enrolled users yet.</td>
                        </tr>
                      ) : (
                        selectedEnrollments.map((enrollment) => (
                          <tr key={enrollment.id}>
                            <td>
                              {enrollment.user?.displayName ||
                                enrollment.user?.name ||
                                "User"}
                            </td>
                            <td>{enrollment.user?.email || "-"}</td>
                            <td>{enrollment.status}</td>
                            <td>{formatPercent(enrollment.progressPercent)}</td>
                            <td>{formatDate(enrollment.enrolledAt)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </article>
        </section>
      )}

      <BottomNav user={user} />
    </main>
  );
}
