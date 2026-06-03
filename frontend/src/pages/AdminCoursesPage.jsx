import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

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

function statusClass(status) {
  const upper = String(status || "").toUpperCase();

  if (upper === "APPROVED") {
    return "positive";
  }

  if (upper === "REJECTED") {
    return "negative";
  }

  return "";
}

export default function AdminCoursesPage() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [courses, setCourses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [selectedCourseEnrollments, setSelectedCourseEnrollments] = useState([]);
  const [selectedCourse, setSelectedCourse] = useState(null);

  const [status, setStatus] = useState({
    loading: true,
    error: "",
    message: "",
    submitting: false,
  });

  const pendingCourses = useMemo(() => {
    return courses.filter(
      (course) => String(course.approvalStatus || "").toUpperCase() === "PENDING_APPROVAL"
    );
  }, [courses]);

  const selectedCourseSummary = useMemo(() => {
    return courses.find((course) => course.id === selectedCourseId) || null;
  }, [courses, selectedCourseId]);

  async function loadOverview(nextSelectedId) {
    const [meResponse, overviewResponse] = await Promise.all([
      api.get("/auth/me"),
      api.get("/admin/courses/overview"),
    ]);

    const me = meResponse.data.user;

    if (me.role !== "ADMIN") {
      navigate("/dashboard");
      return;
    }

    const nextCourses = overviewResponse.data.courses || [];
    const nextSelectedCourseId =
      nextSelectedId || selectedCourseId || nextCourses[0]?.id || "";

    setCurrentUser(me);
    setCourses(nextCourses);
    setInstructors(overviewResponse.data.instructors || []);
    setSelectedCourseId(nextSelectedCourseId);

    if (nextSelectedCourseId) {
      await loadCourseEnrollments(nextSelectedCourseId);
    }
  }

  async function loadCourseEnrollments(courseId) {
    if (!courseId) {
      setSelectedCourse(null);
      setSelectedCourseEnrollments([]);
      return;
    }

    const response = await api.get(`/admin/courses/${courseId}/enrollments`);

    setSelectedCourse(response.data.course);
    setSelectedCourseEnrollments(response.data.enrollments || []);
  }

  useEffect(() => {
    async function init() {
      try {
        await loadOverview();

        setStatus({
          loading: false,
          error: "",
          message: "",
          submitting: false,
        });
      } catch (error) {
        if (error.response?.status === 401) {
          navigate("/login");
          return;
        }

        setStatus({
          loading: false,
          error: error.response?.data?.message || "Failed to load admin courses.",
          message: "",
          submitting: false,
        });
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  useEffect(() => {
    async function updateSelectedCourse() {
      try {
        await loadCourseEnrollments(selectedCourseId);
      } catch {
        setSelectedCourse(null);
        setSelectedCourseEnrollments([]);
      }
    }

    if (selectedCourseId) {
      updateSelectedCourse();
    }
  }, [selectedCourseId]);

  async function approveCourse(courseId) {
    setStatus((prev) => ({
      ...prev,
      error: "",
      message: "",
      submitting: true,
    }));

    try {
      const response = await api.patch(`/admin/courses/${courseId}/approve`);
      await loadOverview(courseId);

      setStatus({
        loading: false,
        error: "",
        message: response.data.message || "Course approved.",
        submitting: false,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error: error.response?.data?.message || "Failed to approve course.",
        message: "",
        submitting: false,
      });
    }
  }

  async function rejectCourse(courseId) {
    const rejectionReason = window.prompt(
      "Reason for rejection:",
      "Needs revision before publication."
    );

    if (rejectionReason === null) {
      return;
    }

    setStatus((prev) => ({
      ...prev,
      error: "",
      message: "",
      submitting: true,
    }));

    try {
      const response = await api.patch(`/admin/courses/${courseId}/reject`, {
        rejectionReason,
      });

      await loadOverview(courseId);

      setStatus({
        loading: false,
        error: "",
        message: response.data.message || "Course rejected.",
        submitting: false,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error: error.response?.data?.message || "Failed to reject course.",
        message: "",
        submitting: false,
      });
    }
  }

  if (status.loading) {
    return (
      <main className="dashboard-shell with-bottom-nav">
        <p>Loading admin courses...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-shell with-bottom-nav">
      <nav className="dashboard-nav">
        <div>
          <span className="brand-badge">TradeLab Admin</span>
          <h1>Courses</h1>
          <p className="dashboard-subtitle">
            Review courses, instructors, approvals, and course enrollment.
          </p>
        </div>

        <div className="user-pill">
          {currentUser?.displayName || currentUser?.name || "Admin"}
        </div>
      </nav>

      {status.error && <p className="error">{status.error}</p>}
      {status.message && <p className="success">{status.message}</p>}

      <section className="stats-grid">
        <article className="stat-card">
          <span>Total Courses</span>
          <strong>{courses.length}</strong>
        </article>

        <article className="stat-card">
          <span>Pending Approval</span>
          <strong>{pendingCourses.length}</strong>
        </article>

        <article className="stat-card">
          <span>Approved Courses</span>
          <strong>
            {
              courses.filter(
                (course) => String(course.approvalStatus || "").toUpperCase() === "APPROVED"
              ).length
            }
          </strong>
        </article>

        <article className="stat-card">
          <span>Instructors</span>
          <strong>{instructors.length}</strong>
        </article>
      </section>

      <section className="dashboard-grid admin-grid">
        <article className="dashboard-card wide">
          <p className="eyebrow">Courses</p>
          <h3>Course approval and enrollment</h3>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Instructor</th>
                  <th>Status</th>
                  <th>Published</th>
                  <th>Enrollments</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {courses.length === 0 ? (
                  <tr>
                    <td colSpan="7">No courses found.</td>
                  </tr>
                ) : (
                  courses.map((course) => (
                    <tr key={course.id}>
                      <td>
                        <strong>{course.title}</strong>
                        <span>{course.description}</span>
                      </td>
                      <td>
                        <strong>{course.instructor?.displayName || "-"}</strong>
                        <span>{course.instructor?.email || ""}</span>
                      </td>
                      <td className={statusClass(course.approvalStatus)}>
                        {course.approvalStatus}
                      </td>
                      <td>{course.isPublished ? "Yes" : "No"}</td>
                      <td>{course.enrollmentCount || 0}</td>
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
                          <button
                            type="button"
                            disabled={status.submitting}
                            onClick={() => approveCourse(course.id)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="danger-button"
                            disabled={status.submitting}
                            onClick={() => rejectCourse(course.id)}
                          >
                            Reject
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
          <h3>{selectedCourse?.title || selectedCourseSummary?.title || "Course detail"}</h3>

          {!selectedCourse && !selectedCourseSummary ? (
            <p className="muted-text">Select a course to inspect enrolled users.</p>
          ) : (
            <div className="admin-detail-grid">
              <section className="admin-detail-panel">
                <h3>Course summary</h3>
                <div className="compact-list">
                  <div className="compact-row">
                    <div>
                      <strong>Status</strong>
                      <span>Approval state</span>
                    </div>
                    <em className={statusClass(selectedCourse?.approvalStatus)}>
                      {selectedCourse?.approvalStatus || "-"}
                    </em>
                  </div>

                  <div className="compact-row">
                    <div>
                      <strong>Instructor</strong>
                      <span>{selectedCourse?.instructor?.email || "-"}</span>
                    </div>
                    <em>{selectedCourse?.instructor?.displayName || "-"}</em>
                  </div>

                  <div className="compact-row">
                    <div>
                      <strong>Enrolled users</strong>
                      <span>Total active enrollments</span>
                    </div>
                    <em>{selectedCourseEnrollments.length}</em>
                  </div>
                </div>
              </section>

              <section className="admin-detail-panel">
                <h3>Users in this course</h3>
                {selectedCourseEnrollments.length === 0 ? (
                  <p className="muted-text">No users enrolled in this course.</p>
                ) : (
                  <div className="compact-list">
                    {selectedCourseEnrollments.map((enrollment) => (
                      <div className="compact-row" key={enrollment.id}>
                        <div>
                          <strong>
                            {enrollment.user?.displayName ||
                              enrollment.user?.name ||
                              "User"}
                          </strong>
                          <span>
                            {enrollment.user?.email} · {enrollment.status} ·{" "}
                            {enrollment.progressPercent}%
                          </span>
                        </div>
                        <em>{formatDate(enrollment.enrolledAt)}</em>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </article>

        <article className="dashboard-card wide">
          <p className="eyebrow">Instructors</p>
          <h3>Instructor course ownership</h3>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Instructor</th>
                  <th>Email</th>
                  <th>Verified</th>
                  <th>Course Count</th>
                  <th>Joined</th>
                </tr>
              </thead>

              <tbody>
                {instructors.length === 0 ? (
                  <tr>
                    <td colSpan="5">No instructors found.</td>
                  </tr>
                ) : (
                  instructors.map((instructor) => (
                    <tr key={instructor.id}>
                      <td>{instructor.displayName || instructor.name}</td>
                      <td>{instructor.email}</td>
                      <td>{instructor.isEmailVerified ? "Yes" : "No"}</td>
                      <td>{instructor.courseCount || 0}</td>
                      <td>{formatDate(instructor.createdAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <BottomNav user={currentUser} />
    </main>
  );
}
