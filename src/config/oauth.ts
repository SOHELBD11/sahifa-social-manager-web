export const oauthConfig = {
  facebook: {
    authUrl: 'https://www.facebook.com/v18.0/dialog/oauth',
    scope: ['pages_show_list', 'pages_read_engagement', 'pages_manage_posts', 'instagram_basic'],
    responseType: 'code',
  },
  instagram: {
    // Instagram uses Facebook OAuth
    authUrl: 'https://api.instagram.com/oauth/authorize',
    scope: ['instagram_basic', 'instagram_content_publish'],
    responseType: 'code',
  },
  twitter: {
    authUrl: 'https://twitter.com/i/oauth2/authorize',
    scope: ['tweet.read', 'tweet.write', 'users.read'],
    responseType: 'code',
    clientType: 'web',
    codeChallenge: true,
    codeChallengeMethod: 'S256',
  },
  linkedin: {
    authUrl: 'https://www.linkedin.com/oauth/v2/authorization',
    scope: ['r_liteprofile', 'r_organization_social', 'w_organization_social'],
    responseType: 'code',
  },
}; 