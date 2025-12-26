package com.example.exam.service;

import io.livekit.server.AccessToken;
import io.livekit.server.RoomJoin;
import io.livekit.server.RoomName;
import io.livekit.server.CanPublish;
import io.livekit.server.CanSubscribe;
import io.livekit.server.CanPublishData;
import io.livekit.server.Hidden;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.util.HashMap;
import java.util.Map;

/**
 * LiveKit Token Service
 * Generates JWT access tokens for WebRTC connections
 */
@Service
public class LiveKitTokenService {

    @Value("${livekit.api-key}")
    private String apiKey;

    @Value("${livekit.api-secret}")
    private String apiSecret;

    // Internal host for backend communication (if needed in future)
    @Value("${livekit.host:ws://localhost:7880}")
    private String livekitHost;
    
    // Public URL for frontend clients
    @Value("${livekit.public-url:ws://localhost:7880}")
    private String publicUrl;

    /**
     * Generate LiveKit access token for joining a room
     * 
     * @param roomName Exam session ID (used as room name)
     * @param participantId User ID
     * @param participantName User's display name
     * @return Map with token and websocket URL
     */
    public Map<String, String> generateToken(String roomName, String participantId, String participantName) {
        return generateToken(roomName, participantId, participantName, 12 * 60 * 60); // Default 12 hours
    }

    /**
     * Generate LiveKit access token with custom TTL
     */
    public Map<String, String> generateToken(String roomName, String participantId, String participantName, long ttlSeconds) {
        // Create access token
        AccessToken token = new AccessToken(apiKey, apiSecret);
        token.setName(participantName);
        token.setIdentity(participantId);

        // Set video grants (permissions) using the new API
        token.addGrants(
            new RoomJoin(true),
            new RoomName(roomName),
            new CanPublish(true),
            new CanSubscribe(true),
            new CanPublishData(true)
        );

        // Token valid for specified duration
        token.setTtl(ttlSeconds);

        try {
            String jwt = token.toJwt();

            Map<String, String> response = new HashMap<>();
            response.put("token", jwt);
            response.put("wsUrl", publicUrl); // Use public URL
            response.put("roomName", roomName);
            
            return response;
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate LiveKit token", e);
        }
    }

    /**
     * Generate token for admin/proctor to monitor exam room
     */
    public Map<String, String> generateProctorToken(String roomName, String proctorId) {
        AccessToken token = new AccessToken(apiKey, apiSecret);
        token.setName("Proctor-" + proctorId);
        token.setIdentity("proctor-" + proctorId);

        // Proctor permissions: can subscribe to all tracks, cannot publish
        // Note: Removed Hidden(true) as it was causing WebRTC connection issues
        token.addGrants(
            new RoomJoin(true),
            new RoomName(roomName),
            new CanPublish(false),
            new CanSubscribe(true),
            new CanPublishData(true)  // Allow data channel for signaling
        );
        
        token.setTtl(12 * 60 * 60);  // 12 hours for proctors

        try {
            String jwt = token.toJwt();

            Map<String, String> response = new HashMap<>();
            response.put("token", jwt);
            response.put("wsUrl", publicUrl); // Use public URL
            response.put("roomName", roomName);
            
            return response;
        } catch (Exception e) {
            throw new RuntimeException("Failed to generate proctor token", e);
        }
    }
}
