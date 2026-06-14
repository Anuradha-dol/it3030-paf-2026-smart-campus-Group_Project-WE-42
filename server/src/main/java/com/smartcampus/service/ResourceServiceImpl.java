package com.smartcampus.service;

import java.util.List;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.smartcampus.dto.ResourceRequestDTO;
import com.smartcampus.dto.ResourceResponseDTO;
import com.smartcampus.exception.ResourceNotFoundException;
import com.smartcampus.model.Resource;
import com.smartcampus.repository.ResourceRepository;

@Service
public class ResourceServiceImpl implements ResourceService {
    private final ResourceRepository resourceRepository;

    public ResourceServiceImpl(ResourceRepository resourceRepository) {
        this.resourceRepository = resourceRepository;
    }

    @Override
    public ResourceResponseDTO createResource(ResourceRequestDTO requestDTO) {
        Resource resource = mapToEntity(requestDTO);
        Resource saved = resourceRepository.save(resource);
        return mapToResponse(saved);
    }

    @Override
    public List<ResourceResponseDTO> getAllResources() {
        return resourceRepository.findAll()
                .stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
    }

    @Override
    public ResourceResponseDTO getResourceById(Long id) {
        Resource resource = resourceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found with id: " + id));
        return mapToResponse(resource);
    }

    @Override
    public ResourceResponseDTO updateResource(Long id, ResourceRequestDTO requestDTO) {
        Resource existing = resourceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found with id: " + id));

        existing.setName(requestDTO.getName());
        existing.setType(requestDTO.getType());
        existing.setCapacity(requestDTO.getCapacity());
        existing.setLocation(requestDTO.getLocation());
        existing.setAvailableFrom(requestDTO.getAvailableFrom());
        existing.setAvailableTo(requestDTO.getAvailableTo());
        existing.setStatus(requestDTO.getStatus());
        existing.setDescription(requestDTO.getDescription());
        existing.setImageUrl(requestDTO.getImageUrl());

        Resource updated = resourceRepository.save(existing);
        return mapToResponse(updated);
    }

    @Override
    public void deleteResource(Long id) {
        Resource existing = resourceRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Resource not found with id: " + id));
        resourceRepository.delete(existing);
    }

    private Resource mapToEntity(ResourceRequestDTO requestDTO) {
        Resource resource = new Resource();
        resource.setName(requestDTO.getName());
        resource.setType(requestDTO.getType());
        resource.setCapacity(requestDTO.getCapacity());
        resource.setLocation(requestDTO.getLocation());
        resource.setAvailableFrom(requestDTO.getAvailableFrom());
        resource.setAvailableTo(requestDTO.getAvailableTo());
        resource.setStatus(requestDTO.getStatus());
        resource.setDescription(requestDTO.getDescription());
        resource.setImageUrl(requestDTO.getImageUrl());
        return resource;
    }

    private ResourceResponseDTO mapToResponse(Resource resource) {
        ResourceResponseDTO responseDTO = new ResourceResponseDTO();
        responseDTO.setId(resource.getId());
        responseDTO.setName(resource.getName());
        responseDTO.setType(resource.getType());
        responseDTO.setCapacity(resource.getCapacity());
        responseDTO.setLocation(resource.getLocation());
        responseDTO.setAvailableFrom(resource.getAvailableFrom());
        responseDTO.setAvailableTo(resource.getAvailableTo());
        responseDTO.setStatus(resource.getStatus());
        responseDTO.setDescription(resource.getDescription());
        responseDTO.setImageUrl(resource.getImageUrl());
        return responseDTO;
    }
}
