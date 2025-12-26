"""
Cross-User Similarity Detector

Detects potential cheating by analyzing answer pattern similarities across users.
Flags when multiple users have suspiciously similar:
- Answer sequences
- Timing patterns
- Error patterns (same wrong answers)

This runs as a batch analysis after exam or periodically during proctored exams.
"""

import numpy as np
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
from collections import defaultdict
import json
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('CrossUserSimilarity')


@dataclass
class UserAnswerData:
    """Answer data for a single user"""
    user_id: str
    session_id: str
    exam_id: str
    answers: List[Dict]  # List of {questionId, answer, timeMs, isCorrect}
    submitted_at: int


@dataclass
class SimilarityResult:
    """Result of similarity comparison between two users"""
    user1_id: str
    user2_id: str
    answer_similarity: float  # 0-1 (Jaccard similarity)
    wrong_answer_match: float  # 0-1 (same wrong answers)
    timing_correlation: float  # -1 to 1 (Pearson correlation)
    sequence_similarity: float  # 0-1 (LCS-based)
    overall_score: float  # 0-100
    is_suspicious: bool
    details: Dict
    
    def to_dict(self) -> Dict:
        return {
            "user1_id": self.user1_id,
            "user2_id": self.user2_id,
            "answer_similarity": self.answer_similarity,
            "wrong_answer_match": self.wrong_answer_match,
            "timing_correlation": self.timing_correlation,
            "sequence_similarity": self.sequence_similarity,
            "overall_score": self.overall_score,
            "is_suspicious": self.is_suspicious,
            "details": self.details
        }


