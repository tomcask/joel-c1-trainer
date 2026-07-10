import * as React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import "./styles.css";

type Question = {
  id: string;
  exam?: string;
  paper?: string;
  part: number;
  skill?: string;
  difficulty?: string;
  tags: string[];
  question: {
    first_sentence: string;
    keyword: string;
    second_sentence: string;
    word_limit_min: number;
    word_limit_max: number;
  };
  answers: string[];
  alternative_answers?: string[];
  explanation: string;
  common_errors?: Array<{ answer: string; reason: string }>;
};

type ResponseState = {
  questionId: string;
  answer: string;
  marked: boolean;
  timeMs: number;
  lastEnteredAt: number;
};

type Result = {
  question: Question;
  answer: string;
  acceptedAnswers: string[];
  normalizedAnswer: string;
  wordCount: number;
  wordLimitOk: boolean;
  keywordOk: boolean;
  answerMatch: boolean;
  status: "correct" | "incorrect" | "blank";
  marked: boolean;
  timeMs: number;
};

type Session = {
  id: string;
  label: string;
  testId: string;
  status: "completed";
  startedAt: string;
  finishedAt: string;
  results: Result[];
  summary: Summary;
  resultJson: SessionResultJson;
};

type Summary = {
  total: number;
  correct: number;
  incorrect: number;
  blank: number;
  accuracy: number;
  totalTimeMs: number;
  averageTimeMs: number;
  byTag: Record<string, { total: number; correct: number; incorrect: number; blank: number }>;
};

type StoreState = {
  questions: Question[];
  sessions: Session[];
  importedAt: string | null;
  lastImport: ImportPreview | null;
};

type ActiveSession = {
  id: string;
  testId: string;
  label: string;
  startedAt: number;
  lastSavedAt: number;
  status: "in_progress";
  questions: Question[];
  responses: Record<string, ResponseState>;
};

type SavedActiveSession = ActiveSession & {
  currentIndex: number;
  totalTimeMs: number;
  savedAt: number;
};

type ImportPreview = {
  testId: string;
  name: string;
  total: number;
  parts: number[];
  tags: string[];
  difficulties: string[];
  importedAt: string;
  validationErrors: string[];
};

type SessionResultJson = {
  session_id: string;
  test_id: string;
  label: string;
  status: "completed";
  started_at: string;
  finished_at: string;
  total_questions: number;
  correct: number;
  incorrect: number;
  blank: number;
  accuracy: number;
  total_time_ms: number;
  average_time_ms: number;
  by_tag: Summary["byTag"];
  responses: Array<{
    question_id: string;
    first_sentence: string;
    keyword: string;
    second_sentence: string;
    joel_answer: string;
    accepted_answers: string[];
    status: Result["status"];
    word_count: number;
    word_limit_ok: boolean;
    keyword_ok: boolean;
    answer_match: boolean;
    time_ms: number;
    marked_for_review: boolean;
    tags: string[];
    explanation: string;
    common_errors: Array<{ answer: string; reason: string }>;
  }>;
};

const STORAGE_KEY = "joel-c1-trainer-state-v1";
const ACTIVE_SESSION_KEY = "joel-c1-trainer-active-session-v1";
const ABANDONED_SESSIONS_KEY = "joel-c1-trainer-abandoned-sessions-v1";
const REQUIRED_FIELDS = [
  "id",
  "part",
  "tags",
  "question.first_sentence",
  "question.keyword",
  "question.second_sentence",
  "question.word_limit_min",
  "question.word_limit_max",
  "answers",
  "explanation",
];

function loadState(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { questions: [], sessions: [], importedAt: null, lastImport: null };
    const parsed = JSON.parse(raw) as Partial<StoreState>;
    return {
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions.map(normalizeStoredSession) : [],
      importedAt: parsed.importedAt ?? null,
      lastImport: parsed.lastImport ?? null,
    };
  } catch {
    return { questions: [], sessions: [], importedAt: null, lastImport: null };
  }
}

function normalizeStoredSession(session: Session): Session {
  const normalized: Session = {
    ...session,
    testId: session.testId ?? makeTestId(session.label ?? "session", session.results?.map((result) => result.question) ?? []),
    status: "completed",
    resultJson: session.resultJson ?? ({} as SessionResultJson),
  };
  normalized.resultJson = Object.keys(normalized.resultJson).length ? normalized.resultJson : makeSessionResultJson(normalized);
  return normalized;
}

