package com.smartcampus.records;

import lombok.Builder;

@Builder
public record MailBody(String to,String subject, String text ) {
}