class CrossUserSimilarityDetector:
    """Detects suspicious similarities between user answer patterns"""
    
    # Thresholds
    ANSWER_SIMILARITY_THRESHOLD = 0.9  # 90% same answers = suspicious
    WRONG_ANSWER_MATCH_THRESHOLD = 0.5  # 50% same wrong answers = very suspicious
    TIMING_CORRELATION_THRESHOLD = 0.85  # Very high correlation = suspicious
    OVERALL_SUSPICIOUS_THRESHOLD = 70  # Overall score >= 70 = flag
    
    def __init__(self):
        self.user_data: Dict[str, UserAnswerData] = {}
    
    def add_user_data(self, data: UserAnswerData) -> None:
        """Add or update user answer data"""
        key = f"{data.exam_id}_{data.user_id}"
        self.user_data[key] = data
    
    def load_from_db(self, exam_id: str, answer_logs: List[Dict]) -> None:
        """Load answer data from database records"""
        # Group by user
        by_user: Dict[str, List[Dict]] = defaultdict(list)
        
        for log in answer_logs:
            user_id = log.get('userId')
            if user_id:
                by_user[user_id].append(log)
        
        # Create UserAnswerData for each user
        for user_id, answers in by_user.items():
            # Sort by question index
            sorted_answers = sorted(answers, key=lambda x: x.get('questionIndex', 0))
            
            self.add_user_data(UserAnswerData(
                user_id=user_id,
                session_id=answers[0].get('sessionId', ''),
                exam_id=exam_id,
                answers=sorted_answers,
                submitted_at=max(a.get('submittedAt', 0) for a in answers)
            ))
    
    def compare_pair(self, user1: UserAnswerData, user2: UserAnswerData) -> SimilarityResult:
        """Compare two users' answer patterns"""
        details = {}
        
        # 1. Answer similarity (Jaccard)
        answer_sim = self._answer_similarity(user1.answers, user2.answers)
        details['answer_matches'] = int(answer_sim * len(user1.answers))
        
        # 2. Wrong answer match (same wrong answers)
        wrong_match = self._wrong_answer_match(user1.answers, user2.answers)
        details['wrong_answer_matches'] = wrong_match['count']
        details['wrong_answers_matched'] = wrong_match['questions']
        
        # 3. Timing correlation
        timing_corr = self._timing_correlation(user1.answers, user2.answers)
        details['timing_samples'] = len(user1.answers)
        
        # 4. Sequence similarity (for partial cheating detection)
        seq_sim = self._sequence_similarity(user1.answers, user2.answers)
        
        # Calculate overall score
        overall_score = self._calculate_overall_score(
            answer_sim, wrong_match['ratio'], timing_corr, seq_sim
        )
        
        is_suspicious = (
            overall_score >= self.OVERALL_SUSPICIOUS_THRESHOLD or
            wrong_match['ratio'] >= self.WRONG_ANSWER_MATCH_THRESHOLD
        )
        
        return SimilarityResult(
            user1_id=user1.user_id,
            user2_id=user2.user_id,
            answer_similarity=answer_sim,
            wrong_answer_match=wrong_match['ratio'],
            timing_correlation=timing_corr,
            sequence_similarity=seq_sim,
            overall_score=overall_score,
            is_suspicious=is_suspicious,
            details=details
        )
    
    def analyze_exam(self, exam_id: str) -> List[SimilarityResult]:
        """Analyze all user pairs for an exam"""
        results = []
        
        # Get all users for this exam
        exam_users = [
            data for key, data in self.user_data.items()
            if data.exam_id == exam_id
        ]
        
        if len(exam_users) < 2:
            logger.info(f"Not enough users for exam {exam_id}: {len(exam_users)}")
            return results
        
        # Compare all pairs
        for i in range(len(exam_users)):
            for j in range(i + 1, len(exam_users)):
                result = self.compare_pair(exam_users[i], exam_users[j])
                
                if result.is_suspicious:
                    logger.warning(
                        f"Suspicious similarity: {result.user1_id} - {result.user2_id} "
                        f"(score: {result.overall_score})"
                    )
                
                results.append(result)
        
        # Sort by overall score (most suspicious first)
        results.sort(key=lambda r: r.overall_score, reverse=True)
        
        return results
    
    def _answer_similarity(self, answers1: List[Dict], answers2: List[Dict]) -> float:
        """Calculate Jaccard similarity of answer choices"""
        if not answers1 or not answers2:
            return 0.0
        
        # Create answer maps by question ID
        map1 = {a.get('questionId'): a.get('answer') for a in answers1}
        map2 = {a.get('questionId'): a.get('answer') for a in answers2}
        
        # Find common questions
        common_questions = set(map1.keys()) & set(map2.keys())
        if not common_questions:
            return 0.0
        
        # Count matches
        matches = sum(1 for q in common_questions if map1[q] == map2[q])
        
        return matches / len(common_questions)
    
    def _wrong_answer_match(self, answers1: List[Dict], answers2: List[Dict]) -> Dict:
        """Check if users have the same wrong answers"""
        # Get wrong answers for each user
        wrong1 = {
            a.get('questionId'): a.get('answer')
            for a in answers1 if not a.get('isCorrect', True)
        }
        wrong2 = {
            a.get('questionId'): a.get('answer')
            for a in answers2 if not a.get('isCorrect', True)
        }
        
        # Find questions where both are wrong
        common_wrong = set(wrong1.keys()) & set(wrong2.keys())
        
        if not common_wrong:
            return {'count': 0, 'ratio': 0.0, 'questions': []}
        
        # Check if they have the SAME wrong answer
        same_wrong = [
            q for q in common_wrong
            if wrong1[q] == wrong2[q]
        ]
        
        # Ratio based on total wrong answers
        total_wrong = len(set(wrong1.keys()) | set(wrong2.keys()))
        ratio = len(same_wrong) / total_wrong if total_wrong > 0 else 0.0
        
        return {
            'count': len(same_wrong),
            'ratio': ratio,
            'questions': same_wrong
        }
    
    def _timing_correlation(self, answers1: List[Dict], answers2: List[Dict]) -> float:
        """Calculate Pearson correlation of answer times"""
        # Create timing maps
        times1 = {a.get('questionId'): a.get('timeMs', 0) for a in answers1}
        times2 = {a.get('questionId'): a.get('timeMs', 0) for a in answers2}
        
        # Get common questions
        common = set(times1.keys()) & set(times2.keys())
        if len(common) < 5:  # Need at least 5 samples
            return 0.0
        
        # Extract aligned timing arrays
        t1 = np.array([times1[q] for q in common])
        t2 = np.array([times2[q] for q in common])
        
        # Handle zero variance
        if np.std(t1) == 0 or np.std(t2) == 0:
            return 0.0
        
        # Pearson correlation
        correlation = np.corrcoef(t1, t2)[0, 1]
        
        return float(correlation) if not np.isnan(correlation) else 0.0
    
    def _sequence_similarity(self, answers1: List[Dict], answers2: List[Dict]) -> float:
        """
        Calculate sequence similarity using Longest Common Subsequence.
        Detects if users answered in similar order with similar answers.
        """
        if not answers1 or not answers2:
            return 0.0
        
        # Create answer sequences
        seq1 = [(a.get('questionId'), a.get('answer')) for a in answers1]
        seq2 = [(a.get('questionId'), a.get('answer')) for a in answers2]
        
        # LCS length
        m, n = len(seq1), len(seq2)
        dp = [[0] * (n + 1) for _ in range(m + 1)]
        
        for i in range(1, m + 1):
            for j in range(1, n + 1):
                if seq1[i-1] == seq2[j-1]:
                    dp[i][j] = dp[i-1][j-1] + 1
                else:
                    dp[i][j] = max(dp[i-1][j], dp[i][j-1])
        
        lcs_length = dp[m][n]
        return lcs_length / max(m, n)
    
    def _calculate_overall_score(
        self,
        answer_sim: float,
        wrong_match: float,
        timing_corr: float,
        seq_sim: float
    ) -> float:
        """Calculate weighted overall suspicion score"""
        score = 0.0
        
        # Same answers (weight: 30)
        if answer_sim >= 0.9:
            score += 30
        elif answer_sim >= 0.8:
            score += 20
        elif answer_sim >= 0.7:
            score += 10
        
        # Same WRONG answers (weight: 35) - most suspicious
        if wrong_match >= 0.5:
            score += 35
        elif wrong_match >= 0.3:
            score += 25
        elif wrong_match >= 0.2:
            score += 15
        
        # Timing correlation (weight: 20)
        if timing_corr >= 0.9:
            score += 20
        elif timing_corr >= 0.8:
            score += 12
        elif timing_corr >= 0.7:
            score += 6
        
        # Sequence similarity (weight: 15)
        if seq_sim >= 0.8:
            score += 15
        elif seq_sim >= 0.6:
            score += 8
        
        return min(100, score)