function loadSavedActiveSession(): SavedActiveSession | null {
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavedActiveSession;
    if (parsed.status !== "in_progress" || !Array.isArray(parsed.questions)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function App() {
  const [store, setStore] = React.useState<StoreState>(loadState);
  const [view, setView] = React.useState<"home" | "import" | "sessions" | "review" | "charts">(
    store.questions.length ? "home" : "import",
  );
  const [message, setMessage] = React.useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [activeSession, setActiveSession] = React.useState<ActiveSession | null>(null);
  const [savedActiveSession, setSavedActiveSession] = React.useState<SavedActiveSession | null>(loadSavedActiveSession);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [now, setNow] = React.useState(Date.now());
  const [reviewFilters, setReviewFilters] = React.useState({ status: "all", tag: "all", repeated: false });
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);
  const [justCompletedSessionId, setJustCompletedSessionId] = React.useState<string | null>(null);

  React.useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  }, [store]);

  React.useEffect(() => {
    if (!activeSession) return undefined;
    const timer = window.setInterval(() => {
      setNow(Date.now());
      setActiveSession((current) => {
        if (!current) return current;
        const question = current.questions[currentIndex];
        const response = current.responses[question.id];
        const tickNow = Date.now();
        return {
          ...current,
          lastSavedAt: tickNow,
          responses: {
            ...current.responses,
            [question.id]: {
              ...response,
              timeMs: response.timeMs + tickNow - response.lastEnteredAt,
              lastEnteredAt: tickNow,
            },
          },
        };
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [activeSession, currentIndex]);

  React.useEffect(() => {
    if (!activeSession) return;
    saveActiveSession(activeSession, currentIndex);
    setSavedActiveSession(null);
  }, [activeSession, currentIndex]);

  React.useEffect(() => {
    if (!activeSession) return undefined;
    const saveTimer = window.setInterval(() => saveActiveSession(activeSession, currentIndex), 5000);
    return () => window.clearInterval(saveTimer);
  }, [activeSession, currentIndex]);

  React.useEffect(() => {
    if (!activeSession) return undefined;
    const handleBeforeUnload = () => saveActiveSession(activeSession, currentIndex);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [activeSession, currentIndex]);

  const latestSession = selectedSessionId
    ? (store.sessions.find((session) => session.id === selectedSessionId) ?? store.sessions.at(-1) ?? null)
    : (store.sessions.at(-1) ?? null);
  const tags = [...new Set(store.questions.flatMap((question) => question.tags))].sort((a, b) => a.localeCompare(b));

  function importQuestions(data: unknown) {
    const validation = validateQuestionFile(data);
    if (!validation.ok) {
      setMessage({ type: "error", text: validation.errors.join(" ") });
      return;
    }
    const importedAt = new Date().toISOString();
    const preview = makeImportPreview(validation.questions, "Preguntas importadas", importedAt, validation.errors);
    setStore((current) => {
      const existing = new Map(current.questions.map((question) => [question.id, question]));
      validation.questions.forEach((question) => existing.set(question.id, question));
      return { ...current, questions: [...existing.values()], importedAt, lastImport: preview };
    });
    setMessage({ type: "ok", text: `Importadas ${validation.questions.length} preguntas.` });
    setView("import");
  }

  async function importFile(file: File | undefined) {
    if (!file) {
      setMessage({ type: "error", text: "Selecciona un fichero JSON antes de importar." });
      return;
    }
    try {
      const data = JSON.parse(await file.text());
      const validation = validateQuestionFile(data);
      if (!validation.ok) {
        setMessage({ type: "error", text: validation.errors.join(" ") });
        setStore((current) => ({
          ...current,
          lastImport: makeImportPreview([], file.name, new Date().toISOString(), validation.errors),
        }));
        return;
      }
      const importedAt = new Date().toISOString();
      const preview = makeImportPreview(validation.questions, file.name, importedAt, []);
      setStore((current) => {
        const existing = new Map(current.questions.map((question) => [question.id, question]));
        validation.questions.forEach((question) => existing.set(question.id, question));
        return { ...current, questions: [...existing.values()], importedAt, lastImport: preview };
      });
      setMessage({ type: "ok", text: `Importadas ${validation.questions.length} preguntas desde ${file.name}.` });
      setView("import");
    } catch (error) {
      setMessage({ type: "error", text: `JSON no válido: ${(error as Error).message}` });
    }
  }

  async function loadSample() {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}sample-questions.json`);
      importQuestions(await response.json());
    } catch (error) {
      setMessage({ type: "error", text: `No se pudo cargar el ejemplo: ${(error as Error).message}` });
    }
  }

  function startSession(questions: Question[], label: string) {
    if (!questions.length) return;
    if (activeSession) {
      const confirmed = window.confirm("Ya hay un examen en curso. ¿Quieres descartarlo y empezar uno nuevo?");
      if (!confirmed) return;
      discardActiveSession();
    }
    if (savedActiveSession) {
      const confirmed = window.confirm("Tienes un examen en curso guardado. ¿Quieres descartarlo y empezar uno nuevo?");
      if (!confirmed) return;
      discardActiveSession();
    }
    const responses = Object.fromEntries(questions.map((q) => [q.id, makeResponse(q.id)]));
    const startedAt = Date.now();
    const session: ActiveSession = {
      id: crypto.randomUUID(),
      testId: makeTestId(label, questions),
      label,
      startedAt,
      lastSavedAt: startedAt,
      status: "in_progress",
      questions,
      responses,
    };
    saveActiveSession(session, 0);
    setActiveSession({
      ...session,
    });
    setSavedActiveSession(null);
    setCurrentIndex(0);
    setNow(startedAt);
  }

  function patchCurrentResponse(patch: Partial<ResponseState>) {
    setActiveSession((current) => {
      if (!current) return current;
      const question = current.questions[currentIndex];
      const response = current.responses[question.id];
      const timeNow = Date.now();
      return {
        ...current,
        lastSavedAt: timeNow,
        responses: {
          ...current.responses,
          [question.id]: {
            ...response,
            timeMs: response.timeMs + timeNow - response.lastEnteredAt,
            lastEnteredAt: timeNow,
            ...patch,
          },
        },
      };
    });
  }

  function moveQuestion(direction: number) {
    if (!activeSession) return;
    const timeNow = Date.now();
    const nextIndex = Math.max(0, Math.min(activeSession.questions.length - 1, currentIndex + direction));
    const currentQuestion = activeSession.questions[currentIndex];
    const nextQuestion = activeSession.questions[nextIndex];
    setActiveSession((current) => {
      if (!current) return current;
      const currentResponse = current.responses[currentQuestion.id];
      return {
        ...current,
        lastSavedAt: timeNow,
        responses: {
          ...current.responses,
          [currentQuestion.id]: {
            ...currentResponse,
            timeMs: currentResponse.timeMs + timeNow - currentResponse.lastEnteredAt,
            lastEnteredAt: timeNow,
          },
          [nextQuestion.id]: {
            ...current.responses[nextQuestion.id],
            lastEnteredAt: timeNow,
          },
        },
      };
    });
    setCurrentIndex(nextIndex);
  }

  function finishExam() {
    if (!activeSession) return;
    const finishedAtMs = Date.now();
    const currentQuestion = activeSession.questions[currentIndex];
    const currentResponse = activeSession.responses[currentQuestion.id];
    const responses = {
      ...activeSession.responses,
      [currentQuestion.id]: {
        ...currentResponse,
        timeMs: currentResponse.timeMs + finishedAtMs - currentResponse.lastEnteredAt,
        lastEnteredAt: finishedAtMs,
      },
    };
    const results = activeSession.questions.map((question) =>
      gradeAnswer(question, responses[question.id]?.answer ?? "", responses[question.id]),
    );
    const session: Session = {
      id: activeSession.id,
      testId: activeSession.testId,
      label: activeSession.label,
      status: "completed",
      startedAt: new Date(activeSession.startedAt).toISOString(),
      finishedAt: new Date(finishedAtMs).toISOString(),
      results,
      summary: summarizeResults(results, activeSession.startedAt, finishedAtMs),
      resultJson: {} as SessionResultJson,
    };
    session.resultJson = makeSessionResultJson(session);
    setStore((current) => ({ ...current, sessions: [...current.sessions, session] }));
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    setSavedActiveSession(null);
    setActiveSession(null);
    setSelectedSessionId(session.id);
    setJustCompletedSessionId(session.id);
    setView("sessions");
  }

  function continueSavedSession() {
    if (!savedActiveSession) return;
    setActiveSession({
      id: savedActiveSession.id,
      testId: savedActiveSession.testId,
      label: savedActiveSession.label,
      startedAt: savedActiveSession.startedAt,
      lastSavedAt: Date.now(),
      status: "in_progress",
      questions: savedActiveSession.questions,
      responses: resetResponseTimers(savedActiveSession.responses),
    });
    setCurrentIndex(Math.min(savedActiveSession.currentIndex, savedActiveSession.questions.length - 1));
    setSavedActiveSession(null);
    setNow(Date.now());
  }

  function discardActiveSession() {
    if (activeSession || savedActiveSession) {
      saveAbandonedSession(activeSession, savedActiveSession, currentIndex);
      localStorage.removeItem(ACTIVE_SESSION_KEY);
      setActiveSession(null);
      setSavedActiveSession(null);
      setCurrentIndex(0);
    }
  }

  function discardSavedSessionWithConfirmation() {
    if (!window.confirm("¿Seguro que quieres descartar el examen en curso? Se perderán sus respuestas.")) return;
    discardActiveSession();
  }

  function deleteSession(sessionId: string) {
    if (!window.confirm("¿Seguro que quieres borrar esta sesión? Esta acción no se puede deshacer.")) return;
    setStore((current) => ({ ...current, sessions: current.sessions.filter((session) => session.id !== sessionId) }));
    if (selectedSessionId === sessionId) setSelectedSessionId(null);
    if (justCompletedSessionId === sessionId) setJustCompletedSessionId(null);
  }

  function startRepeat(mode: string, tag: string) {
    const questions =
      mode === "last"
        ? getLastFailedQuestions(store)
        : mode === "historical"
          ? getHistoricallyFailedQuestions(store, 1)
          : mode === "twice"
            ? getHistoricallyFailedQuestions(store, 2)
            : store.questions.filter((question) => question.tags.includes(tag));
    const label =
      mode === "last"
        ? "Falladas última sesión"
        : mode === "historical"
          ? "Falladas históricas"
          : mode === "twice"
            ? "Falladas más de una vez"
            : `Tag: ${tag}`;
    startSession(questions, label);
  }

  if (activeSession) {
    const question = activeSession.questions[currentIndex];
    const response = activeSession.responses[question.id];
    const parts = splitSecondSentence(question.question.second_sentence);
    return (
      <Shell store={store}>
        <section className="panel">
          <div className="exam-header">
            <div className="exam-meta">
              <strong>
                Pregunta {currentIndex + 1} de {activeSession.questions.length}
              </strong>
              <span className="timer">{formatDuration(now - activeSession.startedAt)}</span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${((currentIndex + 1) / activeSession.questions.length) * 100}%` }}
              />
            </div>
          </div>
          <p className="instruction">
            Complete the second sentence so that it has a similar meaning to the first sentence, using the word given.
            Do not change the word given. You must use between {question.question.word_limit_min} and{" "}
            {question.question.word_limit_max} words.
          </p>
          <article className="question-card">
            <div>
              <div className="meta">First sentence</div>
              <div className="first-sentence">{question.question.first_sentence}</div>
            </div>
            <div className="keyword">{question.question.keyword}</div>
            <div>
              <div className="meta">Second sentence</div>
              <label className="sentence-line">
                <span>{parts.before}</span>
                <input
                  className="inline-answer"
                  value={response.answer}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus
                  onChange={(event) => patchCurrentResponse({ answer: event.target.value })}
                />
                <span>{parts.after}</span>
              </label>
            </div>
            <div className="question-tools">
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={response.marked}
                  onChange={(event) => patchCurrentResponse({ marked: event.target.checked })}
                />
                Marcar para revisar
              </label>
              <span className="small">Tiempo en pregunta: {formatDuration(response.timeMs)}</span>
            </div>
            <div className="actions">
              <button className="secondary" disabled={currentIndex === 0} onClick={() => moveQuestion(-1)}>
                Anterior
              </button>
              <button
                className="secondary"
                disabled={currentIndex === activeSession.questions.length - 1}
                onClick={() => moveQuestion(1)}
              >
                Siguiente
              </button>
              <button onClick={finishExam}>Finalizar examen</button>
            </div>
          </article>
        </section>
      </Shell>
    );
  }

  return (
    <Shell store={store} onExportJson={() => exportJson(store)} onExportCsv={() => exportCsv(store)}>
      {savedActiveSession && (
        <section className="panel alert-panel">
          <div>
            <h2>Tienes un examen en curso</h2>
            <p className="small">
              {savedActiveSession.label} · Pregunta {savedActiveSession.currentIndex + 1} de{" "}
              {savedActiveSession.questions.length} · Último guardado: {formatDate(new Date(savedActiveSession.savedAt).toISOString())}
            </p>
          </div>
          <div className="actions">
            <button onClick={continueSavedSession}>Continuar examen</button>
            <button className="danger" onClick={discardSavedSessionWithConfirmation}>
              Descartar examen
            </button>
          </div>
        </section>
      )}
      <nav className="tabs" aria-label="Secciones">
        {(["home", "import", "sessions", "review", "charts"] as const).map((item) => (
          <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>
            {tabLabel(item)}
          </button>
        ))}
      </nav>
      {view === "home" && (
        <>
          <section className="panel">
            <h1>Práctica Cambridge C1 Advanced para Joel</h1>
            <p className="lead">
              Entrenamiento específico de Key Word Transformations con fichero de preguntas, modo examen, corrección
              flexible y resultados exportables.
            </p>
            <div className="grid">
              <Metric value={store.questions.length} label="preguntas importadas" />
              <Metric value={store.sessions.length} label="sesiones guardadas" />
              <Metric value={latestSession ? `${latestSession.summary.accuracy}%` : "-"} label="último acierto" />
              <Metric value={latestSession ? formatDuration(latestSession.summary.totalTimeMs) : "-"} label="último tiempo" />
            </div>
            <div className="actions top-space">
              <button disabled={!store.questions.length} onClick={() => startSession(store.questions, "Todas las preguntas")}>
                Empezar examen
              </button>
              <button
                className="secondary"
                disabled={!getLastFailedQuestions(store).length}
                onClick={() => startSession(getLastFailedQuestions(store), "Falladas última sesión")}
              >
                Repetir falladas última sesión
              </button>
              <button
                className="secondary"
                disabled={!getHistoricallyFailedQuestions(store, 1).length}
                onClick={() => startSession(getHistoricallyFailedQuestions(store, 1), "Falladas históricas")}
              >
                Repetir falladas históricas
              </button>
            </div>
          </section>
          <section className="layout two top-space">
            <div className="panel">
              <h2>Flujo de examen</h2>
              <p className="instruction">
                Complete the second sentence so that it has a similar meaning to the first sentence, using the word
                given. Do not change the word given. You must use between three and six words.
              </p>
              <p>
                Durante la sesión no se muestran respuestas ni explicaciones. Al finalizar se guarda el resultado, el
                tiempo total y el tiempo por pregunta.
              </p>
            </div>
            <RepeatPanel tags={tags} onStart={startRepeat} />
          </section>
        </>
      )}
      {view === "import" && <ImportView store={store} message={message} onImport={importFile} onLoadSample={loadSample} />}
      {view === "sessions" && (
        <SessionsView
          sessions={store.sessions}
          selectedSessionId={selectedSessionId ?? justCompletedSessionId}
          justCompletedSessionId={justCompletedSessionId}
          onSelect={setSelectedSessionId}
          onDelete={deleteSession}
          onRepeatFailed={(session) => startSession(getFailedQuestionsFromSession(store, session), `Falladas: ${session.label}`)}
        />
      )}
      {view === "review" && (
        <ReviewView
          store={store}
          filters={reviewFilters}
          tags={tags}
          onFilters={setReviewFilters}
          latestSession={latestSession}
        />
      )}
      {view === "charts" && <ChartsView sessions={store.sessions} latestSession={latestSession} />}
    </Shell>
  );
}

function Shell({
  store,
  children,
  onExportJson,
  onExportCsv,
}: React.PropsWithChildren<{ store: StoreState; onExportJson?: () => void; onExportCsv?: () => void }>) {
  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <strong>Joel C1 Trainer</strong>
          <span>Use of English · Part 4</span>
        </div>
        <div className="actions">
          <button className="secondary" disabled={!store.sessions.length || !onExportJson} onClick={onExportJson}>
            Export JSON
          </button>
          <button className="secondary" disabled={!store.sessions.length || !onExportCsv} onClick={onExportCsv}>
            Export CSV
          </button>
        </div>
      </header>
      {children}
    </main>
  );
}

