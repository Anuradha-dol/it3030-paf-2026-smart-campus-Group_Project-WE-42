package com.smartcampus.repository;

import com.smartcampus.model.Comment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface CommentRepository extends JpaRepository<Comment, Long> {

    @Modifying
    @Query("""
            DELETE FROM Comment c
            WHERE c.user.userId = :userId
            """)
    int deleteByUserId(@Param("userId") Long userId);
}
