package com.example.exam.service;

import com.example.exam.dto.MockExamDto;
import com.example.exam.model.Session;
import com.example.exam.model.SessionStatus;
import com.example.exam.repository.ExamRepository;
import com.example.exam.repository.SessionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

@Service
public class MockExamService {

    private static final Logger log = LoggerFactory.getLogger(MockExamService.class);
    
    private final SessionRepository sessionRepository;
    private final ExamRepository examRepository;

    public MockExamService(SessionRepository sessionRepository, ExamRepository examRepository) {
        this.sessionRepository = sessionRepository;
        this.examRepository = examRepository;
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
        
        log.info("Started mock exam session {} for user {} and exam {}", 
                session.getId(), request.userId(), request.examId());
        
        return new MockExamDto.StartSessionResponse(
                session.getId(),
                request.examId(),
                exam.getName(),
                45, // Default 45 minutes
                session.getStartedAt()
        );
    }

    /**
     * Get mock questions for an exam
     * TODO: Replace with real questions from database
     */
    public MockExamDto.GetQuestionsResponse getQuestions(UUID examId) {
        var exam = examRepository.findById(examId)
                .orElseThrow(() -> new IllegalArgumentException("Exam not found: " + examId));
        
        // Mock questions (in real app, fetch from database)
        List<MockExamDto.Question> questions = Arrays.asList(
                new MockExamDto.Question(
                        "q1",
                        "MULTIPLE_CHOICE",
                        "2 + 2 = ?",
                        Arrays.asList("3", "4", "5", "6"),
                        "4"
                ),
                new MockExamDto.Question(
                        "q2",
                        "MULTIPLE_CHOICE",
                        "Thủ đô của Việt Nam là?",
                        Arrays.asList("Hà Nội", "Hồ Chí Minh", "Đà Nẵng", "Huế"),
                        "Hà Nội"
                ),
                new MockExamDto.Question(
                        "q3",
                        "MULTIPLE_CHOICE",
                        "Java là ngôn ngữ lập trình hướng đối tượng?",
                        Arrays.asList("Đúng", "Sai"),
                        "Đúng"
                ),
                new MockExamDto.Question(
                        "q4",
                        "MULTIPLE_CHOICE",
                        "HTTP status code 200 có nghĩa là?",
                        Arrays.asList("Not Found", "OK", "Server Error", "Unauthorized"),
                        "OK"
                ),
                new MockExamDto.Question(
                        "q5",
                        "MULTIPLE_CHOICE",
                        "Database nào sau đây là SQL?",
                        Arrays.asList("MongoDB", "Redis", "PostgreSQL", "Cassandra"),
                        "PostgreSQL"
                ),
                new MockExamDto.Question(
                        "q6",
                        "TEXT",
                        "Spring Boot là gì?",
                        null,
                        "Framework Java để phát triển ứng dụng"
                ),
                new MockExamDto.Question(
                        "q7",
                        "TEXT",
                        "REST API là gì?",
                        null,
                        "Kiến trúc API dựa trên HTTP"
                ),
                new MockExamDto.Question(
                        "q8",
                        "TEXT",
                        "Docker có tác dụng gì?",
                        null,
                        "Container hóa ứng dụng"
                ),
                new MockExamDto.Question(
                        "q9",
                        "TEXT",
                        "Git là gì?",
                        null,
                        "Hệ thống quản lý mã nguồn"
                ),
                new MockExamDto.Question(
                        "q10",
                        "TEXT",
                        "Microservices là gì?",
                        null,
                        "Kiến trúc chia nhỏ ứng dụng thành các services"
                )
        );
        
        return new MockExamDto.GetQuestionsResponse(
                examId,
                exam.getName(),
                questions,
                45
        );
    }

    /**
     * Submit exam answers
     * TODO: Grade answers and calculate score
     */
    @Transactional
    public MockExamDto.SubmitResponse submitExam(MockExamDto.SubmitRequest request) {
        var session = sessionRepository.findById(request.sessionId())
                .orElseThrow(() -> new IllegalArgumentException("Session not found: " + request.sessionId()));
        
        // Update session to ENDED
        session.setEndedAt(Instant.now());
        session.setStatus(SessionStatus.ENDED);
        sessionRepository.save(session);
        
        log.info("Submitted exam for session {}, answered {}/{} questions", 
                request.sessionId(), request.answers().size(), 10);
        
        return new MockExamDto.SubmitResponse(
                request.sessionId(),
                Instant.now(),
                10,
                request.answers().size(),
                "Exam submitted successfully. Results will be reviewed."
        );
    }
}