function ImportView({
  store,
  message,
  onImport,
  onLoadSample,
}: {
  store: StoreState;
  message: { type: "ok" | "error"; text: string } | null;
  onImport: (file: File | undefined) => void;
  onLoadSample: () => void;
}) {
  const [file, setFile] = React.useState<File | undefined>();
  return (
    <>
      <section className="layout two">
        <div className="panel">
          <h2>Carga de fichero JSON</h2>
          <div className="import-box">
            <input type="file" accept="application/json,.json" onChange={(event) => setFile(event.target.files?.[0])} />
            <div className="actions">
              <button onClick={() => onImport(file)}>Importar preguntas</button>
              <button className="secondary" onClick={onLoadSample}>
                Cargar ejemplo
              </button>
            </div>
            {message && <div className={`message ${message.type}`}>{message.text}</div>}
          </div>
          <p className="small">
            El fichero puede ser un array de preguntas o un objeto con una propiedad <code>questions</code>.
          </p>
        </div>
        <div className="panel">
          <h2>Campos obligatorios</h2>
          <div className="review-list">
            {REQUIRED_FIELDS.map((field) => (
              <span className="pill" key={field}>
                {field}
              </span>
            ))}
          </div>
        </div>
      </section>
      <section className="panel top-space">
        <h2>Vista previa segura</h2>
        {store.lastImport ? <SafeImportPreview preview={store.lastImport} /> : <Empty text="Todavía no hay preguntas importadas." />}
      </section>
    </>
  );
}

