package com.example.exam.service;

import com.example.exam.config.DataSourceType;
import com.example.exam.config.RoutingDataSource;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit Test checking the Read Replica routing logic for Incident-Service.
 * Ensures metadata annotations and DataSource Routing are perfectly aligned.
 */
public class IncidentReplicaReadTest {

    @Test
    public void testDetermineCurrentLookupKey_whenReadOnly_shouldReturnReplica() {
        var routingDataSource = new RoutingDataSource() {
            // Expose protected method for testing
            public Object getLookupKey() {
                return determineCurrentLookupKey();
            }
        };

        // Simulating Read-Only Transaction context using Spring Synchronization Manager Mocking/Simulation
        // Since TransactionSynchronizationManager uses ThreadLocal under the hood, we can bind it directly.
        try {
            TransactionSynchronizationManager.initSynchronization();
            TransactionSynchronizationManager.setCurrentTransactionReadOnly(true);

            // Act & Assert
            assertEquals(DataSourceType.REPLICA, routingDataSource.getLookupKey(),
                    "Should route to REPLICA datasource when transaction is readOnly");

            // Resetting to write transaction
            TransactionSynchronizationManager.setCurrentTransactionReadOnly(false);
            assertEquals(DataSourceType.PRIMARY, routingDataSource.getLookupKey(),
                    "Should route to PRIMARY datasource when transaction is writable");

        } finally {
            TransactionSynchronizationManager.clear();
        }
    }

    @Test
    public void testDetermineCurrentLookupKey_whenNoTransaction_shouldReturnPrimaryByDefault() {
        var routingDataSource = new RoutingDataSource() {
            public Object getLookupKey() {
                return determineCurrentLookupKey();
            }
        };

        // When no transaction is active, TransactionSynchronizationManager returns false
        assertFalse(TransactionSynchronizationManager.isCurrentTransactionReadOnly());
        assertEquals(DataSourceType.PRIMARY, routingDataSource.getLookupKey(),
                "Default lookup key must always be PRIMARY when no transaction is active");
    }

    @Test
    public void testIncidentService_findIncidents_shouldBeReadOnlyTransactional() throws NoSuchMethodException {
        // Retrieve the findIncidents method in IncidentService via reflection
        Method method = IncidentService.class.getMethod("findIncidents", 
                java.util.UUID.class, String.class, String.class, String.class, org.springframework.data.domain.Pageable.class);

        // Assert annotation metadata
        assertTrue(method.isAnnotationPresent(Transactional.class), 
                "findIncidents method must be transactional for database routing");
        
        Transactional transactional = method.getAnnotation(Transactional.class);
        assertTrue(transactional.readOnly(), 
                "findIncidents must have readOnly = true to route queries to Read Replica");
    }

    @Test
    public void testIncidentService_getSummary_shouldBeReadOnlyTransactional() throws NoSuchMethodException {
        // Retrieve the getSummary method in IncidentService via reflection
        Method method = IncidentService.class.getMethod("getSummary", String.class, java.util.UUID.class);

        // Assert annotation metadata
        assertTrue(method.isAnnotationPresent(Transactional.class), 
                "getSummary method must be transactional for database routing");
        
        Transactional transactional = method.getAnnotation(Transactional.class);
        assertTrue(transactional.readOnly(), 
                "getSummary must have readOnly = true to route queries to Read Replica");
    }
}
