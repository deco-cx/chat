import { decodeJwt, type JWTPayload, jwtVerify, SignJWT } from "jose";
export type { JWTPayload };
import { env } from "cloudflare:workers";

export const alg = "RSASSA-PKCS1-v1_5";
export const hash = "SHA-256";

const PUBLIC_KEY_ENV_VAR = "DECO_CHAT_API_JWT_PUBLIC_KEY";
const PRIVATE_KEY_ENV_VAR = "DECO_CHAT_API_JWT_PRIVATE_KEY";

const generateKeyPair = async (): Promise<[JsonWebKey, JsonWebKey]> => {
  const keyPair: CryptoKeyPair = (await crypto.subtle.generateKey(
    {
      name: alg,
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash,
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;

  return await Promise.all([
    crypto.subtle.exportKey("jwk", keyPair.publicKey) as Promise<JsonWebKey>,
    crypto.subtle.exportKey("jwk", keyPair.privateKey) as Promise<JsonWebKey>,
  ]);
};

export const stringifyJWK = (jwk: JsonWebKey): string =>
  btoa(JSON.stringify(jwk));
export const parseJWK = (jwk: string): JsonWebKey => JSON.parse(atob(jwk));
export const importJWK = (
  jwk: JsonWebKey,
  usages?: string[],
): Promise<CryptoKey> =>
  crypto.subtle.importKey(
    // @ts-ignore: deno types are not up to date
    "jwk",
    jwk,
    { name: alg, hash },
    true,
    usages ?? ["sign"],
  );

const getOrGenerateKeyPair = async (): Promise<[JsonWebKey, JsonWebKey]> => {
  const _env = env as {
    DECO_CHAT_API_JWT_PUBLIC_KEY?: string;
    DECO_CHAT_API_JWT_PRIVATE_KEY?: string;
  };
  const publicKeyEnvValue = _env[PUBLIC_KEY_ENV_VAR];
  const privateKeyEnvValue = _env[PRIVATE_KEY_ENV_VAR];
  if (!publicKeyEnvValue || !privateKeyEnvValue) {
    return await generateKeyPair();
  }
  return [parseJWK(publicKeyEnvValue), parseJWK(privateKeyEnvValue)];
};
// Generate an RSA key pair
export let keys: null | Promise<[JsonWebKey, JsonWebKey]> = null;

export const setFromString = (publicKey: string, privateKey: string) => {
  if (!publicKey || !privateKey) {
    return;
  }
  keys ??= Promise.resolve([parseJWK(publicKey), parseJWK(privateKey)]);
};

export const getKeyPair = async () => {
  keys ??= getOrGenerateKeyPair();
  return await keys;
};

export const DECO_CHAT_KEY_ID = "deco-chat-api-key";

export async function createJWT<
  TClaims extends Record<string, unknown> = Record<string, unknown>,
>(
  payload: JwtPayloadWithClaims<TClaims>,
  secret: CryptoKey,
  expiresIn?: number | string | Date,
): Promise<string> {
  let jwt = new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: DECO_CHAT_KEY_ID })
    .setIssuedAt();
  if (expiresIn) {
    jwt = jwt.setExpirationTime(expiresIn);
  }

  return await jwt.sign(secret);
}

export async function verifyJWT<
  TClaims extends Record<string, unknown> = Record<string, unknown>,
>(token: string, secret: string): Promise<JwtPayloadWithClaims<TClaims>> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
  return payload as JwtPayloadWithClaims<TClaims>;
}

const DECO_CHAT_ISSUER = "https://api.deco.chat";

export type JwtPayloadWithClaims<
  TClaims extends Record<string, unknown> = Record<string, unknown>,
> = JWTPayload & TClaims;

export interface JwtVerifier {
  verify: <TClaims extends Record<string, unknown> = Record<string, unknown>>(
    jwt: string,
  ) => Promise<JwtPayloadWithClaims<TClaims> | undefined>;
  decode: <TClaims extends Record<string, unknown> = Record<string, unknown>>(
    jwt: string,
  ) => JwtPayloadWithClaims<TClaims>;
}

export interface JwtIssuer extends JwtVerifier {
  issue: <TClaims extends Record<string, unknown> = Record<string, unknown>>(
    payload: JwtPayloadWithClaims<TClaims>,
  ) => Promise<string>;
}

export interface JwtIssuerKeyPair {
  public: string | JsonWebKey;
  private: string | JsonWebKey;
}

const newJwtVerifier = (key: CryptoKey): JwtVerifier => {
  return {
    verify: async <
      TClaims extends Record<string, unknown> = Record<string, unknown>,
    >(
      str: string,
    ) => {
      try {
        const result = await jwtVerify(str, key);
        return result.payload as JwtPayloadWithClaims<TClaims>;
      } catch {
        return undefined;
      }
    },
    decode: <TClaims extends Record<string, unknown> = Record<string, unknown>>(
      str: string,
    ) => {
      return decodeJwt<TClaims>(str);
    },
  };
};
export const importJWKFromString = (
  jwk: string,
  usages?: string[],
): Promise<CryptoKey> => importJWK(parseJWK(jwk), usages);

const importKey = (
  key: string | JsonWebKey,
  usages: string[],
): Promise<CryptoKey> => {
  if (typeof key === "string") {
    return importJWKFromString(key, usages);
  }
  return importJWK(key, usages);
};
const newJwtVerifierWithJWK = async (
  pubKey: string | JsonWebKey,
): Promise<JwtVerifier> => {
  const pub = await importKey(pubKey, ["verify"]);
  return newJwtVerifier(pub);
};

const jwtKeyPair = (): Promise<JwtIssuerKeyPair> => {
  return getKeyPair().then(([pub, priv]) => ({ public: pub, private: priv }));
};
export const JwtIssuer = {
  forKeyPair: async (
    keyPair?: JwtIssuerKeyPair,
    issuer: string = DECO_CHAT_ISSUER,
  ): Promise<JwtIssuer> => {
    const { public: pubkey, private: privkey } =
      keyPair || (await jwtKeyPair());
    const [verifier, priv] = await Promise.all([
      newJwtVerifierWithJWK(pubkey),
      importKey(privkey, ["sign"]),
    ]);
    return {
      ...verifier,
      issue: (payload) => {
        return createJWT({ ...payload, iss: issuer }, priv);
      },
    };
  },
};
