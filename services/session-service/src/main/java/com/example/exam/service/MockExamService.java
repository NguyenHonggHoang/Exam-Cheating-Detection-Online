package com.example.exam.service;

import com.example.exam.dto.MockExamDto;
import com.example.exam.dto.QuestionDto;
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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class MockExamService {

    private static final Logger log = LoggerFactory.getLogger(MockExamService.class);
    
    private final SessionRepository sessionRepository;
    private final ExamRepository examRepository;
    private final QuestionRepository questionRepository;
    private final ExamSessionStateRepository stateRepository;
    private final WebSocketNotificationService wsNotificationService;

    public MockExamService(SessionRepository sessionRepository, ExamRepository examRepository,
                           QuestionRepository questionRepository,
                           ExamSessionStateRepository stateRepository,
                           WebSocketNotificationService wsNotificationService) {
        this.sessionRepository = sessionRepository;
        this.examRepository = examRepository;
        this.questionRepository = questionRepository;
        this.stateRepository = stateRepository;
        this.wsNotificationService = wsNotificationService;
    }

    /**
     * Start a mock exam session
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

    /**
     * Get questions for an exam from database
     * Questions are specific to each exam based on exam_id
     */
    public MockExamDto.GetQuestionsResponse getQuestions(UUID examId) {
        var exam = examRepository.findById(examId)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found: " + examId));
        
        // Fetch questions from database for this specific exam
        List<Question> dbQuestions = questionRepository.findByExamIdOrderByQuestionOrder(examId);
        
        // Convert to DTO (StudentResponse - no correct answer for students)
        List<MockExamDto.Question> questions = dbQuestions.stream()
                .map(q -> new MockExamDto.Question(
                        q.getId().toString(),
                        q.getType().name(),
                        q.getText(),
                        q.getOptions(),
                        null,  // Don't send correct answer to students
                        q.getDifficulty() != null ? q.getDifficulty().name() : "MEDIUM"
                ))
                .toList();
        
        // Get duration from exam, fallback to 45 minutes
        int durationMinutes = exam.getDurationMinutes() != null ? exam.getDurationMinutes() : 45;
        
        log.info("Returning {} questions for exam {}", questions.size(), examId);
        
        return new MockExamDto.GetQuestionsResponse(
                examId,
                exam.getName(),
                questions,
                durationMinutes
        );
    }

    /**
     * Get a single question by index (0-based)
     */
    public MockExamDto.GetQuestionResponse getQuestion(UUID examId, int questionIndex) {
        var exam = examRepository.findById(examId)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found: " + examId));
        
        // Fetch all questions to get total count and specific question
        List<Question> dbQuestions = questionRepository.findByExamIdOrderByQuestionOrder(examId);
        
        if (questionIndex < 0 || questionIndex >= dbQuestions.size()) {
            throw new IllegalArgumentException("Invalid question index: " + questionIndex + 
                    " (total questions: " + dbQuestions.size() + ")");
        }
        
        // Get the specific question
        Question dbQuestion = dbQuestions.get(questionIndex);
        MockExamDto.Question question = new MockExamDto.Question(
                dbQuestion.getId().toString(),
                dbQuestion.getType().name(),
                dbQuestion.getText(),
                dbQuestion.getOptions(),
                null,  // Don't send correct answer to students
                dbQuestion.getDifficulty() != null ? dbQuestion.getDifficulty().name() : "MEDIUM"
        );
        
        int durationMinutes = exam.getDurationMinutes() != null ? exam.getDurationMinutes() : 45;
        
        log.info("Returning question {} of {} for exam {}", questionIndex + 1, dbQuestions.size(), examId);
        
        return new MockExamDto.GetQuestionResponse(
                examId,
                exam.getName(),
                question,
                questionIndex,
                dbQuestions.size(),
                durationMinutes
        );
    }

    /**
     * Submit exam answers with detailed behavior metrics
     * Grades answers and calculates score based on correct answers in database
     */
    @Transactional
    public MockExamDto.SubmitResponse submitExam(MockExamDto.SubmitRequest request) {
        var session = sessionRepository.findById(request.sessionId())
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + request.sessionId()));
        
        // Get total questions for this exam
        int totalQuestions = questionRepository.countByExamId(session.getExamId());
        
        // Get or create ExamSessionState to store detailed answer metrics
        var stateOpt = stateRepository.findBySessionId(request.sessionId());
        ExamSessionState state;
        
        if (stateOpt.isPresent()) {
            state = stateOpt.get();
        } else {
            // Create new state if not exists (for mock exams without pre-generated questions)
            state = new ExamSessionState();
            state.setId(UUID.randomUUID());
            state.setSessionId(request.sessionId());
            state.setGeneratedQuestions(new ArrayList<>()); // Empty for mock exams
        }
        
        // Build a map of question ID -> correct answer for grading
        List<Question> examQuestions = questionRepository.findByExamIdOrderByQuestionOrder(session.getExamId());
        java.util.Map<String, String> correctAnswers = examQuestions.stream()
                .collect(Collectors.toMap(
                        q -> q.getId().toString(),
                        q -> q.getCorrectAnswer() != null ? q.getCorrectAnswer() : ""
                ));
        
        // Convert DTO answers to entity with behavior metrics
        List<ExamSessionState.SubmittedAnswer> submittedAnswers = request.answers().stream()
                .map(dto -> {
                    ExamSessionState.SubmittedAnswer answer = new ExamSessionState.SubmittedAnswer();
                    answer.setAnswer(dto.answer());
                    answer.setSubmittedAt(Instant.now());
                    
                    // Copy behavior metrics if provided
                    if (dto.timeSpentMs() != null) {
                        answer.setTimeSpentMs(dto.timeSpentMs());
                    }
                    if (dto.revisionCount() != null) {
                        answer.setRevisionCount(dto.revisionCount());
                    }
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
                    if (dto.averageTypingSpeed() != null) {
                        answer.setAverageTypingSpeed(dto.averageTypingSpeed());
                    }
                    if (dto.hadPreSuspicionDuring() != null) {
                        answer.setHadPreSuspicionDuring(dto.hadPreSuspicionDuring());
                    }
                    // FIX: Normalize difficulty to lowercase for consistent comparison
                    if (dto.difficulty() != null) {
                        answer.setDifficulty(dto.difficulty().toLowerCase());
                    }
                    
                    // FIX: Grade answer by comparing with correct answer from database
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
        stateRepository.save(state);
        
        log.info("Saved {} answers with behavior metrics for session {}", 
                submittedAnswers.size(), request.sessionId());
        
        // Update session to ENDED
        session.setEndedAt(Instant.now());
        session.setStatus(SessionStatus.ENDED);
        sessionRepository.save(session);
        
        log.info("Submitted exam for session {}, answered {}/{} questions", 
                request.sessionId(), request.answers().size(), totalQuestions);
        
        return new MockExamDto.SubmitResponse(
                request.sessionId(),
                Instant.now(),
                totalQuestions,
                request.answers().size(),
                "Exam submitted successfully. Results will be reviewed."
        );
    }
}
