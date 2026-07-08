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
  startedAt: string;
  finishedAt: string;
  results: Result[];
  summary: Summary;
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
};

type ActiveSession = {
  id: string;
  label: string;
  startedAt: number;
  questions: Question[];
  responses: Record<string, ResponseState>;
};

const STORAGE_KEY = "joel-c1-trainer-state-v1";
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
    if (!raw) return { questions: [], sessions: [], importedAt: null };
    const parsed = JSON.parse(raw) as Partial<StoreState>;
    return {
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      importedAt: parsed.importedAt ?? null,
    };
  } catch {
    return { questions: [], sessions: [], importedAt: null };
  }
}

function App() {
  const [store, setStore] = React.useState<StoreState>(loadState);
  const [view, setView] = React.useState<"home" | "import" | "sessions" | "review" | "charts">(
    store.questions.length ? "home" : "import",
  );
  const [message, setMessage] = React.useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [activeSession, setActiveSession] = React.useState<ActiveSession | null>(null);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [now, setNow] = React.useState(Date.now());
  const [reviewFilters, setReviewFilters] = React.useState({ status: "all", tag: "all", repeated: false });

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

  const latestSession = store.sessions.at(-1) ?? null;
  const tags = [...new Set(store.questions.flatMap((question) => question.tags))].sort((a, b) => a.localeCompare(b));

  function importQuestions(data: unknown) {
    const validation = validateQuestionFile(data);
    if (!validation.ok) {
      setMessage({ type: "error", text: validation.errors.join(" ") });
      return;
    }
    setStore((current) => {
      const existing = new Map(current.questions.map((question) => [question.id, question]));
      validation.questions.forEach((question) => existing.set(question.id, question));
      return { ...current, questions: [...existing.values()], importedAt: new Date().toISOString() };
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
      importQuestions(JSON.parse(await file.text()));
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
    const responses = Object.fromEntries(questions.map((q) => [q.id, makeResponse(q.id)]));
    setActiveSession({
      id: crypto.randomUUID(),
      label,
      startedAt: Date.now(),
      questions,
      responses,
    });
    setCurrentIndex(0);
    setNow(Date.now());
  }

  function patchCurrentResponse(patch: Partial<ResponseState>) {
    setActiveSession((current) => {
      if (!current) return current;
      const question = current.questions[currentIndex];
      const response = current.responses[question.id];
      const timeNow = Date.now();
      return {
        ...current,
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
      label: activeSession.label,
      startedAt: new Date(activeSession.startedAt).toISOString(),
      finishedAt: new Date(finishedAtMs).toISOString(),
      results,
      summary: summarizeResults(results, activeSession.startedAt, finishedAtMs),
    };
    setStore((current) => ({ ...current, sessions: [...current.sessions, session] }));
    setActiveSession(null);
    setView("sessions");
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
      {view === "sessions" && <SessionsView sessions={store.sessions} />}
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
        <h2>Preguntas cargadas</h2>
        {store.questions.length ? <QuestionsTable questions={store.questions} /> : <Empty text="Todavía no hay preguntas importadas." />}
      </section>
    </>
  );
}

function QuestionsTable({ questions }: { questions: Question[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Keyword</th>
            <th>Tags</th>
            <th>Límite</th>
            <th>Respuestas</th>
          </tr>
        </thead>
        <tbody>
          {questions.map((q) => (
            <tr key={q.id}>
              <td>{q.id}</td>
              <td>{q.question.keyword}</td>
              <td>{q.tags.map((tag) => <span className="pill" key={tag}>{tag}</span>)}</td>
              <td>
                {q.question.word_limit_min}-{q.question.word_limit_max}
              </td>
              <td>{[...q.answers, ...(q.alternative_answers ?? [])].join(" · ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SessionsView({ sessions }: { sessions: Session[] }) {
  if (!sessions.length) {
    return (
      <section className="panel">
        <h2>Resultados por sesión</h2>
        <Empty text="No hay sesiones finalizadas." />
      </section>
    );
  }
  return (
    <section className="panel">
      <h2>Resultados por sesión</h2>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Preguntas</th>
              <th>Correctas</th>
              <th>Incorrectas</th>
              <th>En blanco</th>
              <th>Acierto</th>
              <th>Tiempo medio</th>
            </tr>
          </thead>
          <tbody>
            {sessions
              .slice()
              .reverse()
              .map((session) => (
                <tr key={session.id}>
                  <td>{formatDate(session.finishedAt)}</td>
                  <td>{session.summary.total}</td>
                  <td>{session.summary.correct}</td>
                  <td>{session.summary.incorrect}</td>
                  <td>{session.summary.blank}</td>
                  <td>{session.summary.accuracy}%</td>
                  <td>{formatDuration(session.summary.averageTimeMs)}</td>
                </tr>
              ))}
          </tbody>
        </table>
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

function getFailureCount(store: StoreState, questionId: string) {
  return store.sessions.reduce((count, session) => {
    const result = session.results.find((item) => item.question.id === questionId);
    return result && result.status !== "correct" ? count + 1 : count;
  }, 0);
}

function exportJson(store: StoreState) {
  downloadFile(
    `joel-c1-results-${dateStamp()}.json`,
    JSON.stringify({ exportedAt: new Date().toISOString(), sessions: store.sessions }, null, 2),
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
