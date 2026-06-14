package com.smartcampus.repository;

import com.smartcampus.model.User;
import jakarta.transaction.Transactional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface UserRepo extends JpaRepository<User, Long> {

    Optional<User> findByEmail(String email);
    Optional<User> findByEmailIgnoreCase(String email);
    Optional<User> findFirstByFirstnameIgnoreCaseAndLastNameIgnoreCase(String firstname, String lastName);

    Optional<User> findByPhoneNumber(String phoneNumber);

    java.util.List<User> findByRole(com.smartcampus.enums.Role role);

    @Transactional
    @Modifying
    @Query(value = "ALTER TABLE users MODIFY face_descriptor LONGTEXT NULL", nativeQuery = true)
    void fixFaceDescriptorColumnType();
}