function SafeImportPreview({ preview }: { preview: ImportPreview }) {
  return (
    <div className="safe-preview">
      <div className="grid">
        <Metric value={preview.name} label="test o fichero" />
        <Metric value={preview.total} label="preguntas" />
        <Metric value={preview.parts.length ? preview.parts.join(", ") : "-"} label="part" />
        <Metric value={preview.difficulties.length ? preview.difficulties.join(", ") : "-"} label="dificultad" />
      </div>
      <div className="top-space">
        <strong>Tags detectadas</strong>
        <div className="actions top-space">
          {preview.tags.length ? preview.tags.map((tag) => <span className="pill" key={tag}>{tag}</span>) : <span className="small">Sin tags</span>}
        </div>
      </div>
      {!!preview.validationErrors.length && (
        <div className="message error top-space">
          {preview.validationErrors.map((error) => (
            <div key={error}>{error}</div>
          ))}
        </div>
      )}
      <p className="small top-space">
        Esta vista no muestra respuestas, alternativas, explicaciones ni common errors. Esos datos solo aparecen al finalizar una sesión.
      </p>
    </div>
  );
}

function SessionsView({
  sessions,
  selectedSessionId,
  justCompletedSessionId,
  onSelect,
  onDelete,
  onRepeatFailed,
}: {
  sessions: Session[];
  selectedSessionId: string | null;
  justCompletedSessionId: string | null;
  onSelect: (sessionId: string | null) => void;
  onDelete: (sessionId: string) => void;
  onRepeatFailed: (session: Session) => void;
}) {
  if (!sessions.length) {
    return (
      <section className="panel">
        <h2>Historial de sesiones</h2>
        <Empty text="No hay sesiones finalizadas." />
      </section>
    );
  }
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? sessions.at(-1) ?? null;
  return (
    <>
      {justCompletedSessionId && (
        <section className="panel message ok">
          <h2>Resultados guardados</h2>
          <p>El JSON completo de la sesión se ha generado y guardado en el navegador.</p>
          <div className="actions">
            <button onClick={() => selectedSession && downloadSessionJson(selectedSession)}>Descargar JSON de resultados</button>
            <button className="secondary" onClick={() => selectedSession && downloadSessionCsv(selectedSession)}>
              Descargar CSV
            </button>
          </div>
        </section>
      )}
      <section className="panel top-space">
        <h2>Historial de sesiones</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Estado</th>
                <th>Preguntas</th>
                <th>Acierto</th>
                <th>Tiempo medio</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sessions
                .slice()
                .reverse()
                .map((session) => (
                  <tr key={session.id}>
                    <td>{formatDate(session.finishedAt)}</td>
                    <td><span className="pill good">{session.status}</span></td>
                    <td>
                      {session.summary.total} · {session.summary.correct} correctas · {session.summary.incorrect} incorrectas ·{" "}
                      {session.summary.blank} en blanco
                    </td>
                    <td>{session.summary.accuracy}%</td>
                    <td>{formatDuration(session.summary.averageTimeMs)}</td>
                    <td>
                      <div className="actions">
                        <button className="secondary" onClick={() => onSelect(session.id)}>Ver resultados</button>
                        <button className="secondary" onClick={() => onRepeatFailed(session)} disabled={!getFailedResults(session).length}>
                          Repetir falladas
                        </button>
                        <button className="secondary" onClick={() => downloadSessionJson(session)}>JSON</button>
                        <button className="secondary" onClick={() => downloadSessionCsv(session)}>CSV</button>
                        <button className="danger" onClick={() => onDelete(session.id)}>Borrar</button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
      {selectedSession && <SessionDetail session={selectedSession} />}
    </>
  );
}

function SessionDetail({ session }: { session: Session }) {
  const failed = getFailedResults(session);
  return (
    <section className="panel top-space">
      <h2>Resultados de sesión</h2>
      <div className="grid">
        <Metric value={session.summary.total} label="preguntas" />
        <Metric value={session.summary.correct} label="correctas" />
        <Metric value={session.summary.incorrect} label="incorrectas" />
        <Metric value={session.summary.blank} label="en blanco" />
        <Metric value={`${session.summary.accuracy}%`} label="accuracy" />
        <Metric value={formatDuration(session.summary.totalTimeMs)} label="tiempo total" />
      </div>
      <h3 className="top-space">Resumen por tags</h3>
      <div className="actions">
        {Object.entries(session.summary.byTag).map(([tag, item]) => (
          <span className="pill" key={tag}>
            {tag}: {item.correct}/{item.total}
          </span>
        ))}
      </div>
      <h3 className="top-space">Errores y respuestas</h3>
      <div className="review-list">
        {(failed.length ? failed : session.results).map((result) => <ReviewItem key={result.question.id} result={result} />)}
      </div>
    </section>
  );
}

function ReviewView({
  store,
  filters,
  tags,
  onFilters,
  latestSession,
}: {
  store: StoreState;
  filters: { status: string; tag: string; repeated: boolean };
  tags: string[];
  latestSession: Session | null;
  onFilters: React.Dispatch<React.SetStateAction<{ status: string; tag: string; repeated: boolean }>>;
}) {
  if (!latestSession) {
    return (
      <section className="panel">
        <h2>Revisión de errores</h2>
        <Empty text="Finaliza una sesión para revisar respuestas." />
      </section>
    );
  }
  const items = latestSession.results.filter((result) => {
    if (filters.status !== "all" && result.status !== filters.status) return false;
    if (filters.tag !== "all" && !result.question.tags.includes(filters.tag)) return false;
    if (filters.repeated && getFailureCount(store, result.question.id) < 2) return false;
    return true;
  });
  return (
    <>
      <section className="panel">
        <h2>Revisión de errores</h2>
        <div className="filter-row">
          <select value={filters.status} onChange={(event) => onFilters((f) => ({ ...f, status: event.target.value }))}>
            <option value="all">Todas</option>
            <option value="correct">Correctas</option>
            <option value="incorrect">Incorrectas</option>
            <option value="blank">En blanco</option>
          </select>
          <select value={filters.tag} onChange={(event) => onFilters((f) => ({ ...f, tag: event.target.value }))}>
            <option value="all">Todos los tags</option>
            {tags.map((tag) => (
              <option value={tag} key={tag}>
                {tag}
              </option>
            ))}
          </select>
          <label className="check-row">
            <input
              type="checkbox"
              checked={filters.repeated}
              onChange={(event) => onFilters((f) => ({ ...f, repeated: event.target.checked }))}
            />{" "}
            Falladas más de una vez
          </label>
        </div>
      </section>
      <section className="review-list top-space">{items.length ? items.map((r) => <ReviewItem key={r.question.id} result={r} />) : <Empty text="No hay preguntas con esos filtros." />}</section>
    </>
  );
}

function ReviewItem({ result }: { result: Result }) {
  const statusClass = result.status === "correct" ? "good" : result.status === "blank" ? "blank" : "bad";
  return (
    <article className="review-item">
      <h3>
        {result.question.id} <span className={`pill ${statusClass}`}>{labelStatus(result.status)}</span>
      </h3>
      <p><strong>First sentence:</strong> {result.question.question.first_sentence}</p>
      <p><strong>Keyword:</strong> {result.question.question.keyword}</p>
      <p><strong>Second sentence:</strong> {result.question.question.second_sentence}</p>
      <p><strong>Respuesta de Joel:</strong> {result.answer || "—"}</p>
      <p><strong>Respuesta correcta:</strong> {result.acceptedAnswers.join(" · ")}</p>
      <p><strong>Límite de palabras:</strong> {result.wordLimitOk ? "Sí" : "No"} · <strong>Keyword usada:</strong> {result.keywordOk ? "Sí" : "No"}</p>
      <p><strong>Explicación:</strong> {result.question.explanation}</p>
      {!!result.question.common_errors?.length && (
        <p><strong>Common errors:</strong> {result.question.common_errors.map((item) => `${item.answer}: ${item.reason}`).join(" · ")}</p>
      )}
      <div className="actions">{result.question.tags.map((tag) => <span className="pill" key={tag}>{tag}</span>)}</div>
    </article>
  );
}

function ChartsView({ sessions, latestSession }: { sessions: Session[]; latestSession: Session | null }) {
  const tagData = Object.entries(latestSession?.summary.byTag ?? {}).map(([tag, item]) => ({
    tag,
    accuracy: item.total ? Math.round((item.correct / item.total) * 100) : 0,
  }));
  const trendData = sessions.map((session, index) => ({
    name: `S${index + 1}`,
    accuracy: session.summary.accuracy,
    seconds: Math.round(session.summary.averageTimeMs / 1000),
  }));
  return (
    <section className="split">
      <ChartPanel title="Precisión por tag" empty={!tagData.length}>
        <BarChart data={tagData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="tag" />
          <YAxis domain={[0, 100]} />
          <Tooltip />
          <Bar dataKey="accuracy" fill="#0f766e" />
        </BarChart>
      </ChartPanel>
      <ChartPanel title="Evolución del acierto" empty={!trendData.length}>
        <LineChart data={trendData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis domain={[0, 100]} />
          <Tooltip />
          <Line type="monotone" dataKey="accuracy" stroke="#0f766e" strokeWidth={3} />
        </LineChart>
      </ChartPanel>
      <ChartPanel title="Tiempo medio por pregunta" empty={!trendData.length}>
        <LineChart data={trendData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Line type="monotone" dataKey="seconds" stroke="#8a4b0f" strokeWidth={3} />
        </LineChart>
      </ChartPanel>
    </section>
  );
}

function ChartPanel({ title, empty, children }: React.PropsWithChildren<{ title: string; empty: boolean }>) {
  return (
    <div className="panel">
      <h2>{title}</h2>
      {empty ? (
        <Empty text="No hay datos." />
      ) : (
        <div className="chart">
          <ResponsiveContainer width="100%" height={250}>{children as React.ReactElement}</ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function RepeatPanel({ tags, onStart }: { tags: string[]; onStart: (mode: string, tag: string) => void }) {
  const [mode, setMode] = React.useState("last");
  const [tag, setTag] = React.useState(tags[0] ?? "");
  React.useEffect(() => {
    if (!tag && tags[0]) setTag(tags[0]);
  }, [tag, tags]);
  return (
    <div className="panel">
      <h2>Crear repetición</h2>
      <div className="filter-row">
        <select value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="last">Falladas en la última sesión</option>
          <option value="historical">Falladas históricamente</option>
          <option value="twice">Falladas más de una vez</option>
          <option value="tag">Preguntas de un tag concreto</option>
        </select>
        <select value={tag} disabled={!tags.length} onChange={(event) => setTag(event.target.value)}>
          {tags.map((item) => (
            <option value={item} key={item}>
              {item}
            </option>
          ))}
        </select>
        <button onClick={() => onStart(mode, tag)}>Crear sesión</button>
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: string | number; label: string }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="empty">{text}</div>;
}

function validateQuestionFile(data: unknown): { ok: true; errors: []; questions: Question[] } | { ok: false; errors: string[]; questions: [] } {
  const root = data as { questions?: unknown };
  const questions = Array.isArray(data) ? data : root?.questions;
  const errors: string[] = [];
  if (!Array.isArray(questions)) {
    return { ok: false, errors: ["El JSON debe ser un array o un objeto con propiedad questions."], questions: [] };
  }
  const ids = new Set<string>();
  questions.forEach((item, index) => {
    const q = item as Partial<Question>;
    const prefix = `Pregunta ${index + 1}${q?.id ? ` (${q.id})` : ""}:`;
    REQUIRED_FIELDS.forEach((field) => {
      const value = getPath(q, field);
      if (value === undefined || value === null || value === "") errors.push(`${prefix} falta ${field}.`);
    });
    if (q?.part !== 4) errors.push(`${prefix} part debe ser 4.`);
    if (!Array.isArray(q?.tags)) errors.push(`${prefix} tags debe ser un array.`);
    if (!Array.isArray(q?.answers) || !q.answers.length) errors.push(`${prefix} answers debe tener al menos una respuesta.`);
    if (q?.alternative_answers && !Array.isArray(q.alternative_answers)) errors.push(`${prefix} alternative_answers debe ser un array si existe.`);
    const min = Number(q?.question?.word_limit_min);
    const max = Number(q?.question?.word_limit_max);
    if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min) {
      errors.push(`${prefix} word_limit_min y word_limit_max deben ser enteros válidos.`);
    }
    if (q?.id && ids.has(q.id)) errors.push(`${prefix} id duplicado.`);
    if (q?.id) ids.add(q.id);
  });
  if (errors.length) return { ok: false, errors, questions: [] };
  return {
    ok: true,
    errors: [],
    questions: (questions as Question[]).map((question) => ({
      exam: question.exam || "C1 Advanced",
      paper: question.paper || "Use of English",
      skill: question.skill || "key_word_transformation",
      difficulty: question.difficulty || "medium",
      common_errors: Array.isArray(question.common_errors) ? question.common_errors : [],
      alternative_answers: Array.isArray(question.alternative_answers) ? question.alternative_answers : [],
      ...question,
      part: Number(question.part),
      tags: question.tags.map(String),
      answers: question.answers.map(String),
      question: {
        ...question.question,
        word_limit_min: Number(question.question.word_limit_min),
        word_limit_max: Number(question.question.word_limit_max),
      },
    })),
  };
}

function makeImportPreview(questions: Question[], name: string, importedAt: string, validationErrors: string[]): ImportPreview {
  return {
    testId: makeTestId(name, questions),
    name,
    total: questions.length,
    parts: [...new Set(questions.map((question) => question.part))].sort((a, b) => a - b),
    tags: [...new Set(questions.flatMap((question) => question.tags))].sort((a, b) => a.localeCompare(b)),
    difficulties: [...new Set(questions.map((question) => question.difficulty).filter(Boolean) as string[])].sort((a, b) =>
      a.localeCompare(b),
    ),
    importedAt,
    validationErrors,
  };
}

function makeTestId(label: string, questions: Question[]) {
  const ids = questions.map((question) => question.id).join("|");
  return `${slugify(label)}-${hashString(ids).slice(0, 8)}`;
}

function saveActiveSession(session: ActiveSession, currentIndex: number) {
  const savedAt = Date.now();
  const saved: SavedActiveSession = {
    ...session,
    currentIndex,
    totalTimeMs: getActiveSessionTotalTime(session, currentIndex),
    savedAt,
    lastSavedAt: savedAt,
    status: "in_progress",
  };
  localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(saved));
}

function saveAbandonedSession(active: ActiveSession | null, saved: SavedActiveSession | null, currentIndex: number) {
  const source = saved ?? (active ? { ...active, currentIndex, savedAt: Date.now(), totalTimeMs: getActiveSessionTotalTime(active, currentIndex) } : null);
  if (!source) return;
  const existing = readJsonArray(ABANDONED_SESSIONS_KEY);
  const abandoned = {
    session_id: source.id,
    test_id: source.testId,
    label: source.label,
    status: "abandoned",
    started_at: new Date(source.startedAt).toISOString(),
    abandoned_at: new Date().toISOString(),
    last_saved_at: new Date(source.savedAt).toISOString(),
    current_question: source.currentIndex,
    total_time_ms: source.totalTimeMs,
    questions: source.questions,
    responses: source.responses,
  };
  localStorage.setItem(ABANDONED_SESSIONS_KEY, JSON.stringify([...existing, abandoned]));
}

function readJsonArray(key: string): unknown[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getActiveSessionTotalTime(session: ActiveSession, currentIndex: number) {
  const currentQuestion = session.questions[currentIndex];
  const now = Date.now();
  return Object.values(session.responses).reduce((sum, response) => {
    const activeExtra = response.questionId === currentQuestion?.id ? now - response.lastEnteredAt : 0;
    return sum + response.timeMs + activeExtra;
  }, 0);
}

function resetResponseTimers(responses: Record<string, ResponseState>) {
  const now = Date.now();
  return Object.fromEntries(
    Object.entries(responses).map(([questionId, response]) => [
      questionId,
      {
        ...response,
        lastEnteredAt: now,
      },
    ]),
  );
}

function makeResponse(questionId: string): ResponseState {
  return { questionId, answer: "", marked: false, timeMs: 0, lastEnteredAt: Date.now() };
}

function gradeAnswer(question: Question, answer: string, response: ResponseState): Result {
  const normalizedAnswer = normalizeAnswer(answer);
  const acceptedAnswers = [...question.answers, ...(question.alternative_answers ?? [])];
  const normalizedAccepted = acceptedAnswers.map(normalizeAnswer);
  const wordCount = countWords(answer);
  const wordLimitOk = wordCount >= question.question.word_limit_min && wordCount <= question.question.word_limit_max;
  const keywordOk = normalizedAnswer.includes(normalizeAnswer(question.question.keyword));
  const blank = !normalizedAnswer;
  const answerMatch = normalizedAccepted.includes(normalizedAnswer);
  const correct = !blank && wordLimitOk && keywordOk && answerMatch;
  return {
    question,
    answer,
    acceptedAnswers,
    normalizedAnswer,
    wordCount,
    wordLimitOk,
    keywordOk,
    answerMatch,
    status: blank ? "blank" : correct ? "correct" : "incorrect",
    marked: response.marked,
    timeMs: response.timeMs,
  };
}

function summarizeResults(results: Result[], startedAt: number, finishedAt: number): Summary {
  const total = results.length;
  const correct = results.filter((result) => result.status === "correct").length;
  const blank = results.filter((result) => result.status === "blank").length;
  const incorrect = total - correct - blank;
  const byTag: Summary["byTag"] = {};
  results.forEach((result) => {
    result.question.tags.forEach((tag) => {
      byTag[tag] ||= { total: 0, correct: 0, incorrect: 0, blank: 0 };
      byTag[tag].total += 1;
      byTag[tag][result.status] += 1;
    });
  });
  return {
    total,
    correct,
    incorrect,
    blank,
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    totalTimeMs: finishedAt - startedAt,
    averageTimeMs: total ? Math.round(results.reduce((sum, result) => sum + result.timeMs, 0) / total) : 0,
    byTag,
  };
}

function makeSessionResultJson(session: Omit<Session, "resultJson"> | Session): SessionResultJson {
  return {
    session_id: session.id,
    test_id: session.testId,
    label: session.label,
    status: "completed",
    started_at: session.startedAt,
    finished_at: session.finishedAt,
    total_questions: session.summary.total,
    correct: session.summary.correct,
    incorrect: session.summary.incorrect,
    blank: session.summary.blank,
    accuracy: session.summary.accuracy,
    total_time_ms: session.summary.totalTimeMs,
    average_time_ms: session.summary.averageTimeMs,
    by_tag: session.summary.byTag,
    responses: session.results.map((result) => ({
      question_id: result.question.id,
      first_sentence: result.question.question.first_sentence,
      keyword: result.question.question.keyword,
      second_sentence: result.question.question.second_sentence,
      joel_answer: result.answer,
      accepted_answers: result.acceptedAnswers,
      status: result.status,
      word_count: result.wordCount,
      word_limit_ok: result.wordLimitOk,
      keyword_ok: result.keywordOk,
      answer_match: result.answerMatch,
      time_ms: result.timeMs,
      marked_for_review: result.marked,
      tags: result.question.tags,
      explanation: result.question.explanation,
      common_errors: result.question.common_errors ?? [],
    })),
  };
}

function normalizeAnswer(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[.,;:!?'"“”‘’()[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(value: string) {
  const normalized = normalizeAnswer(value);
  return normalized ? normalized.split(" ").length : 0;
}

function getLastFailedQuestions(store: StoreState) {
  const latest = store.sessions.at(-1);
  if (!latest) return [];
  const ids = new Set(latest.results.filter((result) => result.status !== "correct").map((result) => result.question.id));
  return store.questions.filter((question) => ids.has(question.id));
}

function getHistoricallyFailedQuestions(store: StoreState, minFailures: number) {
  return store.questions.filter((question) => getFailureCount(store, question.id) >= minFailures);
}

function getFailedQuestionsFromSession(store: StoreState, session: Session) {
  const ids = new Set(getFailedResults(session).map((result) => result.question.id));
  return store.questions.filter((question) => ids.has(question.id));
}

function getFailedResults(session: Session) {
  return session.results.filter((result) => result.status !== "correct");
}

function getFailureCount(store: StoreState, questionId: string) {
  return store.sessions.reduce((count, session) => {
    const result = session.results.find((item) => item.question.id === questionId);
    return result && result.status !== "correct" ? count + 1 : count;
  }, 0);
}

function exportJson(store: StoreState) {
  downloadFile(
    `joel-c1-results-${dateStamp()}.json`,
    JSON.stringify({ exportedAt: new Date().toISOString(), sessions: store.sessions.map((session) => session.resultJson) }, null, 2),
    "application/json",
  );
}

function exportCsv(store: StoreState) {
  const header = ["session_id", "finished_at", "question_id", "status", "answer", "accepted_answers", "word_count", "word_limit_ok", "keyword_ok", "time_ms", "tags"];
  const rows = store.sessions.flatMap((session) =>
    session.results.map((result) => [
      session.id,
      session.finishedAt,
      result.question.id,
      result.status,
      result.answer,
      result.acceptedAnswers.join(" | "),
      result.wordCount,
      result.wordLimitOk,
      result.keywordOk,
      result.timeMs,
      result.question.tags.join(" | "),
    ]),
  );
  downloadFile(`joel-c1-results-${dateStamp()}.csv`, [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv");
}

function downloadSessionJson(session: Session) {
  downloadFile(sessionFilename(session, "json"), JSON.stringify(session.resultJson, null, 2), "application/json");
}

function downloadSessionCsv(session: Session) {
  const header = [
    "session_id",
    "test_id",
    "finished_at",
    "question_id",
    "status",
    "answer",
    "accepted_answers",
    "word_count",
    "word_limit_ok",
    "keyword_ok",
    "time_ms",
    "tags",
  ];
  const rows = session.results.map((result) => [
    session.id,
    session.testId,
    session.finishedAt,
    result.question.id,
    result.status,
    result.answer,
    result.acceptedAnswers.join(" | "),
    result.wordCount,
    result.wordLimitOk,
    result.keywordOk,
    result.timeMs,
    result.question.tags.join(" | "),
  ]);
  downloadFile(sessionFilename(session, "csv"), [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv");
}

function sessionFilename(session: Session, extension: "json" | "csv") {
  const stamp = session.finishedAt.replace(/[-:]/g, "-").replace("T", "-").slice(0, 16);
  return `joel-c1-advanced-session-${stamp}.${extension}`;
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function splitSecondSentence(sentence: string) {
  const match = sentence.match(/_{3,}/);
  if (!match) return { before: sentence, after: "" };
  const index = match.index ?? 0;
  return {
    before: sentence.slice(0, index).trimEnd(),
    after: sentence.slice(index + match[0].length).trimStart(),
  };
}

function getPath(object: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) return (current as Record<string, unknown>)[key];
    return undefined;
  }, object);
}

function csvCell(value: unknown) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "test";
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formatDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function labelStatus(status: Result["status"]) {
  if (status === "correct") return "Correcta";
  if (status === "blank") return "En blanco";
  return "Incorrecta";
}

function tabLabel(view: string) {
  return { home: "Inicio", import: "Importar JSON", sessions: "Sesiones", review: "Revisión", charts: "Gráficas" }[view] ?? view;
}

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
