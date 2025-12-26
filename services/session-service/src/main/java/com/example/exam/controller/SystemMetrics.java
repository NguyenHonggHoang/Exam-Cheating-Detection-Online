package com.example.exam.controller;

import java.util.Map;

public record SystemMetrics(
    int activeSessions,
    long totalExams,
    long activeExams,
    long pendingIncidents,
    String storageUsed,
    String storageTotal,
    int storagePercent,
    int dbConnections,
    int dbMaxConnections,
    String uptime
) {}
