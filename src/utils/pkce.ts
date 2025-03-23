export async function generatePKCEChallenge(): Promise<{ verifier: string; challenge: string }> {
  // Generate a random verifier
  const verifier = generateRandomString(128);
  
  // Create the challenge using SHA-256
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  
  // Base64-URL encode the challenge
  const challenge = base64URLEncode(new Uint8Array(digest));
  
  return { verifier, challenge };
}

function generateRandomString(length: number): string {
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = new Uint8Array(length);
  crypto.getRandomValues(values);
  
  let result = '';
  for (let i = 0; i < length; i++) {
    result += possible[values[i] % possible.length];
  }
  
  return result;
}

function base64URLEncode(buffer: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
} 