package com.supplierplatform.auth;

import com.supplierplatform.auth.dto.AuthResponse;
import com.supplierplatform.auth.dto.LoginRequest;
import com.supplierplatform.auth.dto.RegisterRequest;
import com.supplierplatform.common.EntityNotFoundException;
import com.supplierplatform.security.JwtUtil;
import com.supplierplatform.supplier.SupplierProfileService;
import com.supplierplatform.user.User;
import com.supplierplatform.user.UserRepository;
import com.supplierplatform.user.UserService;
import com.supplierplatform.validation.EmailValidators;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class AuthService {
    private final UserRepository userRepository;
    private final UserService userService;
    private final SupplierProfileService supplierProfileService;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    @Transactional
    public AuthResponse login(LoginRequest request) {
        String normalizedEmail = EmailValidators.normalize(request.getEmail());
        User user = userRepository.findByEmailIgnoreCase(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("Email not found"));
        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            throw new IllegalArgumentException("Wrong password");
        }
        if (!Boolean.TRUE.equals(user.getIsActive())) {
            throw new IllegalStateException("User is inactive");
        }
        userService.updateLastLogin(user.getId());

        String token = jwtUtil.generateToken(user);

        return AuthResponse.builder()
                .token(token)
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .build();
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        String normalizedEmail = EmailValidators.normalize(request.getEmail());
        if (!EmailValidators.hasValidDomainSuffix(normalizedEmail)) {
            throw new IllegalArgumentException("Email must include a valid domain suffix (e.g. .com, .it)");
        }
        if (userRepository.existsByEmailIgnoreCase(normalizedEmail)) {
            throw new IllegalStateException("Email is already in use: " + normalizedEmail);
        }
        request.setEmail(normalizedEmail);

        User user = userService.createSupplierUser(request);
        supplierProfileService.createProfile(user);

        String token = jwtUtil.generateToken(user);

        return AuthResponse.builder()
                .token(token)
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .build();
    }

    @Transactional
    public AuthResponse acceptInvite(String token, String password) {
        User user = userRepository.findByInviteToken(token)
                .orElseThrow(() -> new EntityNotFoundException("User with invite token not found"));

        if (user.getInviteExpiresAt() == null || LocalDateTime.now().isAfter(user.getInviteExpiresAt())) {
            throw new IllegalStateException("Invite token has expired");
        }

        user.setPasswordHash(passwordEncoder.encode(password));
        user.setIsActive(true);
        user.setInviteToken(null);
        user.setInviteExpiresAt(null);
        userRepository.save(user);

        String jwtToken = jwtUtil.generateToken(user);

        return AuthResponse.builder()
                .token(jwtToken)
                .userId(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .role(user.getRole())
                .build();
    }
}
