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

const defaultForm = {
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  rankingMetric: "TOTAL_PORTFOLIO_ROI",
};

export default function InstructorCompetitionsPage() {
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [competitions, setCompetitions] = useState([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
  const [participants, setParticipants] = useState([]);
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
      ) || null
    );
  }, [competitions, selectedCompetitionId]);

  async function loadParticipants(competitionId) {
    if (!competitionId) {
      setParticipants([]);
      return;
    }

    const response = await api.get(
      `/competitions/instructor/${competitionId}/participants`
    );

    setParticipants(response.data.participants || []);
  }

  async function loadData(nextSelectedId) {
    const [meResponse, competitionsResponse] = await Promise.all([
      api.get("/auth/me"),
      api.get("/competitions/instructor/me"),
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

    const nextCompetitions = competitionsResponse.data.competitions || [];
    const nextId =
      nextSelectedId || selectedCompetitionId || nextCompetitions[0]?.id || "";

    setUser(currentUser);
    setCompetitions(nextCompetitions);
    setSelectedCompetitionId(nextId);

    if (nextId) {
      await loadParticipants(nextId);
    } else {
      setParticipants([]);
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
          error:
            error.response?.data?.message ||
            "Failed to load instructor competitions.",
          message: "",
          submitting: false,
        });
      }
    }

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  useEffect(() => {
    async function updateParticipants() {
      try {
        await loadParticipants(selectedCompetitionId);
      } catch {
        setParticipants([]);
      }
    }

    if (selectedCompetitionId) {
      updateParticipants();
    }
  }, [selectedCompetitionId]);

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
      const createdId = response.data.competition?.id || "";

      setForm(defaultForm);

      await loadData(createdId);

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
        <p>Loading instructor competitions...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-shell with-bottom-nav">
      <nav className="dashboard-nav">
        <div>
          <span className="brand-badge">TradeLab</span>
          <h1>Instructor Competitions</h1>
          <p className="dashboard-subtitle">
            Create competitions and monitor participants.
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
            <p className="eyebrow">Create competition</p>
            <h3>New competition</h3>

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
                  required
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
                {status.submitting ? "Creating..." : "Create competition"}
              </button>
            </form>
          </article>

          <article className="dashboard-card wide">
            <p className="eyebrow">My competitions</p>
            <h3>Competition management</h3>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Competition</th>
                    <th>Status</th>
                    <th>Metric</th>
                    <th>Dates</th>
                    <th>Participants</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {competitions.length === 0 ? (
                    <tr>
                      <td colSpan="6">No competitions yet.</td>
                    </tr>
                  ) : (
                    competitions.map((competition) => (
                      <tr
                        key={competition.id}
                        className={
                          selectedCompetitionId === competition.id
                            ? "selected-row"
                            : ""
                        }
                      >
                        <td>
                          <strong>{competition.title}</strong>
                          <span>{competition.description}</span>
                        </td>
                        <td>{competition.status}</td>
                        <td>{competition.rankingMetric}</td>
                        <td>
                          {formatDate(competition.startDate)} →{" "}
                          {formatDate(competition.endDate)}
                        </td>
                        <td>{competition.participantCount ?? "-"}</td>
                        <td>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() =>
                              setSelectedCompetitionId(competition.id)
                            }
                          >
                            View participants
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="dashboard-card wide">
            <p className="eyebrow">Selected competition</p>
            <h3>{selectedCompetition?.title || "Select a competition"}</h3>

            {!selectedCompetition ? (
              <p className="muted-text">
                Select a competition to see participants.
              </p>
            ) : (
              <>
                <div className="compact-list">
                  <div className="compact-row">
                    <div>
                      <strong>Status</strong>
                      <span>{selectedCompetition.status}</span>
                    </div>
                    <em>{selectedCompetition.rankingMetric}</em>
                  </div>

                  <div className="compact-row">
                    <div>
                      <strong>Participant count</strong>
                      <span>Users currently joined in this competition</span>
                    </div>
                    <em>{participants.length}</em>
                  </div>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>User</th>
                        <th>Email</th>
                        <th>Start Value</th>
                        <th>Current Value</th>
                        <th>Profit</th>
                        <th>ROI</th>
                        <th>Joined at</th>
                      </tr>
                    </thead>

                    <tbody>
                      {participants.length === 0 ? (
                        <tr>
                          <td colSpan="8">No participants yet.</td>
                        </tr>
                      ) : (
                        participants.map((participant) => (
                          <tr key={participant.id}>
                            <td>{participant.rank || "-"}</td>
                            <td>
                              {participant.user?.displayName ||
                                participant.user?.name ||
                                "User"}
                            </td>
                            <td>{participant.user?.email || "-"}</td>
                            <td>
                              {formatCurrency(
                                participant.startingPortfolioValue
                              )}
                            </td>
                            <td>
                              {formatCurrency(
                                participant.currentPortfolioValue
                              )}
                            </td>
                            <td>{formatCurrency(participant.profit)}</td>
                            <td>{formatPercent(participant.roi)}</td>
                            <td>{formatDate(participant.joinedAt)}</td>
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
