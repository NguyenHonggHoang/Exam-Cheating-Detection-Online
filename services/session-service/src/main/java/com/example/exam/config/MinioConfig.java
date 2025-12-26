package com.example.exam.config;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.SetBucketPolicyArgs;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

/**
 * MinIO Configuration for S3-compatible Object Storage
 * 
 * Creates two MinIO clients:
 * - minioClient: Uses internal endpoint (minio:9000) for bucket operations
 * - externalMinioClient: Uses external endpoint (host.docker.internal:9002) for presigned URLs
 * 
 * NOTE: externalMinioClient generates presigned URLs with host.docker.internal:9002 signature,
 * which must be converted to localhost:9002 for browser access (browser-endpoint).
 */
@Configuration
public class MinioConfig {

    private static final Logger log = LoggerFactory.getLogger(MinioConfig.class);

    @Value("${minio.endpoint}")
    private String endpoint;
    
    // External endpoint for container to connect (e.g., host.docker.internal:9002)
    @Value("${minio.external-endpoint:http://localhost:9002}")
    private String externalEndpoint;
    
    // Browser endpoint for client URLs (e.g., localhost:9002)
    // Defaults to same as external-endpoint for local dev
    @Value("${minio.browser-endpoint:${minio.external-endpoint:http://localhost:9002}}")
    private String browserEndpoint;

    @Value("${minio.access-key}")
    private String accessKey;

    @Value("${minio.secret-key}")
    private String secretKey;

    @Value("${minio.bucket.evidence:exam-evidence}")
    private String evidenceBucket;

    @Value("${minio.bucket.identity:exam-identity}")
    private String identityBucket;

    /**
     * Primary MinIO client for internal operations (bucket management, uploads from server)
     */
    @Bean
    @Primary
    public MinioClient minioClient() {
        MinioClient client = MinioClient.builder()
                .endpoint(endpoint)
                .credentials(accessKey, secretKey)
                .build();
        
        // Initialize buckets after client is created
        initBuckets(client);
        
        return client;
    }
    
    /**
     * External MinIO client for generating presigned URLs.
     * Uses external endpoint so signatures match what browser will use (after host replacement).
     * 
     * NOTE: Since the signature is based on the HOST header, we use container-accessible
     * endpoint (host.docker.internal) here, then replace the host in the URL later.
     * This works because MinIO signature v4 is host-agnostic for the path.
     */
    @Bean
    @Qualifier("externalMinioClient")
    public MinioClient externalMinioClient() {
        log.info("Creating external MinIO client with endpoint: {}", externalEndpoint);
        log.info("Browser will access via: {}", browserEndpoint);
        return MinioClient.builder()
                .endpoint(externalEndpoint)
                .credentials(accessKey, secretKey)
                .build();
    }
    
    @Bean
    public String minioBrowserEndpoint() {
        return browserEndpoint;
    }

    private void initBuckets(MinioClient client) {
        createBucketIfNotExists(client, evidenceBucket);
        createBucketIfNotExists(client, identityBucket);
    }

    private void createBucketIfNotExists(MinioClient client, String bucketName) {
        try {
            boolean exists = client.bucketExists(
                BucketExistsArgs.builder().bucket(bucketName).build()
            );
            
            if (!exists) {
                client.makeBucket(
                    MakeBucketArgs.builder().bucket(bucketName).build()
                );
                log.info("Created MinIO bucket: {}", bucketName);
            } else {
                log.info("MinIO bucket already exists: {}", bucketName);
            }
            
            // Always apply bucket policy (for both new and existing buckets)
            applyBucketPolicy(client, bucketName);
            
        } catch (Exception e) {
            log.error("Failed to initialize MinIO bucket {}: {}", bucketName, e.getMessage());
        }
    }
    
    /**
     * Apply bucket policy for both downloads (GetObject) and uploads via presigned URLs (PutObject)
     */
    private void applyBucketPolicy(MinioClient client, String bucketName) {
        try {
            String policy = """
                {
                    "Version": "2012-10-17",
                    "Statement": [
                        {
                            "Effect": "Allow",
                            "Principal": {"AWS": ["*"]},
                            "Action": ["s3:GetObject", "s3:PutObject"],
                            "Resource": ["arn:aws:s3:::%s/*"]
                        }
                    ]
                }
                """.formatted(bucketName);
            
            client.setBucketPolicy(
                SetBucketPolicyArgs.builder()
                    .bucket(bucketName)
                    .config(policy)
                    .build()
            );
            log.info("Applied download/upload policy for bucket: {}", bucketName);
        } catch (Exception e) {
            log.error("Failed to apply bucket policy for {}: {}", bucketName, e.getMessage());
        }
    }
}


