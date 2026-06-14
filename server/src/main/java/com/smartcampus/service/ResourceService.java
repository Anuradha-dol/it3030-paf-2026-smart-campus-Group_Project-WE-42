package com.smartcampus.service;

import java.util.List;

import com.smartcampus.dto.ResourceRequestDTO;
import com.smartcampus.dto.ResourceResponseDTO;

public interface ResourceService {
	ResourceResponseDTO createResource(ResourceRequestDTO requestDTO);

	List<ResourceResponseDTO> getAllResources();

	ResourceResponseDTO getResourceById(Long id);

	ResourceResponseDTO updateResource(Long id, ResourceRequestDTO requestDTO);

	void deleteResource(Long id);
}
