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

export default function AdminCompetitionsPage() {
  const navigate = useNavigate();

  const [currentUser, setCurrentUser] = useState(null);
  const [competitions, setCompetitions] = useState([]);
  const [selectedCompetitionId, setSelectedCompetitionId] = useState("");
  const [selectedCompetition, setSelectedCompetition] = useState(null);
  const [participants, setParticipants] = useState([]);

  const [status, setStatus] = useState({
    loading: true,
    error: "",
    message: "",
  });

  const activeCompetitions = useMemo(() => {
    return competitions.filter(
      (competition) => String(competition.status || "").toUpperCase() === "ACTIVE"
    );
  }, [competitions]);

  async function loadOverview(nextSelectedId) {
    const [meResponse, overviewResponse] = await Promise.all([
      api.get("/auth/me"),
      api.get("/competitions/admin/all"),
    ]);

    const me = meResponse.data.user;

    if (me.role !== "ADMIN") {
      navigate("/dashboard");
      return;
    }

    const nextCompetitions = overviewResponse.data.competitions || [];
    const resolvedSelectedId =
      nextSelectedId || selectedCompetitionId || nextCompetitions[0]?.id || "";

    setCurrentUser(me);
    setCompetitions(nextCompetitions);
    setSelectedCompetitionId(resolvedSelectedId);

    if (resolvedSelectedId) {
      await loadParticipants(resolvedSelectedId);
    }
  }

  async function loadParticipants(competitionId) {
    if (!competitionId) {
      setSelectedCompetition(null);
      setParticipants([]);
      return;
    }

    const response = await api.get(
      `/competitions/admin/${competitionId}/participants`
    );

    setSelectedCompetition(response.data.competition);
    setParticipants(response.data.participants || []);
  }

  useEffect(() => {
    async function init() {
      try {
        await loadOverview();

        setStatus({
          loading: false,
          error: "",
          message: "",
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
            "Failed to load admin competitions.",
          message: "",
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
        setSelectedCompetition(null);
        setParticipants([]);
      }
    }

    if (selectedCompetitionId) {
      updateParticipants();
    }
  }, [selectedCompetitionId]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadOverview(selectedCompetitionId).catch(() => {});
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompetitionId]);

  if (status.loading) {
    return (
      <main className="dashboard-shell with-bottom-nav">
        <p>Loading admin competitions...</p>
      </main>
    );
  }

  return (
    <main className="dashboard-shell with-bottom-nav">
      <nav className="dashboard-nav">
        <div>
          <span className="brand-badge">TradeLab Admin</span>
          <h1>Competitions</h1>
          <p className="dashboard-subtitle">
            Review competitions, creators, participants, and leaderboard status.
            Status refreshes every second based on start and end time.
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
          <span>Total Competitions</span>
          <strong>{competitions.length}</strong>
        </article>

        <article className="stat-card">
          <span>Active Competitions</span>
          <strong>{activeCompetitions.length}</strong>
        </article>

        <article className="stat-card">
          <span>Total Participants</span>
          <strong>
            {competitions.reduce(
              (sum, competition) => sum + Number(competition.participantCount || 0),
              0
            )}
          </strong>
        </article>

        <article className="stat-card">
          <span>Selected Participants</span>
          <strong>{participants.length}</strong>
        </article>
      </section>

      <section className="dashboard-grid admin-grid">
        <article className="dashboard-card wide">
          <p className="eyebrow">Competition overview</p>
          <h3>All competitions</h3>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Competition</th>
                  <th>Creator</th>
                  <th>Status</th>
                  <th>Metric</th>
                  <th>Participants</th>
                  <th>Dates</th>
                  <th>Detail</th>
                </tr>
              </thead>

              <tbody>
                {competitions.length === 0 ? (
                  <tr>
                    <td colSpan="7">No competitions found.</td>
                  </tr>
                ) : (
                  competitions.map((competition) => (
                    <tr key={competition.id}>
                      <td>
                        <strong>{competition.title}</strong>
                        <span>{competition.description}</span>
                      </td>
                      <td>
                        <strong>
                          {competition.createdBy?.displayName ||
                            competition.createdBy?.name ||
                            "-"}
                        </strong>
                        <span>{competition.createdBy?.email || ""}</span>
                      </td>
                      <td>{competition.status}</td>
                      <td>{competition.rankingMetric}</td>
                      <td>{competition.participantCount || 0}</td>
                      <td>
                        {formatDateTime(competition.startDate)} →{" "}
                        {formatDateTime(competition.endDate)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => setSelectedCompetitionId(competition.id)}
                        >
                          View
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
          <h3>{selectedCompetition?.title || "Competition participants"}</h3>

          {!selectedCompetition ? (
            <p className="muted-text">
              Select a competition to inspect participants.
            </p>
          ) : (
            <div className="admin-detail-grid">
              <section className="admin-detail-panel">
                <h3>Competition summary</h3>

                <div className="compact-list">
                  <div className="compact-row">
                    <div>
                      <strong>Status</strong>
                      <span>Current competition state</span>
                    </div>
                    <em>{selectedCompetition.status}</em>
                  </div>

                  <div className="compact-row">
                    <div>
                      <strong>Ranking metric</strong>
                      <span>Leaderboard basis</span>
                    </div>
                    <em>{selectedCompetition.rankingMetric}</em>
                  </div>

                  <div className="compact-row">
                    <div>
                      <strong>Creator</strong>
                      <span>{selectedCompetition.createdBy?.email || "-"}</span>
                    </div>
                    <em>
                      {selectedCompetition.createdBy?.displayName ||
                        selectedCompetition.createdBy?.name ||
                        "-"}
                    </em>
                  </div>

                  <div className="compact-row">
                    <div>
                      <strong>Period</strong>
                      <span>
                        {formatDateTime(selectedCompetition.startDate)} →{" "}
                        {formatDateTime(selectedCompetition.endDate)}
                      </span>
                    </div>
                    <em>{participants.length} users</em>
                  </div>
                </div>
              </section>

              <section className="admin-detail-panel admin-detail-panel-wide">
                <h3>Participants</h3>

                {participants.length === 0 ? (
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
                          <th>Joined</th>
                        </tr>
                      </thead>

                      <tbody>
                        {participants.map((participant) => (
                          <tr key={participant.id}>
                            <td>{formatParticipantRank(participant)}</td>
                            <td>
                              <strong>
                                {participant.user?.displayName ||
                                  participant.user?.name ||
                                  "User"}
                              </strong>
                              <span>{participant.user?.email}</span>
                            </td>
                            <td>
                              {formatCurrency(participant.startingPortfolioValue)}
                            </td>
                            <td>
                              {formatCurrency(participant.currentPortfolioValue)}
                            </td>
                            <td>{formatParticipantProfit(participant)}</td>
                            <td
                              className={
                                Number(participant.roi || 0) >= 0
                                  ? "positive"
                                  : "negative"
                              }
                            >
                              {formatParticipantPercent(participant)}
                            </td>
                            <td>{formatDate(participant.joinedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>
          )}
        </article>
      </section>

      <BottomNav user={currentUser} />
    </main>
  );
}
