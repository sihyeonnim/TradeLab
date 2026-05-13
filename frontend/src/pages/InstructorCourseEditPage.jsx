import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api";
import { buildVideoSrc, canPlayLocalVideo } from "../video";

export default function InstructorCourseEditPage() {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);

  const [courseForm, setCourseForm] = useState({
    title: "",
    description: "",
    level: "BEGINNER",
    tags: "",
  });

  const [lessonForm, setLessonForm] = useState({
    title: "",
    summary: "",
    contentMarkdown: "",
    order: 1,
    durationMinutes: "",
    video: null,
  });

  const [status, setStatus] = useState({
    loading: true,
    error: "",
    message: "",
  });

  async function loadData() {
    const [courseResponse, lessonsResponse] = await Promise.all([
      api.get(`/courses/${courseId}`),
      api.get(`/courses/${courseId}/lessons`),
    ]);

    const loadedCourse = courseResponse.data.course;

    setCourse(loadedCourse);
    setLessons(lessonsResponse.data.lessons || []);

    setCourseForm({
      title: loadedCourse.title || "",
      description: loadedCourse.description || "",
      level: loadedCourse.level || "BEGINNER",
      tags: (loadedCourse.tags || []).join(", "),
    });

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
          error: error.response?.data?.message || "Failed to load course.",
          message: "",
        });
      }
    }

    init();
  }, [courseId, navigate]);

  function updateCourseField(event) {
    setCourseForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  }

  function updateLessonField(event) {
    const { name, value, files } = event.target;

    setLessonForm((prev) => ({
      ...prev,
      [name]: files ? files[0] : value,
    }));
  }

  async function saveCourse(event) {
    event.preventDefault();

    try {
      const response = await api.patch(
        `/instructor/courses/${courseId}`,
        courseForm
      );

      await loadData();

      setStatus({
        loading: false,
        error: "",
        message: response.data.message,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error: error.response?.data?.message || "Failed to update course.",
        message: "",
      });
    }
  }

  async function createLesson(event) {
    event.preventDefault();

    const formData = new FormData();
    formData.append("title", lessonForm.title);
    formData.append("summary", lessonForm.summary);
    formData.append("contentMarkdown", lessonForm.contentMarkdown);
    formData.append("order", lessonForm.order);
    formData.append("durationMinutes", lessonForm.durationMinutes);

    if (lessonForm.video) {
      formData.append("video", lessonForm.video);
    }

    try {
      const response = await api.post(
        `/instructor/courses/${courseId}/lessons`,
        formData
      );

      setLessonForm({
        title: "",
        summary: "",
        contentMarkdown: "",
        order: lessons.length + 2,
        durationMinutes: "",
        video: null,
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
        error: error.response?.data?.message || "Failed to create lesson.",
        message: "",
      });
    }
  }

  async function deleteLesson(lessonId) {
    if (!window.confirm("Delete this lesson?")) {
      return;
    }

    try {
      await api.delete(`/instructor/lessons/${lessonId}`);
      await loadData();
    } catch (error) {
      setStatus({
        loading: false,
        error: error.response?.data?.message || "Failed to delete lesson.",
        message: "",
      });
    }
  }

  if (status.loading) {
    return (
      <main className="dashboard-shell">
        <p>Loading course editor...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <nav className="dashboard-nav">
        <div>
          <span className="brand-badge">TradeLab</span>
          <h1>Edit Course</h1>
          <p className="dashboard-subtitle">{course?.title}</p>
        </div>

        <Link className="nav-button" to="/instructor/courses">
          Instructor Courses
        </Link>
      </nav>

      {status.message && <p className="success">{status.message}</p>}
      {status.error && <p className="error">{status.error}</p>}

      <section className="dashboard-grid">
        <article className="dashboard-card wide">
          <p className="eyebrow">Course</p>
          <h3>Basic information</h3>

          <form className="course-form" onSubmit={saveCourse}>
            <label>
              Title
              <input
                name="title"
                value={courseForm.title}
                onChange={updateCourseField}
              />
            </label>

            <label>
              Description
              <textarea
                name="description"
                value={courseForm.description}
                onChange={updateCourseField}
              />
            </label>

            <label>
              Level
              <select
                name="level"
                value={courseForm.level}
                onChange={updateCourseField}
              >
                <option value="BEGINNER">BEGINNER</option>
                <option value="INTERMEDIATE">INTERMEDIATE</option>
                <option value="ADVANCED">ADVANCED</option>
              </select>
            </label>

            <label>
              Tags
              <input
                name="tags"
                value={courseForm.tags}
                onChange={updateCourseField}
              />
            </label>

            <button>Save course</button>
          </form>
        </article>

        <article className="dashboard-card wide">
          <p className="eyebrow">Lessons</p>
          <h3>Add lesson</h3>

          <form className="course-form" onSubmit={createLesson}>
            <label>
              Title
              <input
                name="title"
                value={lessonForm.title}
                onChange={updateLessonField}
                required
              />
            </label>

            <label>
              Summary
              <input
                name="summary"
                value={lessonForm.summary}
                onChange={updateLessonField}
              />
            </label>

            <label>
              Content
              <textarea
                name="contentMarkdown"
                value={lessonForm.contentMarkdown}
                onChange={updateLessonField}
              />
            </label>

            <label>
              Order
              <input
                name="order"
                type="number"
                min="1"
                value={lessonForm.order}
                onChange={updateLessonField}
              />
            </label>

            <label>
              Duration minutes
              <input
                name="durationMinutes"
                type="number"
                min="0"
                value={lessonForm.durationMinutes}
                onChange={updateLessonField}
              />
            </label>

            <label>
              Video file
              <input
                name="video"
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={updateLessonField}
              />
            </label>

            <button>Create lesson</button>
          </form>
        </article>

        <article className="dashboard-card wide">
          <p className="eyebrow">Existing lessons</p>
          <h3>Lessons in this course</h3>

          <div className="lesson-list">
            {lessons.length === 0 ? (
              <p>No lessons yet.</p>
            ) : (
              lessons.map((lesson) => {
                const videoSrc = canPlayLocalVideo(lesson)
                  ? buildVideoSrc(lesson.video.path)
                  : null;

                return (
                  <div className="lesson-card" key={lesson.id}>
                    <div>
                      <p className="eyebrow">Lesson {lesson.order}</p>
                      <h3>{lesson.title}</h3>
                      <p>{lesson.summary}</p>
                      <p className="muted-text">{lesson.contentMarkdown}</p>
                    </div>

                    {videoSrc ? (
                      <video className="lesson-video" controls src={videoSrc} />
                    ) : (
                      <div className="video-placeholder">No uploaded video.</div>
                    )}

                    <button
                      className="danger-button"
                      onClick={() => deleteLesson(lesson.id)}
                    >
                      Delete lesson
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </article>
      </section>
    </main>
  );
}