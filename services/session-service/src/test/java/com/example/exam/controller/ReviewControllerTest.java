package com.example.exam.controller;

import com.example.exam.dto.ReviewDto;
import com.example.exam.model.Review;
import com.example.exam.model.ReviewStatus;
import com.example.exam.repository.IncidentRepository;
import com.example.exam.repository.ReviewRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = ReviewController.class)
@AutoConfigureMockMvc(addFilters = false)
@SuppressWarnings("null")
class ReviewControllerTest {

    @Autowired
    MockMvc mvc;
    @Autowired
    ObjectMapper om;

    @MockBean
    ReviewRepository reviewRepository;
    @MockBean
    IncidentRepository incidentRepository;

    @Test
    void createReview_happyPath_returnsCreated() throws Exception {
        UUID incidentId = UUID.randomUUID();
        when(incidentRepository.existsById(eq(incidentId))).thenReturn(true);
        when(reviewRepository.findByIncidentId(eq(incidentId))).thenReturn(Optional.empty());
        Mockito.lenient().when(reviewRepository.save(any())).thenAnswer(invocation -> {
            Review r = invocation.getArgument(0);
            if (r.getReviewedAt() == null) r.setReviewedAt(Instant.now());
            return r;
        });

        ReviewDto.CreateRequest req = new ReviewDto.CreateRequest();
        req.incidentId = incidentId;
        req.reviewerId = UUID.randomUUID().toString();
        req.status = ReviewStatus.CONFIRMED;
        req.note = "looks legit";

        mvc.perform(post("/api/admin/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(req)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id", notNullValue()))
                .andExpect(jsonPath("$.incidentId", is(incidentId.toString())))
                .andExpect(jsonPath("$.status", is("CONFIRMED")))
                .andExpect(jsonPath("$.reviewedAt", notNullValue()));
    }

    @Test
    void createReview_incidentMissing_returns404() throws Exception {
        UUID incidentId = UUID.randomUUID();
        when(incidentRepository.existsById(eq(incidentId))).thenReturn(false);

        ReviewDto.CreateRequest req = new ReviewDto.CreateRequest();
        req.incidentId = incidentId;
        req.status = ReviewStatus.REJECTED;

        mvc.perform(post("/api/admin/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(req)))
                .andExpect(status().isNotFound());
    }

    @Test
    void createReview_duplicate_returns409() throws Exception {
        UUID incidentId = UUID.randomUUID();
        when(incidentRepository.existsById(eq(incidentId))).thenReturn(true);
        when(reviewRepository.findByIncidentId(eq(incidentId))).thenReturn(Optional.of(new Review()));

        ReviewDto.CreateRequest req = new ReviewDto.CreateRequest();
        req.incidentId = incidentId;
        req.status = ReviewStatus.CONFIRMED;

        mvc.perform(post("/api/admin/reviews")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(om.writeValueAsString(req)))
                .andExpect(status().isConflict());
    }

    @Test
    void getByIncident_notFound_returns404() throws Exception {
        UUID incidentId = UUID.randomUUID();
        when(reviewRepository.findByIncidentId(eq(incidentId))).thenReturn(Optional.empty());

        mvc.perform(get("/api/admin/reviews").param("incidentId", incidentId.toString()))
                .andExpect(status().isNotFound());
    }

    @Test
    void getByIncident_found_returns200() throws Exception {
        UUID incidentId = UUID.randomUUID();
        Review r = new Review();
        r.setIncidentId(incidentId);
        r.setStatus(ReviewStatus.REJECTED);
        r.setReviewedAt(Instant.now());
        when(reviewRepository.findByIncidentId(eq(incidentId))).thenReturn(Optional.of(r));

        mvc.perform(get("/api/admin/reviews").param("incidentId", incidentId.toString()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.incidentId", is(incidentId.toString())))
                .andExpect(jsonPath("$.status", is("REJECTED")));
    }
}
