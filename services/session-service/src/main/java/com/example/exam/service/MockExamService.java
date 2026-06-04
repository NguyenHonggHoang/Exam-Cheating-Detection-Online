package com.example.exam.service;

import com.example.exam.dto.MockExamDto;
import com.example.exam.model.ExamSessionState;
import com.example.exam.model.Question;
import com.example.exam.model.Session;
import com.example.exam.model.SessionStatus;
import com.example.exam.repository.ExamRepository;
import com.example.exam.repository.ExamSessionStateRepository;
import com.example.exam.repository.QuestionRepository;
import com.example.exam.repository.SessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class MockExamService {

    private static final Logger log = LoggerFactory.getLogger(MockExamService.class);

    /**
     * Thread-safe in-memory cache for full question sets.
     * Key = examId, Value = full paged response (all questions, no filter).
     *
     * Only populated by {@link #getQuestions(UUID)} (no-pagination variant).
     * Invalidated on application restart; suitable for stable exam question banks.
     */
    private final Map<UUID, MockExamDto.GetQuestionsResponse> questionsCache = new ConcurrentHashMap<>();

    private final SessionRepository sessionRepository;
    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final ExamSessionStateRepository stateRepository;
    private final WebSocketNotificationService wsNotificationService;
    private final SubmissionBatchWriteService submissionBatchWriteService;

    public MockExamService(SessionRepository sessionRepository, ExamRepository examRepository,
                           QuestionRepository questionRepository,
                           ExamSessionStateRepository stateRepository,
                           WebSocketNotificationService wsNotificationService,
                           SubmissionBatchWriteService submissionBatchWriteService) {
        this.sessionRepository = sessionRepository;
        this.examRepository = examRepository;
        this.questionRepository = questionRepository;
        this.stateRepository = stateRepository;
        this.wsNotificationService = wsNotificationService;
        this.submissionBatchWriteService = submissionBatchWriteService;
    }

    // ===========================================================================
    //  SESSION
    // ===========================================================================

    /**
     * Start a mock exam session.
     */
    @Transactional
    public MockExamDto.StartSessionResponse startSession(MockExamDto.StartSessionRequest request) {
        var exam = examRepository.findById(request.examId())
                .orElseThrow(() -> new IllegalArgumentException("Exam not found: " + request.examId()));

        // Create new session
        Session session = new Session();
        session.setExamId(request.examId());
        session.setUserId(request.userId());
        session.setStartedAt(Instant.now());
        session.setStatus(SessionStatus.ACTIVE);

        session = sessionRepository.save(session);

        // Get duration from exam, fallback to 45 minutes if not set
        int durationMinutes = exam.getDurationMinutes() != null ? exam.getDurationMinutes() : 45;

        log.info("Started exam session {} for user {} and exam {}",
                session.getId(), request.userId(), request.examId());

        // Notify proctor dashboard about new session
        wsNotificationService.notifySessionStarted(
                request.examId(),
                session.getId(),
                request.userId(),
                session.getStatus().name()
        );

        return new MockExamDto.StartSessionResponse(
                session.getId(),
                request.examId(),
                exam.getName(),
                durationMinutes,
                session.getStartedAt()
        );
    }

    // ===========================================================================
    //  QUESTION LOADING — full (cached) + paginated
    // ===========================================================================

    /**
     * Get ALL questions for an exam from database (thread-safe in-memory cache).
     *
     * <p>Suitable for exams with small-to-medium question banks (up to a few hundred
     * questions). The cache is keyed by {@code examId} and lives for the lifetime of
     * the JVM (i.e., it is invalidated on restart, not on question updates).
     *
     * <p>For very large question banks (500+ questions per exam), prefer
     * {@link #getQuestionsPaged(UUID, int, int)} to avoid loading everything into
     * memory on first call.
     *
     * @param examId the exam whose questions to fetch
     * @return full question set (no correct answers sent to students)
     */
    public MockExamDto.GetQuestionsResponse getQuestions(UUID examId) {
        return questionsCache.computeIfAbsent(examId, id -> {
            var exam = examRepository.findById(id)
                    .orElseThrow(() -> new IllegalArgumentException("Exam not found: " + id));

            // Fetch ALL questions from DB for this specific exam
            List<Question> dbQuestions = questionRepository.findByExamIdOrderByQuestionOrder(id);

            List<MockExamDto.Question> questions = mapQuestionsToDto(dbQuestions);

            int durationMinutes = exam.getDurationMinutes() != null ? exam.getDurationMinutes() : 45;

            log.info("Loaded {} questions from DB and CACHED for exam {}", dbQuestions.size(), id);

            return new MockExamDto.GetQuestionsResponse(
                    id,
                    exam.getName(),
                    questions,
                    durationMinutes
            );
        });
    }

    /**
     * Get a paginated slice of questions for an exam.
     *
     * <p>This is the preferred method when the exam has a large question bank.
     * Results are NOT cached because each page slice is small and the combination
     * of (examId, page, size) makes cache key management complex.
     *
     * <p>The DB read hits the <strong>read replica</strong> because this method
     * is annotated with {@code @Transactional(readOnly = true)}.
     *
     * @param examId the exam whose questions to fetch
     * @param page   0-based page number
     * @param size   number of questions per page (capped at 200)
     * @return paginated question slice with page metadata
     */
    @org.springframework.cache.annotation.Cacheable(
            value = "paged_questions",
            key = "#examId.toString() + '_' + #page + '_' + #size",
            unless = "#result == null"
    )
    public MockExamDto.GetQuestionsPagedResponse getQuestionsPaged(UUID examId, int page, int size) {
        // Defensive cap to prevent a caller requesting 100 000 questions in one shot
        int safeSize = Math.min(size, 200);

        var exam = examRepository.findById(examId)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found: " + examId));

        Pageable pageable = PageRequest.of(page, safeSize);
        Page<Question> questionPage = questionRepository.findByExamIdOrderByQuestionOrder(examId, pageable);

        List<MockExamDto.Question> questions = mapQuestionsToDto(questionPage.getContent());

        int durationMinutes = exam.getDurationMinutes() != null ? exam.getDurationMinutes() : 45;

        log.info("Loaded page {}/{} ({} questions) from Read Replica for exam {}",
                page + 1, questionPage.getTotalPages(), questions.size(), examId);

        return new MockExamDto.GetQuestionsPagedResponse(
                examId,
                exam.getName(),
                questions,
                durationMinutes,
                page,
                safeSize,
                questionPage.getTotalElements(),
                questionPage.getTotalPages(),
                questionPage.hasNext()
        );
    }

    /**
     * Get a single question by 0-based index.
     */
    @Transactional(readOnly = true)
    public MockExamDto.GetQuestionResponse getQuestion(UUID examId, int questionIndex) {
        var exam = examRepository.findById(examId)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found: " + examId));

        // Load only the specific page containing this index (1 question per "page")
        Pageable pageable = PageRequest.of(questionIndex, 1);
        Page<Question> questionPage = questionRepository.findByExamIdOrderByQuestionOrder(examId, pageable);

        if (!questionPage.hasContent()) {
            throw new IllegalArgumentException("Invalid question index: " + questionIndex
                    + " (total questions: " + questionPage.getTotalElements() + ")");
        }

        Question dbQuestion = questionPage.getContent().get(0);
        MockExamDto.Question question = new MockExamDto.Question(
                dbQuestion.getId().toString(),
                dbQuestion.getType().name(),
                dbQuestion.getText(),
                dbQuestion.getOptions(),
                null,  // Don't send correct answer to students
                dbQuestion.getDifficulty() != null ? dbQuestion.getDifficulty().name() : "MEDIUM"
        );

        int durationMinutes = exam.getDurationMinutes() != null ? exam.getDurationMinutes() : 45;
        long totalQuestions = questionPage.getTotalElements();

        log.info("Returning question {}/{} for exam {} (single-row page query)",
                questionIndex + 1, totalQuestions, examId);

        return new MockExamDto.GetQuestionResponse(
                examId,
                exam.getName(),
                question,
                questionIndex,
                (int) totalQuestions,
                durationMinutes
        );
    }

    // ===========================================================================
    //  SUBMIT
    // ===========================================================================

    /**
     * Submit exam answers with detailed behavior metrics.
     *
     * <p>Grades answers by fetching only the questions whose IDs appear in the
     * submission — avoiding a full table scan when the exam has a large question
     * bank but the student only answered a subset.
     */
    public MockExamDto.SubmitResponse submitExam(MockExamDto.SubmitRequest request) {
        var session = sessionRepository.findById(request.sessionId())
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + request.sessionId()));

        // Get total questions for this exam (cheap COUNT query)
        int totalQuestions = questionRepository.countByExamId(session.getExamId());

        // Get or create ExamSessionState to store detailed answer metrics
        var stateOpt = stateRepository.findBySessionId(request.sessionId());
        ExamSessionState state;

        if (stateOpt.isPresent()) {
            state = stateOpt.get();
        } else {
            state = new ExamSessionState();
            state.setId(UUID.randomUUID());
            state.setSessionId(request.sessionId());
            state.setGeneratedQuestions(new ArrayList<>());
        }

        // Collect the question IDs that the student answered
        Set<UUID> answeredQuestionIds = request.answers().stream()
                .filter(a -> a.questionId() != null)
                .map(a -> UUID.fromString(a.questionId()))
                .collect(Collectors.toSet());

        // Batch-fetch ONLY the answered questions (not the entire bank)
        Map<String, String> correctAnswers;
        if (answeredQuestionIds.isEmpty()) {
            correctAnswers = Map.of();
        } else {
            List<Question> fetchedQuestions = questionRepository.findAllById(answeredQuestionIds);
            correctAnswers = fetchedQuestions.stream()
                    .collect(Collectors.toMap(
                            q -> q.getId().toString(),
                            q -> q.getCorrectAnswer() != null ? q.getCorrectAnswer() : ""
                    ));
        }

        // Convert DTO answers to entity with behavior metrics
        List<ExamSessionState.SubmittedAnswer> submittedAnswers = request.answers().stream()
                .map(dto -> {
                    ExamSessionState.SubmittedAnswer answer = new ExamSessionState.SubmittedAnswer();
                    answer.setAnswer(dto.answer());
                    answer.setSubmittedAt(Instant.now());

                    if (dto.timeSpentMs() != null)      answer.setTimeSpentMs(dto.timeSpentMs());
                    if (dto.revisionCount() != null)    answer.setRevisionCount(dto.revisionCount());
                    if (dto.answerChanges() != null) {
                        List<ExamSessionState.AnswerChange> changes = dto.answerChanges().stream()
                                .map(changeDto -> {
                                    ExamSessionState.AnswerChange change = new ExamSessionState.AnswerChange();
                                    change.setFromAnswer(changeDto.fromAnswer());
                                    change.setToAnswer(changeDto.toAnswer());
                                    change.setTimestamp(changeDto.timestamp());
                                    change.setReason(changeDto.reason());
                                    return change;
                                })
                                .collect(Collectors.toList());
                        answer.setAnswerChanges(changes);
                    }
                    if (dto.averageTypingSpeed() != null) answer.setAverageTypingSpeed(dto.averageTypingSpeed());
                    if (dto.hadPreSuspicionDuring() != null) answer.setHadPreSuspicionDuring(dto.hadPreSuspicionDuring());
                    if (dto.difficulty() != null)       answer.setDifficulty(dto.difficulty().toLowerCase());

                    // Grade answer against correct answer fetched in batch above
                    String correctAnswer = correctAnswers.get(dto.questionId());
                    if (correctAnswer != null && dto.answer() != null) {
                        answer.setIsCorrect(correctAnswer.equalsIgnoreCase(dto.answer().trim()));
                    } else {
                        answer.setIsCorrect(false);
                    }

                    return answer;
                })
                .collect(Collectors.toList());

        state.setSubmittedAnswers(submittedAnswers);
        state.setIsCompleted(true);
        state.setCompletedAt(Instant.now());

        // Update session to ENDED
        session.setEndedAt(Instant.now());
        session.setStatus(SessionStatus.ENDED);

        // Enqueue both entities to be saved in a single batch in the background
        submissionBatchWriteService.enqueue(session, state);

        log.info("Enqueued {} answers and session end updates with behavior metrics for session {}",
                submittedAnswers.size(), request.sessionId());

        return new MockExamDto.SubmitResponse(
                request.sessionId(),
                Instant.now(),
                totalQuestions,
                request.answers().size(),
                "Exam submitted successfully. Results will be reviewed."
        );
    }

    // ===========================================================================
    //  BATCH (multiple exams at once — admin/proctor use)
    // ===========================================================================

    /**
     * Get questions for multiple exams in batch (optimised IN query on Read Replica).
     * Intended for admin/proctor dashboards, not student-facing flows.
     */
    @Transactional(readOnly = true)
    public List<MockExamDto.GetQuestionsResponse> getQuestionsBatch(List<UUID> examIds) {
        if (examIds == null || examIds.isEmpty()) {
            return List.of();
        }

        // Fetch all exams in batch
        var exams = examRepository.findAllById(examIds);
        var examMap = exams.stream().collect(Collectors.toMap(com.example.exam.model.Exam::getId, e -> e));

        // Fetch all questions in a single IN query
        List<Question> allQuestions = questionRepository.findByExamIdIn(examIds);

        // Group by examId and sort by question_order
        var questionsByExamMap = allQuestions.stream()
                .collect(Collectors.groupingBy(Question::getExamId));

        List<MockExamDto.GetQuestionsResponse> responseList = new ArrayList<>();

        for (UUID examId : examIds) {
            var exam = examMap.get(examId);
            if (exam == null) continue;

            List<Question> sorted = questionsByExamMap.getOrDefault(examId, List.of())
                    .stream()
                    .sorted(java.util.Comparator.comparingInt(Question::getQuestionOrder))
                    .toList();

            int durationMinutes = exam.getDurationMinutes() != null ? exam.getDurationMinutes() : 45;
            responseList.add(new MockExamDto.GetQuestionsResponse(
                    examId,
                    exam.getName(),
                    mapQuestionsToDto(sorted),
                    durationMinutes
            ));
        }

        log.info("Batch fetched questions for {} exams using IN query on Read Replica", examIds.size());
        return responseList;
    }

    // ===========================================================================
    //  PRIVATE HELPERS
    // ===========================================================================

    /**
     * Map Question entities to student-facing DTOs.
     * Correct answers are intentionally excluded.
     */
    private List<MockExamDto.Question> mapQuestionsToDto(List<Question> questions) {
        return questions.stream()
                .map(q -> new MockExamDto.Question(
                        q.getId().toString(),
                        q.getType().name(),
                        q.getText(),
                        q.getOptions(),
                        null,   // correctAnswer withheld from students
                        q.getDifficulty() != null ? q.getDifficulty().name() : "MEDIUM"
                ))
                .toList();
    }
}
