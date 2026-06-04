package com.example.exam.service;

import com.example.exam.model.ExamSessionState;
import com.example.exam.model.Session;
import com.example.exam.repository.ExamSessionStateRepository;
import com.example.exam.repository.SessionRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Component
public class SubmissionBatchPersister {

    private final SessionRepository sessionRepository;
    private final ExamSessionStateRepository stateRepository;

    public SubmissionBatchPersister(SessionRepository sessionRepository, ExamSessionStateRepository stateRepository) {
        this.sessionRepository = sessionRepository;
        this.stateRepository = stateRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveBatch(List<Session> sessions, List<ExamSessionState> states) {
        sessionRepository.saveAll(sessions);
        stateRepository.saveAll(states);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void saveIndividual(Session session, ExamSessionState state) {
        sessionRepository.save(session);
        stateRepository.save(state);
    }
}
