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
  type: QuestionType;
  skill?: string;
  difficulty?: string;
  tags: string[];
  question: {
    first_sentence?: string;
    keyword?: string;
    second_sentence?: string;
    text_before?: string;
    gap?: string;
    text_after?: string;
    options?: Array<{ key: string; text: string }>;
    base_word?: string;
    word_limit_min?: number;
    word_limit_max?: number;
  };
  answers: string[];
  alternative_answers?: string[];
  explanation: string;
  common_errors?: Array<{ answer: string; reason: string }>;
};

type QuestionType = "multiple_choice_cloze" | "open_cloze" | "word_formation" | "key_word_transformation";

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
  selectedOptionText?: string;
  correctOptionText?: string;
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
  byPart: Record<string, { total: number; correct: number; incorrect: number; blank: number; timeMs: number }>;
  byType: Record<string, { total: number; correct: number; incorrect: number; blank: number; timeMs: number }>;
};

type StoreState = {
  questions: Question[];
  tests: TestPack[];
  sessions: Session[];
  importedAt: string | null;
  lastImport: ImportPreview | null;
};

type TestPack = {
  id: string;
  title: string;
  sourceName: string;
  importedAt: string;
  questions: Question[];
  preview: ImportPreview;
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
  title: string;
  name: string;
  total: number;
  parts: number[];
  tags: string[];
  types: QuestionType[];
  partCounts: Record<string, number>;
  typeCounts: Record<string, number>;
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
  tag_summary?: Array<Record<string, unknown>>;
  part_summary?: Array<Record<string, unknown>>;
  type_summary?: Array<Record<string, unknown>>;
  responses: Array<{
    question_id: string;
    part: number;
    type: QuestionType;
    skill?: string;
    joel_answer: string;
    accepted_answers: string[];
    alternative_answers: string[];
    status: Result["status"];
    correct: boolean;
    word_count: number;
    within_word_limit: boolean;
    used_keyword?: boolean;
    answer_match: boolean;
    time_spent_seconds: number;
    marked_for_review: boolean;
    tags: string[];
    selected_option_key?: string;
    selected_option_text?: string;
    correct_option_key?: string;
    correct_option_text?: string;
    options?: Array<{ key: string; text: string }>;
    base_word?: string;
    first_sentence?: string;
    keyword?: string;
    second_sentence?: string;
    explanation: string;
    common_errors: Array<{ answer: string; reason: string }>;
  }>;
};

type VocabularyItemType =
  | "word"
  | "expression"
  | "collocation"
  | "phrasal_verb"
  | "verb_pattern"
  | "adjective_pattern"
  | "connector";

type VocabularyMode = "flashcard" | "gap_fill" | "multiple_choice" | "translation" | "mixed_review";

type VocabularyItem = {
  id: string;
  type: VocabularyItemType;
  term: string;
  meaning_en: string;
  meaning_es: string;
  example: string;
  gap_sentence: string;
  gap_answer: string;
  pattern: string;
  tags: string[];
  difficulty: string;
  source_origin: string;
  explanation?: string;
  common_errors?: Array<{ answer: string; reason: string }>;
  accepted_answers?: string[];
  distractors?: string[];
  notes?: string;
};

type VocabularyPack = {
  id: string;
  title: string;
  metadata: Record<string, unknown>;
  importedAt: string;
  items: VocabularyItem[];
};

type VocabularyResponse = {
  item?: VocabularyItem;
  itemId: string;
  type: VocabularyItemType;
  term: string;
  mode: VocabularyMode;
  prompt: string;
  userAnswer: string;
  acceptedAnswer: string;
  status: "correct" | "incorrect" | "unsure" | "blank";
  timeMs: number;
  tags: string[];
  difficulty: string;
  sourceOrigin: string;
  meaningEn: string;
  meaningEs: string;
  example: string;
  pattern: string;
  explanation?: string;
  commonErrors: Array<{ answer: string; reason: string }>;
  feedback: string;
};

type VocabularySession = {
  id: string;
  student: string;
  exam: string;
  module: "vocabulary";
  packId: string;
  packTitle: string;
  mode: VocabularyMode;
  startedAt: string;
  finishedAt: string;
  summary: VocabularySummary;
  responses: VocabularyResponse[];
  resultJson: VocabularySessionJson;
};

type VocabularySummary = {
  total: number;
  correct: number;
  incorrect: number;
  unsure: number;
  blank: number;
  accuracy: number;
  totalTimeMs: number;
  averageTimeMs: number;
  byTag: Record<string, { total: number; correct: number; incorrect: number; unsure: number; blank: number; accuracy: number }>;
  byType: Record<string, { total: number; correct: number; incorrect: number; unsure: number; blank: number; accuracy: number }>;
};

type VocabularySessionJson = {
  session_id: string;
  student: string;
  exam: string;
  module: "vocabulary";
  pack_id: string;
  mode: VocabularyMode;
  started_at: string;
  finished_at: string;
  total_items: number;
  correct: number;
  incorrect: number;
  unsure: number;
  blank: number;
  accuracy: number;
  by_tag: VocabularySummary["byTag"];
  by_type: VocabularySummary["byType"];
  responses: Array<{
    item_id: string;
    type: VocabularyItemType;
    term: string;
    mode: VocabularyMode;
    prompt: string;
    user_answer: string;
    accepted_answer: string;
    status: VocabularyResponse["status"];
    time_ms: number;
    tags: string[];
    difficulty: string;
    source_origin: string;
    meaning_en: string;
    meaning_es: string;
    example: string;
    pattern: string;
    feedback: string;
    common_errors: Array<{ answer: string; reason: string }>;
  }>;
};

type VocabularyStats = Record<
  string,
  {
    attempts: number;
    correct: number;
    incorrect: number;
    unsure: number;
    lastAttemptAt: string;
  }
>;

type VocabularyAggregateStats = Record<string, { attempts: number; correct: number; incorrect: number; unsure: number }>;

type VocabularyState = {
  packs: VocabularyPack[];
  sessions: VocabularySession[];
  stats: VocabularyStats;
  statsByTag: VocabularyAggregateStats;
  statsByType: VocabularyAggregateStats;
};

type VocabularyReviewItem = {
  itemId: string;
  type: VocabularyItemType | string;
  term: string;
  mode: VocabularyMode;
  prompt: string;
  userAnswer: string;
  acceptedAnswer: string;
  status: VocabularyResponse["status"];
  timeMs: number;
  tags: string[];
  difficulty: string;
  sourceOrigin: string;
  meaningEn: string;
  meaningEs: string;
  example: string;
  pattern: string;
  feedback: string;
  commonErrors: Array<{ answer: string; reason: string }>;
  fullExplanationAvailable: boolean;
};

const STORAGE_KEY = "joel-c1-trainer-state-v1";
const VOCAB_STORAGE_KEY = "joel-c1-trainer-vocabulary-v1";
const ACTIVE_SESSION_KEY = "joel-c1-trainer-active-session-v1";
const ABANDONED_SESSIONS_KEY = "joel-c1-trainer-abandoned-sessions-v1";
const VOCAB_ALLOWED_TYPES: VocabularyItemType[] = [
  "word",
  "expression",
  "collocation",
  "phrasal_verb",
  "verb_pattern",
  "adjective_pattern",
  "connector",
];
const VOCAB_REQUIRED_FIELDS = [
  "id",
  "type",
  "term",
  "meaning_en",
  "meaning_es",
  "example",
  "gap_sentence",
  "gap_answer",
  "pattern",
  "tags",
  "difficulty",
  "source_origin",
];
const REQUIRED_FIELDS = [
  "id",
  "part",
  "type",
  "tags",
  "question",
  "answers",
  "explanation",
];
const QUESTION_TYPES: QuestionType[] = ["multiple_choice_cloze", "open_cloze", "word_formation", "key_word_transformation"];

function loadState(): StoreState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { questions: [], tests: [], sessions: [], importedAt: null, lastImport: null };
    const parsed = JSON.parse(raw) as Partial<StoreState>;
    const migrated = migrateTests(parsed);
    const migratedQuestions = getQuestionsFromTests(migrated);
    return {
      questions: migratedQuestions,
      tests: migrated,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions.map(normalizeStoredSession) : [],
      importedAt: parsed.importedAt ?? null,
      lastImport: parsed.lastImport
        ? normalizeImportPreview(parsed.lastImport, migratedQuestions, parsed.lastImport.title ?? "Imported test", parsed.lastImport.name ?? "Imported test", parsed.importedAt ?? new Date().toISOString())
        : null,
    };
  } catch {
    return { questions: [], tests: [], sessions: [], importedAt: null, lastImport: null };
  }
}

function migrateTests(parsed: Partial<StoreState>) {
  if (Array.isArray(parsed.tests) && parsed.tests.length) {
    return parsed.tests.map(normalizeStoredTest);
  }
  const legacyQuestions = Array.isArray(parsed.questions) ? parsed.questions : [];
  if (!legacyQuestions.length) return [];
  const importedAt = parsed.importedAt ?? new Date().toISOString();
  return [
    makeTestPack({
      questions: legacyQuestions,
      title: "Legacy imported test",
      sourceName: "Migrated questions",
      importedAt,
    }),
  ];
}

function normalizeStoredTest(test: TestPack) {
  const importedAt = test.importedAt ?? new Date().toISOString();
  const title = test.title || test.sourceName || "Imported test";
  const questions = Array.isArray(test.questions) ? test.questions.map(normalizeQuestion) : [];
  return {
    id: test.id || makeTestId(title, questions),
    title,
    sourceName: test.sourceName || title,
    importedAt,
    questions,
    preview: normalizeImportPreview(test.preview, questions, title, test.sourceName || title, importedAt),
  };
}

