package com.examplatform.identity.config;

import com.examplatform.identity.domain.RoleEntity;
import com.examplatform.identity.domain.RoleName;
import com.examplatform.identity.domain.RoleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.EnumSet;
import java.util.UUID;

@Configuration
public class RoleSeeder {

    private static final Logger logger = LoggerFactory.getLogger(RoleSeeder.class);

    @Bean
    CommandLineRunner seedRoles(RoleRepository roleRepository) {
        return args -> {
            EnumSet<RoleName> required = EnumSet.allOf(RoleName.class);
            required.stream()
                    .filter(roleName -> !roleRepository.existsByRoleName(roleName))
                    .map(roleName -> new RoleEntity(UUID.randomUUID(), roleName))
                    .forEach(role -> {
                        roleRepository.save(role);
                        logger.info("Seeded role {}", role.getRoleName());
                    });

            long count = roleRepository.count();
            logger.info("Role seeding complete ({} entries)", count);
        };
    }
}

