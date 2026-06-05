import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import BottomNav from "../components/BottomNav.jsx";

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Number(value || 0));
}

function formatPercent(value) {
  const numberValue = Number(value || 0);
  const sign = numberValue > 0 ? "+" : "";
  return `${sign}${numberValue.toFixed(2)}%`;
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value) {
  return formatDateTime(value);
}

function formatParticipantPercent(entry) {
  if (entry?.scorePending || entry?.competitionStatus === "UPCOMING") {
    return "Pending";
  }

  return formatPercent(entry?.roi || 0);
}

function formatParticipantProfit(entry) {
  if (entry?.scorePending || entry?.competitionStatus === "UPCOMING") {
    return "Pending";
  }

  return formatCurrency(entry?.profit || 0);
}

function formatParticipantRank(entry) {
  if (entry?.scorePending || entry?.competitionStatus === "UPCOMING") {
    return "-";
  }

  return entry?.rank || "-";
}

const defaultForm = {
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  rankingMetric: "TOTAL_PORTFOLIO_ROI",
};

export default function CompetitionPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [competitions, setCompetitions] = useState([]);
  const [joinedCompetitions, setJoinedCompetitions] = useState([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);
  const [instructorCompetitions, setInstructorCompetitions] = useState([]);
  const [adminCompetitions, setAdminCompetitions] = useState([]);
  const [form, setForm] = useState(defaultForm);

  const [status, setStatus] = useState({
    loading: true,
    error: "",
    message: "",
    submitting: false,
  });

  const selectedCompetition = useMemo(() => {
    return (
      competitions.find(
        (competition) => competition.id === selectedCompetitionId
      ) ||
      adminCompetitions.find(
        (competition) => competition.id === selectedCompetitionId
      ) ||
      null
    );
  }, [competitions, adminCompetitions, selectedCompetitionId]);

  function getJoinedCompetitionStatus(item) {
    return (
      item?.competition?.status ||
      item?.participation?.competitionStatus ||
      "-"
    );
  }

  const activeJoinedCompetitions = useMemo(() => {
    return joinedCompetitions.filter(
      (item) => getJoinedCompetitionStatus(item) !== "ENDED"
    );
  }, [joinedCompetitions]);

  const completedJoinedCompetitions = useMemo(() => {
    return joinedCompetitions.filter(
      (item) => getJoinedCompetitionStatus(item) === "ENDED"
    );
  }, [joinedCompetitions]);

  async function loadLeaderboard(competitionId) {
    if (!competitionId) {
      setLeaderboard([]);
      return;
    }

    const response = await api.get(`/competitions/${competitionId}/leaderboard`);
    setLeaderboard(response.data.leaderboard || []);
  }

  async function loadData(nextSelectedId) {
    const [meResponse, competitionsResponse, joinedResponse] =
      await Promise.all([
        api.get("/auth/me"),
        api.get("/competitions"),
        api.get("/competitions/me").catch(() => ({
          data: { competitions: [] },
        })),
      ]);

    const currentUser = meResponse.data.user;
    const competitionList = competitionsResponse.data.competitions || [];

    setUser(currentUser);
    setCompetitions(competitionList);
    setJoinedCompetitions(joinedResponse.data.competitions || []);

    let nextId =
      nextSelectedId || selectedCompetitionId || competitionList[0]?.id || "";

    if (!nextId && joinedResponse.data.competitions?.[0]?.competition?.id) {
      nextId = joinedResponse.data.competitions[0].competition.id;
    }

    setSelectedCompetitionId(nextId);

    if (["INSTRUCTOR", "ADMIN"].includes(currentUser.role)) {
      const instructorResponse = await api
        .get("/competitions/instructor/me")
        .catch(() => ({ data: { competitions: [] } }));

      setInstructorCompetitions(instructorResponse.data.competitions || []);
    } else {
      setInstructorCompetitions([]);
    }

    if (currentUser.role === "ADMIN") {
      const adminResponse = await api
        .get("/competitions/admin/all")
        .catch(() => ({ data: { competitions: [] } }));

      setAdminCompetitions(adminResponse.data.competitions || []);
    } else {
      setAdminCompetitions([]);
    }

    if (nextId) {
      await loadLeaderboard(nextId);
    }
  }

  useEffect(() => {
    async function init() {
      try {
        await loadData();
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
          error:
            error.response?.data?.message ||
            "Failed to load competitions.",
          message: "",
          submitting: false,
        });
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  useEffect(() => {
    async function updateLeaderboard() {
      try {
        await loadLeaderboard(selectedCompetitionId);
      } catch {
        setLeaderboard([]);
      }
    }

    if (selectedCompetitionId) {
      updateLeaderboard();
    }
  }, [selectedCompetitionId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadData(selectedCompetitionId).catch(() => {});
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompetitionId]);

  function isJoined(competitionId) {
    return joinedCompetitions.some(
      (item) => String(item.competition?.id) === String(competitionId)
    );
  }

  async function joinCompetition(competitionId) {
    setStatus((prev) => ({
      ...prev,
      error: "",
      message: "",
      submitting: true,
    }));

    try {
      const response = await api.post(`/competitions/${competitionId}/join`);
      await loadData(competitionId);

      setStatus({
        loading: false,
        error: "",
        message: response.data.message || "Competition joined.",
        submitting: false,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error:
          error.response?.data?.message || "Failed to join competition.",
        message: "",
        submitting: false,
      });
    }
  }

  async function leaveCompetition(competitionId) {
    const confirmed = window.confirm(
      "Do you want to leave this competition? Your leaderboard record for this competition will be removed."
    );

    if (!confirmed) {
      return;
    }

    setStatus((prev) => ({
      ...prev,
      error: "",
      message: "",
      submitting: true,
    }));

    try {
      const response = await api.delete(`/competitions/${competitionId}/join`);

      let nextSelectedId = selectedCompetitionId;
      if (String(selectedCompetitionId) === String(competitionId)) {
        nextSelectedId = competitions.find(
          (competition) => String(competition.id) !== String(competitionId)
        )?.id || "";
      }

      await loadData(nextSelectedId);

      setStatus({
        loading: false,
        error: "",
        message: response.data.message || "Left competition successfully.",
        submitting: false,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error:
          error.response?.data?.message || "Failed to leave competition.",
        message: "",
        submitting: false,
      });
    }
  }


  function updateForm(event) {
    const { name, value } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  async function createCompetition(event) {
    event.preventDefault();

    setStatus((prev) => ({
      ...prev,
      error: "",
      message: "",
      submitting: true,
    }));

    try {
      const response = await api.post("/competitions/instructor", form);

      setForm(defaultForm);

      await loadData(response.data.competition?.id);

      setStatus({
        loading: false,
        error: "",
        message: response.data.message || "Competition created.",
        submitting: false,
      });
    } catch (error) {
      setStatus({
        loading: false,
        error:
          error.response?.data?.message ||
          "Failed to create competition.",
        message: "",
        submitting: false,
      });
    }
  }

  if (status.loading) {
    return (
      <main className="dashboard-shell with-bottom-nav">
        <p>Loading competition...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-shell with-bottom-nav">
      <nav className="dashboard-nav">
        <div>
          <span className="brand-badge">TradeLab</span>
          <h1>Competition</h1>
          <p className="dashboard-subtitle">
            Join portfolio ROI competitions and compare your performance.
          </p>
        </div>

        <div className="user-pill">
          {user?.displayName || user?.name || "User"}
        </div>
      </nav>

      {status.message && <p className="success">{status.message}</p>}
      {status.error && <p className="error">{status.error}</p>}

      <section className="dashboard-grid">
        <article className="dashboard-card wide">
          <p className="eyebrow">Available competitions</p>
          <h3>Join a competition</h3>

          {competitions.length === 0 ? (
            <p className="muted-text">No active or upcoming competitions.</p>
          ) : (
            <div className="competition-list">
              {competitions.map((competition) => (
                <div
                  className={`competition-card ${
                    selectedCompetitionId === competition.id ? "active" : ""
                  }`}
                  key={competition.id}
                >
                  <div>
                    <p className="eyebrow">{competition.status}</p>
                    <h3>{competition.title}</h3>
                    <p>{competition.description}</p>
                    <p className="muted-text">
                      {formatDateTime(competition.startDate)} →{" "}
                      {formatDateTime(competition.endDate)}
                    </p>
                    <p className="muted-text">
                      Metric: {competition.rankingMetric}
                    </p>
                  </div>

                  <div className="inline-actions">
                    <button
                      className="secondary-button"
                      onClick={() => setSelectedCompetitionId(competition.id)}
                    >
                      Leaderboard
                    </button>

                    {user?.role === "USER" ? (
                      isJoined(competition.id) ? (
                        <button
                          type="button"
                          className="danger-button"
                          onClick={() => leaveCompetition(competition.id)}
                          disabled={status.submitting}
                        >
                          {status.submitting ? "Processing..." : "Leave"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => joinCompetition(competition.id)}
                          disabled={status.submitting}
                        >
                          {status.submitting ? "Processing..." : "Join"}
                        </button>
                      )
                    ) : (
                      <button disabled>USER only</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="dashboard-card wide">
          <p className="eyebrow">Leaderboard</p>
          <h3>{selectedCompetition?.title || "Select a competition"}</h3>

          {leaderboard.length === 0 ? (
            <p className="muted-text">No participants yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>User</th>
                    <th>Start Value</th>
                    <th>Current Value</th>
                    <th>Profit</th>
                    <th>ROI</th>
                  </tr>
                </thead>

                <tbody>
                  {leaderboard.map((entry) => (
                    <tr key={entry.id}>
                      <td>{formatParticipantRank(entry)}</td>
                      <td>{entry.user?.name || "User"}</td>
                      <td>{formatCurrency(entry.startingPortfolioValue)}</td>
                      <td>{formatCurrency(entry.currentPortfolioValue)}</td>
                      <td>{formatParticipantProfit(entry)}</td>
                      <td>{formatParticipantPercent(entry)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        <article className="dashboard-card wide">
          <p className="eyebrow">My competitions</p>
          <h3>Active joined competitions</h3>

          {activeJoinedCompetitions.length === 0 ? (
            <p className="muted-text">You have no active or upcoming joined competitions.</p>
          ) : (
            <div className="compact-list">
              {activeJoinedCompetitions.map((item) => (
                <div className="compact-row" key={item.participation.id}>
                  <div>
                    <strong>{item.competition?.title}</strong>
                    <span>{item.competition?.status}</span>
                  </div>
                  <div className="inline-actions">
                    <em>{formatParticipantPercent(item.participation)}</em>
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() => leaveCompetition(item.competition?.id)}
                      disabled={status.submitting || !item.competition?.id}
                    >
                      Leave
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="dashboard-card wide">
          <p className="eyebrow">History</p>
          <h3>Past joined competitions</h3>

          {completedJoinedCompetitions.length === 0 ? (
            <p className="muted-text">No completed competition history yet.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Competition</th>
                    <th>Status</th>
                    <th>Final Rank</th>
                    <th>Final Profit</th>
                    <th>Final ROI</th>
                    <th>Period</th>
                  </tr>
                </thead>

                <tbody>
                  {completedJoinedCompetitions.map((item) => (
                    <tr key={item.participation.id}>
                      <td>{item.competition?.title || "Competition"}</td>
                      <td>{item.competition?.status || "ENDED"}</td>
                      <td>{formatParticipantRank(item.participation)}</td>
                      <td>{formatParticipantProfit(item.participation)}</td>
                      <td>{formatParticipantPercent(item.participation)}</td>
                      <td>
                        {formatDateTime(item.competition?.startDate)} → {" "}
                        {formatDateTime(item.competition?.endDate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>

        {["INSTRUCTOR", "ADMIN"].includes(user?.role) && (
          <article className="dashboard-card wide">
            <p className="eyebrow">Instructor</p>
            <h3>Create competition</h3>

            <form className="course-form" onSubmit={createCompetition}>
              <label>
                Title
                <input
                  name="title"
                  value={form.title}
                  onChange={updateForm}
                  required
                />
              </label>

              <label>
                Description
                <textarea
                  name="description"
                  value={form.description}
                  onChange={updateForm}
                />
              </label>

              <label>
                Start date
                <input
                  name="startDate"
                  type="datetime-local"
                  value={form.startDate}
                  onChange={updateForm}
                  required
                />
              </label>

              <label>
                End date
                <input
                  name="endDate"
                  type="datetime-local"
                  value={form.endDate}
                  onChange={updateForm}
                  required
                />
              </label>

              <label>
                Ranking metric
                <select
                  name="rankingMetric"
                  value={form.rankingMetric}
                  onChange={updateForm}
                >
                  <option value="TOTAL_PORTFOLIO_ROI">
                    TOTAL_PORTFOLIO_ROI
                  </option>
                  <option value="TOTAL_PORTFOLIO_PROFIT">
                    TOTAL_PORTFOLIO_PROFIT
                  </option>
                </select>
              </label>

              <button disabled={status.submitting}>
                {status.submitting ? "Creating..." : "Create Competition"}
              </button>
            </form>

            <h3>My created competitions</h3>

            {instructorCompetitions.length === 0 ? (
              <p className="muted-text">No created competitions.</p>
            ) : (
              <div className="compact-list">
                {instructorCompetitions.map((competition) => (
                  <div className="compact-row" key={competition.id}>
                    <div>
                      <strong>{competition.title}</strong>
                      <span>{competition.status}</span>
                    </div>
                    <em>{formatDateTime(competition.startDate)}</em>
                  </div>
                ))}
              </div>
            )}
          </article>
        )}

        {user?.role === "ADMIN" && (
          <article className="dashboard-card wide">
            <p className="eyebrow">Admin</p>
            <h3>All competitions</h3>

            {adminCompetitions.length === 0 ? (
              <p className="muted-text">No competitions found.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Creator</th>
                      <th>Status</th>
                      <th>Participants</th>
                      <th>Dates</th>
                    </tr>
                  </thead>

                  <tbody>
                    {adminCompetitions.map((competition) => (
                      <tr key={competition.id}>
                        <td>{competition.title}</td>
                        <td>{competition.createdBy?.name || "-"}</td>
                        <td>{competition.status}</td>
                        <td>{competition.participantCount || 0}</td>
                        <td>
                          {formatDateTime(competition.startDate)} →{" "}
                          {formatDateTime(competition.endDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        )}
      </section>

      <BottomNav user={user} />
    </main>
  );
}