package com.examplatform.auth.crypto;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;

public final class Jwks {

    private Jwks() {
    }

    public static JWK generateRsa() {
        try {
            return new RSAKeyGenerator(2048)
                    .keyID("exam-rsa-key")
                    .generate();
        } catch (JOSEException e) {
            throw new IllegalStateException("Unable to generate RSA key", e);
        }
    }
}