function normalizeStoredSession(session: Session): Session {
  const results = Array.isArray(session.results)
    ? session.results.map((result) => ({ ...result, question: normalizeQuestion(result.question) }))
    : [];
  const normalized: Session = {
    ...session,
    results,
    summary: normalizeSummary(session.summary, results),
    testId: session.testId ?? makeTestId(session.label ?? "session", results.map((result) => result.question) ?? []),
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
  const [view, setView] = React.useState<"home" | "import" | "sessions" | "review" | "charts" | "vocabulary">(
    store.tests.length ? "home" : "import",
  );
  const [message, setMessage] = React.useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [activeSession, setActiveSession] = React.useState<ActiveSession | null>(null);
  const [savedActiveSession, setSavedActiveSession] = React.useState<SavedActiveSession | null>(loadSavedActiveSession);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [now, setNow] = React.useState(Date.now());
  const [reviewFilters, setReviewFilters] = React.useState({ status: "all", tag: "all", repeated: false });
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);
  const [justCompletedSessionId, setJustCompletedSessionId] = React.useState<string | null>(null);
  const [selectedTestId, setSelectedTestId] = React.useState<string>(() => store.tests[0]?.id ?? "all");
  const [partFilter, setPartFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [tagFilter, setTagFilter] = React.useState("all");

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
  const allQuestions = getQuestionsFromTests(store.tests);
  const selectedTest = store.tests.find((test) => test.id === selectedTestId) ?? store.tests[0] ?? null;
  const selectedQuestions = filterUseOfEnglishQuestions(selectedTestId === "all" ? allQuestions : (selectedTest?.questions ?? []), {
    part: partFilter,
    type: typeFilter,
    tag: tagFilter,
  });
  const tags = [...new Set(allQuestions.flatMap((question) => question.tags))].sort((a, b) => a.localeCompare(b));
  const availableParts = [...new Set((selectedTestId === "all" ? allQuestions : (selectedTest?.questions ?? [])).map((q) => q.part))].sort();
  const availableTypes = [...new Set((selectedTestId === "all" ? allQuestions : (selectedTest?.questions ?? [])).map((q) => q.type))].sort();

  function importQuestions(data: unknown) {
    const validation = validateQuestionFile(data);
    if (!validation.ok) {
      setMessage({ type: "error", text: validation.errors.join(" ") });
      return;
    }
    const importedAt = new Date().toISOString();
    const metadata = getTestMetadata(data, "Preguntas importadas");
    const pack = makeTestPack({ questions: validation.questions, title: metadata.title, sourceName: metadata.title, importedAt, id: metadata.id });
    if (!upsertTestPack(pack)) return;
    setMessage({ type: "ok", text: `Importado test "${pack.title}" con ${validation.questions.length} preguntas.` });
    setView("import");
  }

  function upsertTestPack(pack: TestPack) {
    const exists = store.tests.some((test) => test.id === pack.id || test.title === pack.title);
    if (exists && !window.confirm(`Ya existe un test llamado "${pack.title}". ¿Quieres reemplazarlo?`)) {
      return false;
    }
    setStore((current) => {
      const tests = [...current.tests.filter((test) => test.id !== pack.id && test.title !== pack.title), pack];
      return {
        ...current,
        tests,
        questions: getQuestionsFromTests(tests),
        importedAt: pack.importedAt,
        lastImport: pack.preview,
      };
    });
    setSelectedTestId(pack.id);
    return true;
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
          lastImport: makeImportPreview([], file.name.replace(/\.json$/i, ""), file.name, new Date().toISOString(), validation.errors),
        }));
        return;
      }
      const importedAt = new Date().toISOString();
      const metadata = getTestMetadata(data, file.name);
      const pack = makeTestPack({ questions: validation.questions, title: metadata.title, sourceName: file.name, importedAt, id: metadata.id });
      if (!upsertTestPack(pack)) return;
      setMessage({ type: "ok", text: `Importado test "${pack.title}" con ${validation.questions.length} preguntas desde ${file.name}.` });
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

  function startSession(questions: Question[], label: string, testId = makeTestId(label, questions)) {
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
      testId,
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
    const part = Number(tag);
    const questions =
      mode === "last"
        ? getLastFailedQuestions(store)
        : mode === "historical"
          ? getHistoricallyFailedQuestions(store, 1)
          : mode === "twice"
            ? getHistoricallyFailedQuestions(store, 2)
            : mode === "failed_part"
              ? getHistoricallyFailedQuestions(store, 1).filter((question) => question.part === part)
              : mode === "failed_type"
                ? getHistoricallyFailedQuestions(store, 1).filter((question) => question.type === tag)
                : allQuestions.filter((question) => question.tags.includes(tag));
    const label =
      mode === "last"
        ? "Falladas última sesión"
        : mode === "historical"
          ? "Falladas históricas"
        : mode === "twice"
          ? "Falladas más de una vez"
          : mode === "failed_part"
            ? `Falladas Part ${tag}`
            : mode === "failed_type"
              ? `Falladas ${labelQuestionType(tag)}`
          : `Tag: ${tag}`;
    startSession(questions, label, mode === "tag" ? `tag-${slugify(tag)}` : `repeat-${mode}`);
  }

  if (activeSession) {
    const question = activeSession.questions[currentIndex];
    const response = activeSession.responses[question.id];
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
            {getQuestionInstruction(question)}
          </p>
          <article className="question-card">
            <div className="actions">
              <span className="pill">Part {question.part}</span>
              <span className="pill">{labelQuestionType(question.type)}</span>
            </div>
            <ExamQuestionRenderer question={question} response={response} onAnswer={(answer) => patchCurrentResponse({ answer })} />
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
        {(["home", "import", "sessions", "review", "charts", "vocabulary"] as const).map((item) => (
          <button key={item} className={view === item ? "active" : ""} onClick={() => setView(item)}>
            {tabLabel(item)}
          </button>
        ))}
      </nav>
      {view === "home" && (
        <>
          <section className="panel">
            <h1>Use of English Parts 1-4 para Joel</h1>
            <p className="lead">
              Entrenamiento de Multiple Choice Cloze, Open Cloze, Word Formation y Key Word Transformations con modo examen, corrección al finalizar y resultados exportables.
            </p>
            <div className="grid">
              <Metric value={store.tests.length} label="tests importados" />
              <Metric value={allQuestions.length} label="preguntas totales" />
              <Metric value={store.sessions.length} label="sesiones guardadas" />
              <Metric value={latestSession ? `${latestSession.summary.accuracy}%` : "-"} label="último acierto" />
              <Metric value={latestSession ? formatDuration(latestSession.summary.totalTimeMs) : "-"} label="último tiempo" />
            </div>
            <TestSelector
              tests={store.tests}
              selectedTestId={selectedTestId}
              onSelect={setSelectedTestId}
              className="top-space"
            />
            <UseOfEnglishFilters
              partFilter={partFilter}
              typeFilter={typeFilter}
              tagFilter={tagFilter}
              parts={availableParts}
              types={availableTypes}
              tags={tags}
              onPart={setPartFilter}
              onType={setTypeFilter}
              onTag={setTagFilter}
            />
            <div className="actions top-space">
              <button
                disabled={!selectedQuestions.length}
                onClick={() =>
                  startSession(
                    selectedQuestions,
                    selectedTestId === "all" ? "Todas las preguntas" : `Test: ${selectedTest?.title ?? "Seleccionado"}`,
                    selectedTestId === "all" ? "all-questions" : (selectedTest?.id ?? makeTestId("selected", selectedQuestions)),
                  )
                }
              >
                Empezar test seleccionado
              </button>
              <button
                className="secondary"
                disabled={!allQuestions.length}
                onClick={() => startSession(allQuestions, "Todas las preguntas", "all-questions")}
              >
                Todas las preguntas
              </button>
              <button
                className="secondary"
                disabled={!getLastFailedQuestions(store).length}
                onClick={() => startSession(getLastFailedQuestions(store), "Falladas última sesión", "repeat-last-failed")}
              >
                Repetir falladas última sesión
              </button>
              <button
                className="secondary"
                disabled={!getHistoricallyFailedQuestions(store, 1).length}
                onClick={() => startSession(getHistoricallyFailedQuestions(store, 1), "Falladas históricas", "repeat-historical-failed")}
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
            <RepeatPanel tags={tags} parts={availableParts} types={availableTypes} onStart={startRepeat} />
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
          onRepeatFailed={(session) =>
            startSession(getFailedQuestionsFromSession(store, session), `Falladas: ${session.label}`, `repeat-failed-${session.testId}`)
          }
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
      {view === "vocabulary" && <VocabularyView />}
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
          <span>Use of English · Parts 1-4</span>
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
      <section className="panel top-space">
        <h2>Tests disponibles</h2>
        {store.tests.length ? <TestsOverview tests={store.tests} /> : <Empty text="No hay tests importados." />}
      </section>
    </>
  );
}

function TestSelector({
  tests,
  selectedTestId,
  onSelect,
  className,
}: {
  tests: TestPack[];
  selectedTestId: string;
  onSelect: (testId: string) => void;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="field-label" htmlFor="test-select">
        Test para la próxima sesión
      </label>
      <select id="test-select" value={selectedTestId} onChange={(event) => onSelect(event.target.value)} disabled={!tests.length}>
        {tests.map((test) => (
          <option value={test.id} key={test.id}>
            {test.title} ({test.questions.length} preguntas)
          </option>
        ))}
        {tests.length > 1 && <option value="all">Todas las preguntas ({getQuestionsFromTests(tests).length})</option>}
      </select>
      <p className="small">Por defecto se ejecuta solo el test seleccionado. “Todas las preguntas” es una opción explícita.</p>
    </div>
  );
}

function UseOfEnglishFilters({
  partFilter,
  typeFilter,
  tagFilter,
  parts,
  types,
  tags,
  onPart,
  onType,
  onTag,
}: {
  partFilter: string;
  typeFilter: string;
  tagFilter: string;
  parts: number[];
  types: QuestionType[];
  tags: string[];
  onPart: (value: string) => void;
  onType: (value: string) => void;
  onTag: (value: string) => void;
}) {
  return (
    <div className="filter-row top-space">
      <select value={partFilter} onChange={(event) => onPart(event.target.value)}>
        <option value="all">Todas las parts</option>
        {parts.map((part) => <option value={String(part)} key={part}>Part {part}</option>)}
      </select>
      <select value={typeFilter} onChange={(event) => onType(event.target.value)}>
        <option value="all">Todos los tipos</option>
        {types.map((type) => <option value={type} key={type}>{labelQuestionType(type)}</option>)}
      </select>
      <select value={tagFilter} onChange={(event) => onTag(event.target.value)}>
        <option value="all">Todos los tags</option>
        {tags.map((tag) => <option value={tag} key={tag}>{tag}</option>)}
      </select>
    </div>
  );
}

function ExamQuestionRenderer({
  question,
  response,
  onAnswer,
}: {
  question: Question;
  response: ResponseState;
  onAnswer: (answer: string) => void;
}) {
  if (question.type === "multiple_choice_cloze") {
    return (
      <div>
        <div className="first-sentence">
          {question.question.text_before} {question.question.gap ?? "____"} {question.question.text_after}
        </div>
        <div className="choice-grid top-space">
          {(question.question.options ?? []).map((option) => (
            <button
              className={response.answer === option.key ? "" : "secondary"}
              key={option.key}
              onClick={() => onAnswer(option.key)}
            >
              {option.key}. {option.text}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (question.type === "open_cloze" || question.type === "word_formation") {
    return (
      <div>
        {question.type === "word_formation" && <div className="keyword">Base word: {question.question.base_word}</div>}
        <label className="sentence-line top-space">
          <span>{question.question.text_before}</span>
          <input
            className="inline-answer short-answer"
            value={response.answer}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            onChange={(event) => onAnswer(event.target.value)}
          />
          <span>{question.question.text_after}</span>
        </label>
      </div>
    );
  }
  const parts = splitSecondSentence(question.question.second_sentence ?? "");
  return (
    <>
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
            onChange={(event) => onAnswer(event.target.value)}
          />
          <span>{parts.after}</span>
        </label>
      </div>
    </>
  );
}

function TestsOverview({ tests }: { tests: TestPack[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Test</th>
            <th>Fichero</th>
            <th>Preguntas</th>
            <th>Part</th>
            <th>Tags</th>
            <th>Dificultad</th>
          </tr>
        </thead>
        <tbody>
          {tests.map((test) => (
            <tr key={test.id}>
              <td>{test.title}</td>
              <td>{test.sourceName}</td>
              <td>{test.questions.length}</td>
              <td>{test.preview.parts.join(", ") || "-"}</td>
              <td>{test.preview.tags.map((tag) => <span className="pill" key={tag}>{tag}</span>)}</td>
              <td>{test.preview.difficulties.join(", ") || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SafeImportPreview({ preview }: { preview: ImportPreview }) {
  const partCounts = preview.partCounts ?? {};
  const typeCounts = preview.typeCounts ?? {};
  return (
    <div className="safe-preview">
      <div className="grid">
        <Metric value={preview.title} label="test" />
        <Metric value={preview.name} label="fichero" />
        <Metric value={preview.total} label="preguntas" />
        <Metric value={preview.parts.length ? preview.parts.join(", ") : "-"} label="part" />
        <Metric value={preview.difficulties.length ? preview.difficulties.join(", ") : "-"} label="dificultad" />
      </div>
      <div className="top-space">
        <strong>Distribución</strong>
        <div className="actions top-space">
          {Object.entries(partCounts).map(([label, total]) => <span className="pill" key={label}>{label}: {total}</span>)}
        </div>
      </div>
      <div className="top-space">
        <strong>Tipos detectados</strong>
        <div className="actions top-space">
          {Object.entries(typeCounts).map(([label, total]) => <span className="pill" key={label}>{label}: {total}</span>)}
        </div>
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
      <h3 className="top-space">Resumen por parts</h3>
      <div className="actions">
        {Object.entries(session.summary.byPart).map(([part, item]) => (
          <span className="pill" key={part}>
            Part {part}: {item.correct}/{item.total}
          </span>
        ))}
      </div>
      <h3 className="top-space">Resumen por type</h3>
      <div className="actions">
        {Object.entries(session.summary.byType).map(([type, item]) => (
          <span className="pill" key={type}>
            {labelQuestionType(type as QuestionType)}: {item.correct}/{item.total}
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
      <div className="actions">
        <span className="pill">Part {result.question.part}</span>
        <span className="pill">{labelQuestionType(result.question.type)}</span>
      </div>
      <ReviewQuestionDetails result={result} />
      <p><strong>Respuesta de Joel:</strong> {result.answer || "—"}</p>
      <p><strong>Respuesta correcta:</strong> {result.acceptedAnswers.join(" · ")}</p>
      {result.question.type !== "multiple_choice_cloze" && (
        <p><strong>Límite de palabras:</strong> {result.wordLimitOk ? "Sí" : "No"}{result.question.type === "key_word_transformation" ? ` · Keyword usada: ${result.keywordOk ? "Sí" : "No"}` : ""}</p>
      )}
      <p><strong>Explicación:</strong> {result.question.explanation}</p>
      {!!result.question.common_errors?.length && (
        <p><strong>Common errors:</strong> {result.question.common_errors.map((item) => `${item.answer}: ${item.reason}`).join(" · ")}</p>
      )}
      <div className="actions">{result.question.tags.map((tag) => <span className="pill" key={tag}>{tag}</span>)}</div>
    </article>
  );
}

function ReviewQuestionDetails({ result }: { result: Result }) {
  const q = result.question;
  if (q.type === "multiple_choice_cloze") {
    return (
      <div>
        <p><strong>Texto:</strong> {q.question.text_before} {q.question.gap ?? "____"} {q.question.text_after}</p>
        <div className="review-list">
          {(q.question.options ?? []).map((option) => (
            <span className={`pill ${option.key === q.answers[0] ? "good" : option.key === result.answer ? "bad" : ""}`} key={option.key}>
              {option.key}. {option.text}
            </span>
          ))}
        </div>
      </div>
    );
  }
  if (q.type === "open_cloze") {
    return <p><strong>Frase:</strong> {q.question.text_before} ____ {q.question.text_after}</p>;
  }
  if (q.type === "word_formation") {
    return (
      <>
        <p><strong>Base word:</strong> {q.question.base_word}</p>
        <p><strong>Frase:</strong> {q.question.text_before} ____ {q.question.text_after}</p>
      </>
    );
  }
  return (
    <>
      <p><strong>First sentence:</strong> {q.question.first_sentence}</p>
      <p><strong>Keyword:</strong> {q.question.keyword}</p>
      <p><strong>Second sentence:</strong> {q.question.second_sentence}</p>
    </>
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

function VocabularyView() {
  const [vocab, setVocab] = React.useState<VocabularyState>(loadVocabularyState);
  const [message, setMessage] = React.useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [file, setFile] = React.useState<File | undefined>();
  const [selectedPackId, setSelectedPackId] = React.useState(() => vocab.packs[0]?.id ?? "");
  const [mode, setMode] = React.useState<VocabularyMode>("mixed_review");
  const [count, setCount] = React.useState(20);
  const [tagFilter, setTagFilter] = React.useState("all");
  const [difficultyFilter, setDifficultyFilter] = React.useState("all");
  const [sourceFilter, setSourceFilter] = React.useState("all");
  const [poolFilter, setPoolFilter] = React.useState("all");
  const [active, setActive] = React.useState<{
    id: string;
    pack: VocabularyPack;
    mode: VocabularyMode;
    startedAt: number;
    index: number;
    items: VocabularyItem[];
    itemModes: Record<string, VocabularyMode>;
    responses: VocabularyResponse[];
    answer: string;
    flashcardRevealed: boolean;
    currentStartedAt: number;
  } | null>(null);

  React.useEffect(() => {
    localStorage.setItem(VOCAB_STORAGE_KEY, JSON.stringify(vocab));
  }, [vocab]);

  const selectedPack = vocab.packs.find((pack) => pack.id === selectedPackId) ?? vocab.packs[0] ?? null;
  const allTags = [...new Set(selectedPack?.items.flatMap((item) => item.tags) ?? [])].sort((a, b) => a.localeCompare(b));
  const difficulties = [...new Set(selectedPack?.items.map((item) => item.difficulty) ?? [])].sort((a, b) => a.localeCompare(b));
  const sources = [...new Set(selectedPack?.items.map((item) => item.source_origin) ?? [])].sort((a, b) => a.localeCompare(b));

  async function importVocabularyFile() {
    if (!file) {
      setMessage({ type: "error", text: "Selecciona un JSON de vocabulario antes de importar." });
      return;
    }
    try {
      const data = JSON.parse(await file.text());
      const validation = validateVocabularyPack(data, file.name);
      if (!validation.ok) {
        setMessage({ type: "error", text: validation.errors.join(" ") });
        return;
      }
      const exists = vocab.packs.some((pack) => pack.id === validation.pack.id || pack.title === validation.pack.title);
      if (exists && !window.confirm(`Ya existe el pack "${validation.pack.title}". ¿Quieres reemplazarlo?`)) return;
      setVocab((current) => ({
        ...current,
        packs: [...current.packs.filter((pack) => pack.id !== validation.pack.id && pack.title !== validation.pack.title), validation.pack],
      }));
      setSelectedPackId(validation.pack.id);
      setMessage({ type: "ok", text: `Importado ${validation.pack.title} con ${validation.pack.items.length} items.` });
    } catch (error) {
      setMessage({ type: "error", text: `JSON no válido: ${(error as Error).message}` });
    }
  }

  function buildVocabularyPool(pack: VocabularyPack) {
    return pack.items.filter((item) => {
      if (tagFilter !== "all" && !item.tags.includes(tagFilter)) return false;
      if (difficultyFilter !== "all" && item.difficulty !== difficultyFilter) return false;
      if (sourceFilter !== "all" && item.source_origin !== sourceFilter) return false;
      const stats = vocab.stats[item.id];
      if (poolFilter === "failed" && (!stats || stats.incorrect < 1)) return false;
      if (poolFilter === "failed_twice" && (!stats || stats.incorrect < 2)) return false;
      if (poolFilter === "unsure" && (!stats || stats.unsure < 1)) return false;
      if (poolFilter === "chatgpt" && !item.source_origin.toLowerCase().includes("chatgpt")) return false;
      if (poolFilter === "joel_pdf" && !item.source_origin.toLowerCase().includes("joel_pdf")) return false;
      return true;
    });
  }

  function startVocabularySession() {
    if (!selectedPack) return;
    const pool = buildVocabularyPool(selectedPack);
    if (!pool.length) {
      setMessage({ type: "error", text: "No hay items con esos filtros." });
      return;
    }
    const items = shuffle(pool).slice(0, Math.min(count, pool.length));
    const itemModes = Object.fromEntries(items.map((item, index) => [item.id, resolveVocabularyMode(mode, index)]));
    setActive({
      id: crypto.randomUUID(),
      pack: selectedPack,
      mode,
      startedAt: Date.now(),
      index: 0,
      items,
      itemModes,
      responses: [],
      answer: "",
      flashcardRevealed: false,
      currentStartedAt: Date.now(),
    });
  }

  function answerVocabulary(statusOverride?: VocabularyResponse["status"], answerOverride?: string) {
    if (!active) return;
    const item = active.items[active.index];
    const itemMode = active.itemModes[item.id];
    const userAnswer = answerOverride ?? active.answer;
    const status = statusOverride ?? gradeVocabularyAnswer(item, itemMode, userAnswer);
    const response = makeVocabularyResponse(item, itemMode, userAnswer, status, Date.now() - active.currentStartedAt);
    const responses = [...active.responses, response];
    if (active.index === active.items.length - 1) {
      finishVocabularySession(active, responses);
      return;
    }
    setActive({
      ...active,
      responses,
      index: active.index + 1,
      answer: "",
      flashcardRevealed: false,
      currentStartedAt: Date.now(),
    });
  }

  function finishVocabularySession(current: NonNullable<typeof active>, responses: VocabularyResponse[]) {
    const finishedAt = Date.now();
    const summary = summarizeVocabulary(responses, current.startedAt, finishedAt);
    const session: VocabularySession = {
      id: current.id,
      student: String(current.pack.metadata.student ?? "Joel"),
      exam: String(current.pack.metadata.exam ?? "C1 Advanced"),
      module: "vocabulary",
      packId: current.pack.id,
      packTitle: current.pack.title,
      mode: current.mode,
      startedAt: new Date(current.startedAt).toISOString(),
      finishedAt: new Date(finishedAt).toISOString(),
      summary,
      responses,
      resultJson: {} as VocabularySessionJson,
    };
    session.resultJson = makeVocabularySessionJson(session);
    setVocab((currentState) => ({
      ...currentState,
      sessions: [...currentState.sessions, session],
      stats: updateVocabularyStats(currentState.stats, responses, session.finishedAt),
      statsByTag: updateVocabularyAggregateStats(currentState.statsByTag, responses, "tag"),
      statsByType: updateVocabularyAggregateStats(currentState.statsByType, responses, "type"),
    }));
    setActive(null);
  }

  if (active) {
    const item = active.items[active.index];
    const itemMode = active.itemModes[item.id];
    const options = itemMode === "multiple_choice" ? makeVocabularyOptions(active.pack.items, item) : [];
    return (
      <section className="panel">
        <div className="exam-header">
          <div className="exam-meta">
            <strong>
              Vocabulary · {active.index + 1} de {active.items.length}
            </strong>
            <span className="timer">{active.pack.title}</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${((active.index + 1) / active.items.length) * 100}%` }} />
          </div>
        </div>
        <article className="question-card">
          <div className="pill">{labelVocabularyMode(itemMode)}</div>
          <VocabularyPrompt item={item} mode={itemMode} revealed={active.flashcardRevealed} />
          {itemMode === "flashcard" ? (
            <>
              {!active.flashcardRevealed && <button onClick={() => setActive({ ...active, flashcardRevealed: true })}>Reveal</button>}
              <div className="actions">
                <button onClick={() => answerVocabulary("correct", "I knew it")}>I knew it</button>
                <button className="secondary" onClick={() => answerVocabulary("unsure", "I was unsure")}>I was unsure</button>
                <button className="danger" onClick={() => answerVocabulary("incorrect", "I did not know it")}>I did not know it</button>
              </div>
            </>
          ) : itemMode === "multiple_choice" ? (
            <div className="choice-grid">
              {options.map((option) => (
                <button className="secondary" key={option} onClick={() => answerVocabulary(undefined, option)}>
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <div className="actions">
              <input
                value={active.answer}
                onChange={(event) => setActive({ ...active, answer: event.target.value })}
                placeholder="Escribe la respuesta"
                autoFocus
              />
              <button onClick={() => answerVocabulary()}>Responder</button>
              <button className="secondary" onClick={() => answerVocabulary("blank", "")}>Dejar en blanco</button>
            </div>
          )}
        </article>
      </section>
    );
  }

  return (
    <>
      <section className="panel">
        <h1>Vocabulary</h1>
        <p className="lead">Práctica separada de vocabulario C1: flashcards, gap fill, multiple choice, translation y mixed review.</p>
        <div className="import-box">
          <input type="file" accept="application/json,.json" onChange={(event) => setFile(event.target.files?.[0])} />
          <div className="actions">
            <button onClick={importVocabularyFile}>Importar pack de Vocabulary</button>
          </div>
          {message && <div className={`message ${message.type}`}>{message.text}</div>}
        </div>
      </section>

      <section className="layout two top-space">
        <div className="panel">
          <h2>Configurar sesión</h2>
          <div className="filter-row">
            <select value={selectedPackId} onChange={(event) => setSelectedPackId(event.target.value)} disabled={!vocab.packs.length}>
              {vocab.packs.map((pack) => (
                <option key={pack.id} value={pack.id}>{pack.title} ({pack.items.length})</option>
              ))}
            </select>
            <select value={mode} onChange={(event) => setMode(event.target.value as VocabularyMode)}>
              <option value="flashcard">Flashcard</option>
              <option value="gap_fill">Gap fill</option>
              <option value="multiple_choice">Multiple choice</option>
              <option value="translation">Translation recall</option>
              <option value="mixed_review">Mixed review</option>
            </select>
            <input type="number" min={1} max={200} value={count} onChange={(event) => setCount(Number(event.target.value))} />
            <select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)}>
              <option value="all">Todos los tags</option>
              {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
            <select value={difficultyFilter} onChange={(event) => setDifficultyFilter(event.target.value)}>
              <option value="all">Todas las dificultades</option>
              {difficulties.map((difficulty) => <option key={difficulty} value={difficulty}>{difficulty}</option>)}
            </select>
            <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
              <option value="all">Todos los orígenes</option>
              {sources.map((source) => <option key={source} value={source}>{source}</option>)}
            </select>
            <select value={poolFilter} onChange={(event) => setPoolFilter(event.target.value)}>
              <option value="all">Usar todos</option>
              <option value="failed">Solo fallados</option>
              <option value="failed_twice">Fallados más de una vez</option>
              <option value="unsure">Solo inseguros</option>
              <option value="chatgpt">Solo añadidos por ChatGPT</option>
              <option value="joel_pdf">Solo PDF de Joel</option>
            </select>
            <button disabled={!selectedPack} onClick={startVocabularySession}>Empezar Vocabulary</button>
          </div>
        </div>
        <div className="panel">
          <h2>Packs</h2>
          {vocab.packs.length ? (
            <div className="review-list">
              {vocab.packs.map((pack) => (
                <div className="metric" key={pack.id}>
                  <strong>{pack.title}</strong>
                  <span>{pack.items.length} items · {String(pack.metadata.exam ?? "C1 Advanced")}</span>
                </div>
              ))}
            </div>
          ) : (
            <Empty text="Importa un pack JSON de Vocabulary para empezar." />
          )}
        </div>
      </section>

      <VocabularyHistory sessions={vocab.sessions} stats={vocab.stats} packs={vocab.packs} />
    </>
  );
}

function VocabularyPrompt({ item, mode, revealed }: { item: VocabularyItem; mode: VocabularyMode; revealed: boolean }) {
  if (mode === "flashcard") {
    return (
      <div>
        <h2>{item.term}</h2>
        {revealed && (
          <div className="review-item">
            <p><strong>Meaning EN:</strong> {item.meaning_en}</p>
            <p><strong>Meaning ES:</strong> {item.meaning_es}</p>
            <p><strong>Example:</strong> {item.example}</p>
            <p><strong>Pattern:</strong> {item.pattern}</p>
          </div>
        )}
      </div>
    );
  }
  if (mode === "gap_fill" || mode === "multiple_choice") return <h2>{item.gap_sentence}</h2>;
  if (mode === "translation") return <h2>{item.meaning_es}</h2>;
  return <h2>{item.term}</h2>;
}

function VocabularyHistory({
  sessions,
  stats,
  packs,
}: {
  sessions: VocabularySession[];
  stats: VocabularyStats;
  packs: VocabularyPack[];
}) {
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(sessions.at(-1)?.id ?? null);
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [tagFilter, setTagFilter] = React.useState("all");
  const [typeFilter, setTypeFilter] = React.useState("all");
  const [difficultyFilter, setDifficultyFilter] = React.useState("all");
  if (!sessions.length) {
    return <section className="panel top-space"><h2>Historial Vocabulary</h2><Empty text="No hay sesiones de vocabulario todavía." /></section>;
  }
  const latest = sessions.at(-1);
  const selectedSession = sessions.find((session) => session.id === selectedSessionId) ?? latest ?? null;
  const selectedPack = selectedSession ? packs.find((pack) => pack.id === selectedSession.packId) ?? null : null;
  const reviewItems = selectedSession
    ? getVocabularyReviewItems(selectedSession, selectedPack).filter((item) => {
        if (statusFilter !== "all" && item.status !== statusFilter) return false;
        if (tagFilter !== "all" && !item.tags.includes(tagFilter)) return false;
        if (typeFilter !== "all" && item.type !== typeFilter) return false;
        if (difficultyFilter !== "all" && item.difficulty !== difficultyFilter) return false;
        return true;
      })
    : [];
  const reviewTags = [...new Set(selectedSession ? getVocabularyReviewItems(selectedSession, selectedPack).flatMap((item) => item.tags) : [])].sort();
  const reviewTypes = [...new Set(selectedSession ? getVocabularyReviewItems(selectedSession, selectedPack).map((item) => item.type) : [])].sort();
  const reviewDifficulties = [...new Set(selectedSession ? getVocabularyReviewItems(selectedSession, selectedPack).map((item) => item.difficulty) : [])].sort();
  return (
    <section className="panel top-space">
      <h2>Historial Vocabulary</h2>
      <div className="grid">
        <Metric value={Object.keys(stats).length} label="items practicados" />
        <Metric value={sessions.length} label="sesiones" />
        <Metric value={latest ? `${latest.summary.accuracy}%` : "-"} label="último accuracy" />
      </div>
      <div className="table-wrap top-space">
        <table>
          <thead>
            <tr><th>Fecha</th><th>Pack</th><th>Modo</th><th>Resultado</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {sessions.slice().reverse().map((session) => (
              <tr key={session.id}>
                <td>{formatDate(session.finishedAt)}</td>
                <td>{session.packTitle}</td>
                <td>{labelVocabularyMode(session.mode)}</td>
                <td>{session.summary.correct}/{session.summary.total} · {session.summary.unsure} unsure · {session.summary.accuracy}%</td>
                <td>
                  <div className="actions">
                    <button className={selectedSession?.id === session.id ? "" : "secondary"} onClick={() => setSelectedSessionId(session.id)}>
                      Ver detalle
                    </button>
                    <button className="secondary" onClick={() => downloadVocabularyJson(session)}>JSON</button>
                    <button className="secondary" onClick={() => downloadVocabularyCsv(session)}>CSV</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selectedSession && (
        <VocabularySessionDetail
          session={selectedSession}
          items={reviewItems}
          statusFilter={statusFilter}
          tagFilter={tagFilter}
          typeFilter={typeFilter}
          difficultyFilter={difficultyFilter}
          tags={reviewTags}
          types={reviewTypes}
          difficulties={reviewDifficulties}
          onStatusFilter={setStatusFilter}
          onTagFilter={setTagFilter}
          onTypeFilter={setTypeFilter}
          onDifficultyFilter={setDifficultyFilter}
        />
      )}
    </section>
  );
}

function VocabularySessionDetail({
  session,
  items,
  statusFilter,
  tagFilter,
  typeFilter,
  difficultyFilter,
  tags,
  types,
  difficulties,
  onStatusFilter,
  onTagFilter,
  onTypeFilter,
  onDifficultyFilter,
}: {
  session: VocabularySession;
  items: VocabularyReviewItem[];
  statusFilter: string;
  tagFilter: string;
  typeFilter: string;
  difficultyFilter: string;
  tags: string[];
  types: string[];
  difficulties: string[];
  onStatusFilter: (value: string) => void;
  onTagFilter: (value: string) => void;
  onTypeFilter: (value: string) => void;
  onDifficultyFilter: (value: string) => void;
}) {
  return (
    <div className="top-space">
      <h3>Detalle de sesión</h3>
      <div className="grid">
        <Metric value={formatDate(session.finishedAt)} label="fecha/hora" />
        <Metric value={session.packTitle} label="pack" />
        <Metric value={labelVocabularyMode(session.mode)} label="modo" />
        <Metric value={session.summary.total} label="items" />
        <Metric value={session.summary.correct} label="correctos" />
        <Metric value={session.summary.incorrect} label="incorrectos" />
        <Metric value={session.summary.unsure} label="unsure" />
        <Metric value={session.summary.blank} label="blank" />
        <Metric value={`${session.summary.accuracy}%`} label="accuracy" />
        <Metric value={formatDuration(session.summary.totalTimeMs)} label="tiempo total" />
        <Metric value={formatDuration(session.summary.averageTimeMs)} label="tiempo medio" />
      </div>
      <div className="split top-space">
        <SummaryTable title="Por tag" rows={session.summary.byTag} />
        <SummaryTable title="Por type" rows={session.summary.byType} />
      </div>
      <div className="filter-row top-space">
        <select value={statusFilter} onChange={(event) => onStatusFilter(event.target.value)}>
          <option value="all">All</option>
          <option value="incorrect">Incorrect</option>
          <option value="unsure">Unsure</option>
          <option value="blank">Blank</option>
          <option value="correct">Correct</option>
        </select>
        <select value={tagFilter} onChange={(event) => onTagFilter(event.target.value)}>
          <option value="all">By tag</option>
          {tags.map((tag) => <option value={tag} key={tag}>{tag}</option>)}
        </select>
        <select value={typeFilter} onChange={(event) => onTypeFilter(event.target.value)}>
          <option value="all">By type</option>
          {types.map((type) => <option value={type} key={type}>{type}</option>)}
        </select>
        <select value={difficultyFilter} onChange={(event) => onDifficultyFilter(event.target.value)}>
          <option value="all">By difficulty</option>
          {difficulties.map((difficulty) => <option value={difficulty} key={difficulty}>{difficulty}</option>)}
        </select>
      </div>
      <div className="review-list top-space">
        {items.length ? items.map((item) => <VocabularyReviewCard key={`${item.itemId}-${item.mode}-${item.timeMs}`} item={item} />) : <Empty text="No hay respuestas con esos filtros." />}
      </div>
    </div>
  );
}

function VocabularyReviewCard({ item }: { item: VocabularyReviewItem }) {
  const statusClass = item.status === "correct" ? "good" : item.status === "blank" ? "blank" : "bad";
  const open = item.status !== "correct";
  return (
    <details className="review-item" open={open}>
      <summary className="review-summary">
        <span className={`pill ${statusClass}`}>{item.status}</span>
        <strong>{item.term}</strong>
        <span className="small">{item.type} · {item.difficulty}</span>
      </summary>
      <div className="review-body">
        <p><strong>Prompt:</strong> {item.prompt}</p>
        <p><strong>Your answer:</strong> {item.userAnswer || "—"}</p>
        <p><strong>Correct answer:</strong> {item.acceptedAnswer || "—"}</p>
        <p><strong>Meaning EN:</strong> {item.meaningEn || "—"}</p>
        <p><strong>Meaning ES:</strong> {item.meaningEs || "—"}</p>
        <p><strong>Pattern:</strong> {item.pattern || "—"}</p>
        <p><strong>Example:</strong> {item.example || "—"}</p>
        <p><strong>Explanation:</strong> {item.feedback}</p>
        {!!item.commonErrors.length && (
          <div>
            <strong>Common errors:</strong>
            <ul>
              {item.commonErrors.map((error) => <li key={`${error.answer}-${error.reason}`}>{error.answer}: {error.reason}</li>)}
            </ul>
          </div>
        )}
        {!item.fullExplanationAvailable && (
          <p className="small">Full explanation is not available because the original vocabulary item could not be found.</p>
        )}
        <div className="actions">
          {item.tags.map((tag) => <span className="pill" key={tag}>{tag}</span>)}
          <span className="pill">{item.sourceOrigin || "unknown source"}</span>
        </div>
      </div>
    </details>
  );
}

function SummaryTable({
  title,
  rows,
}: {
  title: string;
  rows: Record<string, { total: number; correct: number; incorrect: number; unsure: number; blank: number; accuracy: number }>;
}) {
  return (
    <div>
      <h3>{title}</h3>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Grupo</th><th>Total</th><th>Correct</th><th>Incorrect</th><th>Unsure</th><th>Accuracy</th></tr></thead>
          <tbody>
            {Object.entries(rows).map(([key, row]) => (
              <tr key={key}><td>{key}</td><td>{row.total}</td><td>{row.correct}</td><td>{row.incorrect}</td><td>{row.unsure}</td><td>{row.accuracy}%</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RepeatPanel({
  tags,
  parts,
  types,
  onStart,
}: {
  tags: string[];
  parts: number[];
  types: QuestionType[];
  onStart: (mode: string, value: string) => void;
}) {
  const [mode, setMode] = React.useState("last");
  const [value, setValue] = React.useState(tags[0] ?? "");
  React.useEffect(() => {
    const options = getRepeatOptions(mode, tags, parts, types);
    if (!options.includes(value)) setValue(options[0] ?? "");
  }, [mode, value, tags, parts, types]);
  const options = getRepeatOptions(mode, tags, parts, types);
  return (
    <div className="panel">
      <h2>Crear repetición</h2>
      <div className="filter-row">
        <select value={mode} onChange={(event) => setMode(event.target.value)}>
          <option value="last">Falladas en la última sesión</option>
          <option value="historical">Falladas históricamente</option>
          <option value="twice">Falladas más de una vez</option>
          <option value="failed_part">Falladas por part</option>
          <option value="failed_type">Falladas por type</option>
          <option value="tag">Preguntas de un tag concreto</option>
        </select>
        <select value={value} disabled={!options.length || ["last", "historical", "twice"].includes(mode)} onChange={(event) => setValue(event.target.value)}>
          {options.map((item) => (
            <option value={item} key={item}>
              {mode === "failed_type" ? labelQuestionType(item) : mode === "failed_part" ? `Part ${item}` : item}
            </option>
          ))}
        </select>
        <button onClick={() => onStart(mode, value)}>Crear sesión</button>
      </div>
    </div>
  );
}

function getRepeatOptions(mode: string, tags: string[], parts: number[], types: QuestionType[]) {
  if (mode === "failed_part") return parts.map(String);
  if (mode === "failed_type") return types;
  if (mode === "tag") return tags;
  return [""];
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
    const q = normalizeQuestion(item as Question);
    const prefix = `Pregunta ${index + 1}${q?.id ? ` (${q.id})` : ""}:`;
    ["id", "part", "type", "tags", "question", "answers", "explanation"].forEach((field) => {
      const value = getPath(q, field);
      if (value === undefined || value === null || value === "") errors.push(`${prefix} falta ${field}.`);
    });
    if (!QUESTION_TYPES.includes(q.type)) errors.push(`${prefix} type no soportado: ${q.type}.`);
    if (!Array.isArray(q?.tags)) errors.push(`${prefix} tags debe ser un array.`);
    if (!Array.isArray(q?.answers) || !q.answers.length) errors.push(`${prefix} answers debe tener al menos una respuesta.`);
    if (q?.alternative_answers && !Array.isArray(q.alternative_answers)) errors.push(`${prefix} alternative_answers debe ser un array si existe.`);
    validateQuestionByType(q, prefix, errors);
    if (q?.id && ids.has(q.id)) errors.push(`${prefix} id duplicado.`);
    if (q?.id) ids.add(q.id);
  });
  if (errors.length) return { ok: false, errors, questions: [] };
  return {
    ok: true,
    errors: [],
    questions: (questions as Question[]).map((rawQuestion) => {
      const question = normalizeQuestion(rawQuestion);
      return {
      exam: question.exam || "C1 Advanced",
      paper: question.paper || "Use of English",
      skill: question.skill || question.type,
      difficulty: question.difficulty || "medium",
      common_errors: Array.isArray(question.common_errors) ? question.common_errors : [],
      alternative_answers: Array.isArray(question.alternative_answers) ? question.alternative_answers : [],
      ...question,
      part: Number(question.part),
      tags: question.tags.map(String),
      answers: question.answers.map(String),
      question: {
        ...question.question,
        word_limit_min: Number(question.question.word_limit_min ?? defaultWordLimit(question).min),
        word_limit_max: Number(question.question.word_limit_max ?? defaultWordLimit(question).max),
      },
    };
    }),
  };
}

function validateQuestionByType(q: Question, prefix: string, errors: string[]) {
  if (q.type === "multiple_choice_cloze") {
    ["text_before", "text_after", "options"].forEach((field) => {
      if (getPath(q.question, field) === undefined || getPath(q.question, field) === "") errors.push(`${prefix} falta question.${field}.`);
    });
    const options = q.question.options ?? [];
    if (!Array.isArray(options) || options.length < 4) errors.push(`${prefix} question.options debe tener al menos 4 opciones.`);
    options.forEach((option, index) => {
      if (!option.key || !option.text) errors.push(`${prefix} option ${index + 1} debe tener key y text.`);
    });
    const optionKeys = new Set(options.map((option) => option.key));
    q.answers.forEach((answer) => {
      if (!optionKeys.has(answer)) errors.push(`${prefix} answers contiene una key que no existe en options: ${answer}.`);
    });
    return;
  }
  if (q.type === "open_cloze") {
    ["text_before", "text_after"].forEach((field) => {
      if (getPath(q.question, field) === undefined || getPath(q.question, field) === "") errors.push(`${prefix} falta question.${field}.`);
    });
    return;
  }
  if (q.type === "word_formation") {
    ["text_before", "text_after", "base_word"].forEach((field) => {
      if (getPath(q.question, field) === undefined || getPath(q.question, field) === "") errors.push(`${prefix} falta question.${field}.`);
    });
    return;
  }
  ["first_sentence", "keyword", "second_sentence", "word_limit_min", "word_limit_max"].forEach((field) => {
    if (getPath(q.question, field) === undefined || getPath(q.question, field) === "") errors.push(`${prefix} falta question.${field}.`);
  });
  const min = Number(q.question.word_limit_min);
  const max = Number(q.question.word_limit_max);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min) {
    errors.push(`${prefix} word_limit_min y word_limit_max deben ser enteros válidos.`);
  }
}

function makeTestPack({
  questions,
  title,
  sourceName,
  importedAt,
  id,
}: {
  questions: Question[];
  title: string;
  sourceName: string;
  importedAt: string;
  id?: string | null;
}): TestPack {
  const testId = id ? slugify(id) : makeTestId(title, questions);
  return {
    id: testId,
    title,
    sourceName,
    importedAt,
    questions,
    preview: makeImportPreview(questions, title, sourceName, importedAt, []),
  };
}

function makeImportPreview(
  questions: Question[],
  title: string,
  name: string,
  importedAt: string,
  validationErrors: string[],
): ImportPreview {
  return {
    testId: makeTestId(title, questions),
    title,
    name,
    total: questions.length,
    parts: [...new Set(questions.map((question) => question.part))].sort((a, b) => a - b),
    types: [...new Set(questions.map((question) => question.type))].sort(),
    partCounts: countBy(questions, (question) => `Part ${question.part} — ${labelQuestionType(question.type)}`),
    typeCounts: countBy(questions, (question) => labelQuestionType(question.type)),
    tags: [...new Set(questions.flatMap((question) => question.tags))].sort((a, b) => a.localeCompare(b)),
    difficulties: [...new Set(questions.map((question) => question.difficulty).filter(Boolean) as string[])].sort((a, b) =>
      a.localeCompare(b),
    ),
    importedAt,
    validationErrors,
  };
}

function normalizeImportPreview(
  preview: ImportPreview | null | undefined,
  questions: Question[],
  title: string,
  name: string,
  importedAt: string,
): ImportPreview {
  if (!preview) return makeImportPreview(questions, title, name, importedAt, []);
  return {
    ...preview,
    title: preview.title ?? title,
    name: preview.name ?? name,
    total: preview.total ?? questions.length,
    parts: preview.parts ?? [...new Set(questions.map((question) => question.part))].sort((a, b) => a - b),
    types: preview.types ?? [...new Set(questions.map((question) => question.type))].sort(),
    partCounts: preview.partCounts ?? countBy(questions, (question) => `Part ${question.part} — ${labelQuestionType(question.type)}`),
    typeCounts: preview.typeCounts ?? countBy(questions, (question) => labelQuestionType(question.type)),
    tags: preview.tags ?? [...new Set(questions.flatMap((question) => question.tags))].sort((a, b) => a.localeCompare(b)),
    difficulties: preview.difficulties ?? [],
    importedAt: preview.importedAt ?? importedAt,
    validationErrors: preview.validationErrors ?? [],
  };
}

function normalizeQuestion(question: Question): Question {
  const type = (question.type ?? (Number(question.part) === 4 ? "key_word_transformation" : "")) as QuestionType;
  return {
    ...question,
    type,
    part: Number(question.part),
    question: {
      ...(question.question ?? {}),
      word_limit_min: Number(question.question?.word_limit_min ?? defaultWordLimit({ ...question, type }).min),
      word_limit_max: Number(question.question?.word_limit_max ?? defaultWordLimit({ ...question, type }).max),
    },
  };
}

function defaultWordLimit(question: Pick<Question, "type">) {
  if (question.type === "key_word_transformation") return { min: 3, max: 6 };
  return { min: 1, max: 1 };
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getKey(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function normalizeSummary(summary: Summary | undefined, results: Result[]): Summary {
  const fallback = summarizeResults(results, 0, results.reduce((sum, result) => sum + result.timeMs, 0));
  return {
    ...fallback,
    ...(summary ?? {}),
    byPart: summary?.byPart ?? fallback.byPart,
    byType: summary?.byType ?? fallback.byType,
  };
}

function getQuestionsFromTests(tests: TestPack[]) {
  const byCompositeId = new Map<string, Question>();
  tests.forEach((test) => {
    test.questions.forEach((question) => {
      byCompositeId.set(`${test.id}:${question.id}`, question);
    });
  });
  return [...byCompositeId.values()];
}

function getTestMetadata(data: unknown, fallback: string) {
  const root = data as { test_id?: unknown; title?: unknown; name?: unknown };
  const titleRaw = root?.title ?? root?.name ?? root?.test_id ?? fallback;
  const title = String(titleRaw || fallback).replace(/\.json$/i, "").trim() || "Imported test";
  return {
    id: root?.test_id ? String(root.test_id) : null,
    title,
  };
}

function filterUseOfEnglishQuestions(questions: Question[], filters: { part: string; type: string; tag: string }) {
  return questions.filter((question) => {
    if (filters.part !== "all" && question.part !== Number(filters.part)) return false;
    if (filters.type !== "all" && question.type !== filters.type) return false;
    if (filters.tag !== "all" && !question.tags.includes(filters.tag)) return false;
    return true;
  });
}

function labelQuestionType(type: QuestionType | string) {
  return {
    multiple_choice_cloze: "Multiple Choice Cloze",
    open_cloze: "Open Cloze",
    word_formation: "Word Formation",
    key_word_transformation: "Key Word Transformations",
  }[type] ?? type;
}

function getQuestionInstruction(question: Question) {
  if (question.type === "multiple_choice_cloze") return "Choose the option A, B, C or D which best completes the sentence.";
  if (question.type === "open_cloze") return "Write the word which best fits the gap. Do not show answers until the exam is finished.";
  if (question.type === "word_formation") return "Use the word given in capitals to form a word that fits the gap.";
  return `Complete the second sentence so that it has a similar meaning to the first sentence, using the word given. Do not change the word given. You must use between ${question.question.word_limit_min} and ${question.question.word_limit_max} words.`;
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

function loadVocabularyState(): VocabularyState {
  try {
    const raw = localStorage.getItem(VOCAB_STORAGE_KEY);
    if (!raw) return { packs: [], sessions: [], stats: {}, statsByTag: {}, statsByType: {} };
    const parsed = JSON.parse(raw) as Partial<VocabularyState>;
    return {
      packs: Array.isArray(parsed.packs) ? parsed.packs : [],
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions.map(normalizeVocabularySession) : [],
      stats: parsed.stats ?? {},
      statsByTag: parsed.statsByTag ?? {},
      statsByType: parsed.statsByType ?? {},
    };
  } catch {
    return { packs: [], sessions: [], stats: {}, statsByTag: {}, statsByType: {} };
  }
}

function normalizeVocabularySession(session: VocabularySession): VocabularySession {
  const responses = Array.isArray(session.responses)
    ? session.responses.map((response) => ({
        ...response,
        itemId: getResponseItemId(response),
        type: getResponseType(response) as VocabularyItemType,
        term: getResponseTerm(response),
        tags: getResponseTags(response),
        difficulty: getResponseDifficulty(response),
        sourceOrigin: getResponseSourceOrigin(response),
        meaningEn: getResponseMeaningEn(response),
        meaningEs: getResponseMeaningEs(response),
        example: getResponseExample(response),
        pattern: getResponsePattern(response),
        commonErrors: getResponseCommonErrors(response),
        feedback: getResponseFeedback(response),
      }))
    : [];
  const normalized = {
    ...session,
    responses,
    module: "vocabulary" as const,
  };
  return {
    ...normalized,
    resultJson: makeVocabularySessionJson(normalized),
  };
}

function validateVocabularyPack(data: unknown, fallbackName: string): { ok: true; pack: VocabularyPack } | { ok: false; errors: string[] } {
  const root = data as { metadata?: Record<string, unknown>; items?: unknown };
  const errors: string[] = [];
  if (!root || typeof root !== "object") return { ok: false, errors: ["El JSON de Vocabulary debe ser un objeto."] };
  if (!Array.isArray(root.items)) return { ok: false, errors: ["Falta items o no es un array."] };
  root.items.forEach((raw, index) => {
    const item = raw as Partial<VocabularyItem>;
    const prefix = `Item ${index + 1}${item.id ? ` (${item.id})` : ""}:`;
    VOCAB_REQUIRED_FIELDS.forEach((field) => {
      const value = getPath(item, field);
      if (value === undefined || value === null || value === "") errors.push(`${prefix} falta ${field}.`);
    });
    if (item.type && !VOCAB_ALLOWED_TYPES.includes(item.type)) errors.push(`${prefix} type no permitido: ${item.type}.`);
    if (item.tags && !Array.isArray(item.tags)) errors.push(`${prefix} tags debe ser un array.`);
  });
  if (errors.length) return { ok: false, errors };
  const metadata = root.metadata ?? {};
  const title = String(metadata.title ?? fallbackName.replace(/\.json$/i, "") ?? "Vocabulary pack");
  const id = slugify(String(metadata.title ?? fallbackName.replace(/\.json$/i, "")));
  return {
    ok: true,
    pack: {
      id,
      title,
      metadata,
      importedAt: new Date().toISOString(),
      items: (root.items as VocabularyItem[]).map((item) => ({
        ...item,
        tags: item.tags.map(String),
        common_errors: Array.isArray(item.common_errors) ? item.common_errors : [],
        accepted_answers: Array.isArray(item.accepted_answers) ? item.accepted_answers : [],
        distractors: Array.isArray(item.distractors) ? item.distractors : [],
      })),
    },
  };
}

function resolveVocabularyMode(mode: VocabularyMode, index: number): VocabularyMode {
  if (mode !== "mixed_review") return mode;
  return (["flashcard", "gap_fill", "multiple_choice", "translation"] as VocabularyMode[])[index % 4];
}

function getVocabularyPrompt(item: VocabularyItem, mode: VocabularyMode) {
  if (mode === "flashcard") return item.term;
  if (mode === "gap_fill" || mode === "multiple_choice") return item.gap_sentence;
  if (mode === "translation") return item.meaning_es;
  return item.term;
}

function getVocabularyAcceptedAnswer(item: VocabularyItem, mode: VocabularyMode) {
  if (mode === "gap_fill" || mode === "multiple_choice") return item.gap_answer;
  if (mode === "translation") return item.term;
  return item.term;
}

function gradeVocabularyAnswer(item: VocabularyItem, mode: VocabularyMode, answer: string): VocabularyResponse["status"] {
  if (!normalizeAnswer(answer)) return "blank";
  const accepted = getVocabularyAcceptedAnswers(item, mode).map(normalizeAnswer);
  return accepted.includes(normalizeAnswer(answer)) ? "correct" : "incorrect";
}

function makeVocabularyOptions(items: VocabularyItem[], item: VocabularyItem) {
  const correct = item.gap_answer;
  const explicitDistractors = item.distractors ?? [];
  const distractors = explicitDistractors.length ? explicitDistractors : shuffle(
    items
      .filter((candidate) => candidate.id !== item.id && (candidate.type === item.type || candidate.tags.some((tag) => item.tags.includes(tag))))
      .map((candidate) => candidate.gap_answer)
      .filter((answer) => normalizeAnswer(answer) !== normalizeAnswer(correct)),
  );
  return shuffle([correct, ...Array.from(new Set(distractors)).slice(0, 3)]);
}

function getVocabularyAcceptedAnswers(item: VocabularyItem, mode: VocabularyMode) {
  const primary = getVocabularyAcceptedAnswer(item, mode);
  if (mode === "gap_fill" || mode === "multiple_choice") return [primary, ...(item.accepted_answers ?? [])];
  if (mode === "translation") return [primary, ...(item.accepted_answers ?? [])];
  return [primary];
}

function makeVocabularyResponse(
  item: VocabularyItem,
  mode: VocabularyMode,
  userAnswer: string,
  status: VocabularyResponse["status"],
  timeMs: number,
): VocabularyResponse {
  const feedback = makeVocabularyFeedback(item, mode);
  return {
    item,
    itemId: item.id,
    type: item.type,
    term: item.term,
    mode,
    prompt: getVocabularyPrompt(item, mode),
    userAnswer,
    acceptedAnswer: getVocabularyAcceptedAnswer(item, mode),
    status,
    timeMs,
    tags: item.tags,
    difficulty: item.difficulty,
    sourceOrigin: item.source_origin,
    meaningEn: item.meaning_en,
    meaningEs: item.meaning_es,
    example: item.example,
    pattern: item.pattern,
    explanation: item.explanation,
    commonErrors: item.common_errors ?? [],
    feedback,
  };
}

function makeVocabularyFeedback(item: VocabularyItem, mode: VocabularyMode) {
  if (item.explanation) return item.explanation;
  const accepted = getVocabularyAcceptedAnswer(item, mode);
  const base =
    mode === "translation"
      ? `Expected term: "${accepted}". This means "${item.meaning_en}" (${item.meaning_es}).`
      : `Expected answer: "${accepted}". "${item.term}" means "${item.meaning_en}" (${item.meaning_es}).`;
  const pattern = item.pattern ? ` Pattern: ${item.pattern}.` : "";
  const example = item.example ? ` Example: ${item.example}` : "";
  const common =
    item.common_errors?.length
      ? ` Common errors: ${item.common_errors.map((error) => `${error.answer} (${error.reason})`).join("; ")}.`
      : " Use the fixed pattern shown above and check the exact form.";
  return `${base}${pattern}${example}${common}`;
}

function summarizeVocabulary(responses: VocabularyResponse[], startedAt: number, finishedAt: number): VocabularySummary {
  const total = responses.length;
  const correct = responses.filter((response) => response.status === "correct").length;
  const incorrect = responses.filter((response) => response.status === "incorrect").length;
  const unsure = responses.filter((response) => response.status === "unsure").length;
  const blank = responses.filter((response) => response.status === "blank").length;
  const byTag: VocabularySummary["byTag"] = {};
  const byType: VocabularySummary["byType"] = {};
  responses.forEach((response) => {
    getResponseTags(response).forEach((tag) => addVocabularyBucket(byTag, tag, response.status));
    addVocabularyBucket(byType, getResponseType(response), response.status);
  });
  finalizeVocabularyBuckets(byTag);
  finalizeVocabularyBuckets(byType);
  return {
    total,
    correct,
    incorrect,
    unsure,
    blank,
    accuracy: total ? Math.round((correct / total) * 1000) / 10 : 0,
    totalTimeMs: finishedAt - startedAt,
    averageTimeMs: total ? Math.round(responses.reduce((sum, response) => sum + response.timeMs, 0) / total) : 0,
    byTag,
    byType,
  };
}

function addVocabularyBucket(
  buckets: VocabularySummary["byTag"],
  key: string,
  status: VocabularyResponse["status"],
) {
  buckets[key] ||= { total: 0, correct: 0, incorrect: 0, unsure: 0, blank: 0, accuracy: 0 };
  buckets[key].total += 1;
  buckets[key][status] += 1;
}

function finalizeVocabularyBuckets(buckets: VocabularySummary["byTag"]) {
  Object.values(buckets).forEach((bucket) => {
    bucket.accuracy = bucket.total ? Math.round((bucket.correct / bucket.total) * 1000) / 10 : 0;
  });
}

function makeVocabularySessionJson(session: Omit<VocabularySession, "resultJson"> | VocabularySession): VocabularySessionJson {
  return {
    session_id: session.id,
    student: session.student,
    exam: session.exam,
    module: "vocabulary",
    pack_id: session.packId,
    mode: session.mode,
    started_at: session.startedAt,
    finished_at: session.finishedAt,
    total_items: session.summary.total,
    correct: session.summary.correct,
    incorrect: session.summary.incorrect,
    unsure: session.summary.unsure,
    blank: session.summary.blank,
    accuracy: session.summary.accuracy,
    by_tag: session.summary.byTag,
    by_type: session.summary.byType,
    responses: session.responses.map((response) => ({
      item_id: getResponseItemId(response),
      type: getResponseType(response) as VocabularyItemType,
      term: getResponseTerm(response),
      mode: response.mode,
      prompt: response.prompt,
      user_answer: response.userAnswer,
      accepted_answer: response.acceptedAnswer,
      status: response.status,
      time_ms: response.timeMs,
      tags: getResponseTags(response),
      difficulty: getResponseDifficulty(response),
      source_origin: getResponseSourceOrigin(response),
      meaning_en: getResponseMeaningEn(response),
      meaning_es: getResponseMeaningEs(response),
      example: getResponseExample(response),
      pattern: getResponsePattern(response),
      feedback: getResponseFeedback(response),
      common_errors: getResponseCommonErrors(response),
    })),
  };
}

function getVocabularyReviewItems(session: VocabularySession, pack: VocabularyPack | null): VocabularyReviewItem[] {
  return session.responses
    .map((response) => {
      const sourceItem = response.item ?? pack?.items.find((item) => item.id === getResponseItemId(response));
      const fallbackFeedback = sourceItem
        ? makeVocabularyFeedback(sourceItem, response.mode)
        : "Full explanation is not available because the original vocabulary item could not be found.";
      return {
        itemId: getResponseItemId(response),
        type: sourceItem?.type ?? getResponseType(response),
        term: sourceItem?.term ?? getResponseTerm(response),
        mode: response.mode,
        prompt: response.prompt,
        userAnswer: response.userAnswer,
        acceptedAnswer: response.acceptedAnswer,
        status: response.status,
        timeMs: response.timeMs,
        tags: sourceItem?.tags ?? getResponseTags(response),
        difficulty: sourceItem?.difficulty ?? getResponseDifficulty(response),
        sourceOrigin: sourceItem?.source_origin ?? getResponseSourceOrigin(response),
        meaningEn: sourceItem?.meaning_en ?? getResponseMeaningEn(response),
        meaningEs: sourceItem?.meaning_es ?? getResponseMeaningEs(response),
        example: sourceItem?.example ?? getResponseExample(response),
        pattern: sourceItem?.pattern ?? getResponsePattern(response),
        feedback: response.feedback || sourceItem?.explanation || fallbackFeedback,
        commonErrors: response.commonErrors ?? sourceItem?.common_errors ?? getResponseCommonErrors(response),
        fullExplanationAvailable: Boolean(sourceItem || response.feedback || getResponseMeaningEn(response) || getResponsePattern(response)),
      };
    })
    .sort((a, b) => statusPriority(a.status) - statusPriority(b.status));
}

function statusPriority(status: VocabularyResponse["status"]) {
  return { incorrect: 0, unsure: 1, blank: 2, correct: 3 }[status];
}

function getResponseItemId(response: VocabularyResponse) {
  return response.itemId ?? response.item?.id ?? "unknown_item";
}

function getResponseType(response: VocabularyResponse) {
  return response.type ?? response.item?.type ?? "word";
}

function getResponseTerm(response: VocabularyResponse) {
  return response.term ?? response.item?.term ?? "Unknown term";
}

function getResponseTags(response: VocabularyResponse) {
  return response.tags ?? response.item?.tags ?? [];
}

function getResponseDifficulty(response: VocabularyResponse) {
  return response.difficulty ?? response.item?.difficulty ?? "unknown";
}

function getResponseSourceOrigin(response: VocabularyResponse) {
  return response.sourceOrigin ?? response.item?.source_origin ?? "unknown";
}

function getResponseMeaningEn(response: VocabularyResponse) {
  return response.meaningEn ?? response.item?.meaning_en ?? "";
}

function getResponseMeaningEs(response: VocabularyResponse) {
  return response.meaningEs ?? response.item?.meaning_es ?? "";
}

function getResponseExample(response: VocabularyResponse) {
  return response.example ?? response.item?.example ?? "";
}

function getResponsePattern(response: VocabularyResponse) {
  return response.pattern ?? response.item?.pattern ?? "";
}

function getResponseCommonErrors(response: VocabularyResponse) {
  return response.commonErrors ?? response.item?.common_errors ?? [];
}

function getResponseFeedback(response: VocabularyResponse) {
  return response.feedback ?? response.item?.explanation ?? "";
}

function updateVocabularyStats(stats: VocabularyStats, responses: VocabularyResponse[], finishedAt: string) {
  const next = { ...stats };
  responses.forEach((response) => {
    const itemId = getResponseItemId(response);
    const current = next[itemId] ?? { attempts: 0, correct: 0, incorrect: 0, unsure: 0, lastAttemptAt: finishedAt };
    next[itemId] = {
      attempts: current.attempts + 1,
      correct: current.correct + (response.status === "correct" ? 1 : 0),
      incorrect: current.incorrect + (response.status === "incorrect" || response.status === "blank" ? 1 : 0),
      unsure: current.unsure + (response.status === "unsure" ? 1 : 0),
      lastAttemptAt: finishedAt,
    };
  });
  return next;
}

function updateVocabularyAggregateStats(
  stats: VocabularyAggregateStats | undefined,
  responses: VocabularyResponse[],
  dimension: "tag" | "type",
) {
  const next: VocabularyAggregateStats = { ...(stats ?? {}) };
  responses.forEach((response) => {
    const keys = dimension === "tag" ? getResponseTags(response) : [getResponseType(response)];
    keys.forEach((key) => {
      const current = next[key] ?? { attempts: 0, correct: 0, incorrect: 0, unsure: 0 };
      next[key] = {
        attempts: current.attempts + 1,
        correct: current.correct + (response.status === "correct" ? 1 : 0),
        incorrect: current.incorrect + (response.status === "incorrect" || response.status === "blank" ? 1 : 0),
        unsure: current.unsure + (response.status === "unsure" ? 1 : 0),
      };
    });
  });
  return next;
}

function downloadVocabularyJson(session: VocabularySession) {
  downloadFile(`joel-c1-vocabulary-session-${session.finishedAt.replace(/[-:]/g, "-").replace("T", "-").slice(0, 16)}.json`, JSON.stringify(session.resultJson, null, 2), "application/json");
}

function downloadVocabularyCsv(session: VocabularySession) {
  const header = ["session_id", "pack_id", "mode", "item_id", "type", "term", "status", "user_answer", "accepted_answer", "time_ms", "tags", "difficulty", "source_origin", "feedback"];
  const rows = session.responses.map((response) => [
    session.id,
    session.packId,
    response.mode,
    getResponseItemId(response),
    getResponseType(response),
    getResponseTerm(response),
    response.status,
    response.userAnswer,
    response.acceptedAnswer,
    response.timeMs,
    getResponseTags(response).join(" | "),
    getResponseDifficulty(response),
    getResponseSourceOrigin(response),
    getResponseFeedback(response),
  ]);
  downloadFile(`joel-c1-vocabulary-session-${session.finishedAt.replace(/[-:]/g, "-").replace("T", "-").slice(0, 16)}.csv`, [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n"), "text/csv");
}

function labelVocabularyMode(mode: VocabularyMode) {
  return {
    flashcard: "Flashcard",
    gap_fill: "Gap fill",
    multiple_choice: "Multiple choice",
    translation: "Translation recall",
    mixed_review: "Mixed review",
  }[mode];
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
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
  const wordLimitOk = wordCount >= Number(question.question.word_limit_min ?? 1) && wordCount <= Number(question.question.word_limit_max ?? 1);
  const keywordOk = question.type === "key_word_transformation" ? normalizedAnswer.includes(normalizeAnswer(question.question.keyword ?? "")) : true;
  const blank = !normalizedAnswer;
  const answerMatch = question.type === "multiple_choice_cloze" ? question.answers.includes(answer) : normalizedAccepted.includes(normalizedAnswer);
  const correct = !blank && wordLimitOk && keywordOk && answerMatch;
  const selectedOption = question.question.options?.find((option) => option.key === answer);
  const correctOption = question.question.options?.find((option) => option.key === question.answers[0]);
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
    selectedOptionText: selectedOption?.text,
    correctOptionText: correctOption?.text,
  };
}

function summarizeResults(results: Result[], startedAt: number, finishedAt: number): Summary {
  const total = results.length;
  const correct = results.filter((result) => result.status === "correct").length;
  const blank = results.filter((result) => result.status === "blank").length;
  const incorrect = total - correct - blank;
  const byTag: Summary["byTag"] = {};
  const byPart: Summary["byPart"] = {};
  const byType: Summary["byType"] = {};
  results.forEach((result) => {
    result.question.tags.forEach((tag) => {
      byTag[tag] ||= { total: 0, correct: 0, incorrect: 0, blank: 0 };
      byTag[tag].total += 1;
      byTag[tag][result.status] += 1;
    });
    const partKey = String(result.question.part);
    byPart[partKey] ||= { total: 0, correct: 0, incorrect: 0, blank: 0, timeMs: 0 };
    byPart[partKey].total += 1;
    byPart[partKey][result.status] += 1;
    byPart[partKey].timeMs += result.timeMs;
    const typeKey = result.question.type;
    byType[typeKey] ||= { total: 0, correct: 0, incorrect: 0, blank: 0, timeMs: 0 };
    byType[typeKey].total += 1;
    byType[typeKey][result.status] += 1;
    byType[typeKey].timeMs += result.timeMs;
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
    byPart,
    byType,
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
    tag_summary: Object.entries(session.summary.byTag).map(([tag, item]) => ({
      tag,
      total: item.total,
      correct: item.correct,
      incorrect: item.incorrect,
      blank: item.blank,
      accuracy: item.total ? Math.round((item.correct / item.total) * 1000) / 10 : 0,
    })),
    part_summary: Object.entries(session.summary.byPart).map(([part, item]) => ({
      part: Number(part),
      total: item.total,
      correct: item.correct,
      incorrect: item.incorrect,
      blank: item.blank,
      accuracy: item.total ? Math.round((item.correct / item.total) * 1000) / 10 : 0,
      average_time_seconds: item.total ? Math.round(item.timeMs / item.total / 1000) : 0,
    })),
    type_summary: Object.entries(session.summary.byType).map(([type, item]) => ({
      type,
      total: item.total,
      correct: item.correct,
      incorrect: item.incorrect,
      blank: item.blank,
      accuracy: item.total ? Math.round((item.correct / item.total) * 1000) / 10 : 0,
      average_time_seconds: item.total ? Math.round(item.timeMs / item.total / 1000) : 0,
    })),
    responses: session.results.map((result) => ({
      question_id: result.question.id,
      part: result.question.part,
      type: result.question.type,
      skill: result.question.skill,
      joel_answer: result.answer,
      accepted_answers: result.acceptedAnswers,
      alternative_answers: result.question.alternative_answers ?? [],
      status: result.status,
      correct: result.status === "correct",
      word_count: result.wordCount,
      within_word_limit: result.wordLimitOk,
      used_keyword: result.question.type === "key_word_transformation" ? result.keywordOk : undefined,
      answer_match: result.answerMatch,
      time_spent_seconds: Math.round(result.timeMs / 1000),
      marked_for_review: result.marked,
      tags: result.question.tags,
      selected_option_key: result.question.type === "multiple_choice_cloze" ? result.answer : undefined,
      selected_option_text: result.selectedOptionText,
      correct_option_key: result.question.type === "multiple_choice_cloze" ? result.question.answers[0] : undefined,
      correct_option_text: result.correctOptionText,
      options: result.question.type === "multiple_choice_cloze" ? result.question.question.options : undefined,
      base_word: result.question.type === "word_formation" ? result.question.question.base_word : undefined,
      first_sentence: result.question.type === "key_word_transformation" ? result.question.question.first_sentence : undefined,
      keyword: result.question.type === "key_word_transformation" ? result.question.question.keyword : undefined,
      second_sentence: result.question.type === "key_word_transformation" ? result.question.question.second_sentence : undefined,
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
  return getQuestionsForSession(store, latest).filter((question) => ids.has(question.id));
}

function getHistoricallyFailedQuestions(store: StoreState, minFailures: number) {
  return getQuestionsFromTests(store.tests).filter((question) => getFailureCount(store, question.id) >= minFailures);
}

function getFailedQuestionsFromSession(store: StoreState, session: Session) {
  const ids = new Set(getFailedResults(session).map((result) => result.question.id));
  return getQuestionsForSession(store, session).filter((question) => ids.has(question.id));
}

function getQuestionsForSession(store: StoreState, session: Session) {
  const test = store.tests.find((item) => item.id === session.testId);
  if (test) return test.questions;
  return getQuestionsFromTests(store.tests);
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
  const header = ["session_id", "finished_at", "question_id", "part", "type", "status", "answer", "accepted_answers", "word_count", "word_limit_ok", "keyword_ok", "time_ms", "tags"];
  const rows = store.sessions.flatMap((session) =>
    session.results.map((result) => [
      session.id,
      session.finishedAt,
      result.question.id,
      result.question.part,
      result.question.type,
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
    "part",
    "type",
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
      result.question.part,
      result.question.type,
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
  return {
    home: "Use of English",
    import: "Importar JSON",
    sessions: "Sesiones",
    review: "Revisión",
    charts: "Gráficas",
    vocabulary: "Vocabulary",
  }[view] ?? view;
}

createRoot(document.getElementById("app")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
