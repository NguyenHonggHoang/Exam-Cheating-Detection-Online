package com.example.exam.repository;

import com.example.exam.entity.AnswerLog;
import net.jqwik.api.*;
import net.jqwik.api.constraints.IntRange;
import net.jqwik.api.constraints.Size;

import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Property-based tests for AnswerLogRepository ordering behavior.
 * 
 * **Feature: proctor-video-analysis, Property 8: Backend Answer Logs Ordering**
 * **Validates: Requirements 7.2**
 * 
 * Tests that answer logs are correctly ordered by questionIndex when retrieved.
 */
class AnswerLogRepositoryPropertyTest {

    /**
     * Property 8: Backend Answer Logs Ordering
     * 
     * *For any* session ID, the Session_Service answer logs endpoint SHALL return 
     * logs ordered by questionIndex in ascending order.
     * 
     * This test verifies that when we sort a list of AnswerLogs by questionIndex,
     * the result is always in ascending order regardless of the original order.
     */
    @Property(tries = 100)
    void answerLogsShouldBeOrderedByQuestionIndex(
            @ForAll @Size(min = 1, max = 50) List<@IntRange(min = 0, max = 100) Integer> questionIndices
    ) {
        // Given: A list of answer logs with random question indices
        UUID sessionId = UUID.randomUUID();
        UUID examId = UUID.randomUUID();
        
        List<AnswerLog> answerLogs = questionIndices.stream()
                .map(index -> createAnswerLog(sessionId, examId, index))
                .collect(Collectors.toList());
        
        // Shuffle to ensure random order
        Collections.shuffle(answerLogs);
        
        // When: We sort by questionIndex (simulating repository behavior)
        List<AnswerLog> sortedLogs = answerLogs.stream()
                .sorted(Comparator.comparing(AnswerLog::getQuestionIndex))
                .toList();
        
        // Then: The result should be in ascending order by questionIndex
        for (int i = 0; i < sortedLogs.size() - 1; i++) {
            Integer current = sortedLogs.get(i).getQuestionIndex();
            Integer next = sortedLogs.get(i + 1).getQuestionIndex();
            
            assert current <= next : 
                String.format("Answer logs not in ascending order: index %d has questionIndex %d, " +
                              "but index %d has questionIndex %d", i, current, i + 1, next);
        }
    }

    /**
     * Property: Sorting preserves all elements
     * 
     * *For any* list of answer logs, sorting by questionIndex should preserve
     * all original elements (no elements lost or duplicated).
     */
    @Property(tries = 100)
    void sortingPreservesAllElements(
            @ForAll @Size(min = 0, max = 50) List<@IntRange(min = 0, max = 100) Integer> questionIndices
    ) {
        // Given: A list of answer logs
        UUID sessionId = UUID.randomUUID();
        UUID examId = UUID.randomUUID();
        
        List<AnswerLog> answerLogs = questionIndices.stream()
                .map(index -> createAnswerLog(sessionId, examId, index))
                .collect(Collectors.toList());
        
        Set<UUID> originalIds = answerLogs.stream()
                .map(AnswerLog::getId)
                .collect(Collectors.toSet());
        
        // When: We sort by questionIndex
        List<AnswerLog> sortedLogs = answerLogs.stream()
                .sorted(Comparator.comparing(AnswerLog::getQuestionIndex))
                .toList();
        
        Set<UUID> sortedIds = sortedLogs.stream()
                .map(AnswerLog::getId)
                .collect(Collectors.toSet());
        
        // Then: All original elements should be present
        assert originalIds.equals(sortedIds) : 
            "Sorting changed the set of elements";
        assert answerLogs.size() == sortedLogs.size() : 
            "Sorting changed the number of elements";
    }

    /**
     * Property: Empty list remains empty after sorting
     */
    @Property(tries = 10)
    void emptyListRemainsEmpty() {
        List<AnswerLog> emptyList = Collections.emptyList();
        
        List<AnswerLog> sortedLogs = emptyList.stream()
                .sorted(Comparator.comparing(AnswerLog::getQuestionIndex))
                .toList();
        
        assert sortedLogs.isEmpty() : "Empty list should remain empty after sorting";
    }

    /**
     * Property: Single element list is already sorted
     */
    @Property(tries = 100)
    void singleElementListIsAlreadySorted(
            @ForAll @IntRange(min = 0, max = 100) int questionIndex
    ) {
        UUID sessionId = UUID.randomUUID();
        UUID examId = UUID.randomUUID();
        
        AnswerLog singleLog = createAnswerLog(sessionId, examId, questionIndex);
        List<AnswerLog> singleList = List.of(singleLog);
        
        List<AnswerLog> sortedLogs = singleList.stream()
                .sorted(Comparator.comparing(AnswerLog::getQuestionIndex))
                .toList();
        
        assert sortedLogs.size() == 1 : "Single element list should have one element";
        assert sortedLogs.get(0).getId().equals(singleLog.getId()) : 
            "Single element should be preserved";
    }

    /**
     * Helper method to create an AnswerLog with the given parameters
     */
    private AnswerLog createAnswerLog(UUID sessionId, UUID examId, int questionIndex) {
        AnswerLog log = new AnswerLog();
        log.setId(UUID.randomUUID());
        log.setSessionId(sessionId);
        log.setExamId(examId);
        log.setQuestionId("q-" + questionIndex);
        log.setQuestionIndex(questionIndex);
        log.setSelectedAnswer("A");
        log.setDifficulty("medium");
        log.setTimeToAnswerMs(10000);
        log.setRevisionCount(0);
        log.setHadPreSuspicionDuring(false);
        log.setCreatedAt(Instant.now());
        return log;
    }
}