# ========== Batch Analysis Functions ==========

def analyze_exam_similarity(exam_id: str, answer_logs: List[Dict]) -> List[Dict]:
    """
    Main entry point for cross-user similarity analysis.
    
    Args:
        exam_id: ID of the exam to analyze
        answer_logs: List of answer log records from database
        
    Returns:
        List of suspicious similarity results as dicts
    """
    detector = CrossUserSimilarityDetector()
    detector.load_from_db(exam_id, answer_logs)
    
    results = detector.analyze_exam(exam_id)
    
    # Return only suspicious results
    suspicious = [r.to_dict() for r in results if r.is_suspicious]
    
    logger.info(f"Exam {exam_id}: {len(suspicious)}/{len(results)} suspicious pairs")
    
    return suspicious


def find_cheating_clusters(results: List[SimilarityResult]) -> List[List[str]]:
    """
    Group users into potential cheating clusters.
    If A is similar to B and B is similar to C, they form a cluster.
    """
    # Build adjacency graph
    graph: Dict[str, set] = defaultdict(set)
    
    for r in results:
        if r.is_suspicious:
            graph[r.user1_id].add(r.user2_id)
            graph[r.user2_id].add(r.user1_id)
    
    # Find connected components
    visited = set()
    clusters = []
    
    def dfs(user: str, cluster: List[str]):
        if user in visited:
            return
        visited.add(user)
        cluster.append(user)
        for neighbor in graph[user]:
            dfs(neighbor, cluster)
    
    for user in graph:
        if user not in visited:
            cluster: List[str] = []
            dfs(user, cluster)
            if len(cluster) >= 2:
                clusters.append(cluster)
    
    return clusters


# ========== Singleton Instance ==========

cross_user_detector = CrossUserSimilarityDetector()
