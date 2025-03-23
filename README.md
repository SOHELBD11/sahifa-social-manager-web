# Sahifa Social Manager Web Platform

![Build Status](https://github.com/SOHELBD11/sahifa-social-manager-web/actions/workflows/build.yml/badge.svg)

## Setup Instructions

### Prerequisites
- Node.js 16.x or later
- npm 7.x or later
- Git
- GitHub account
- cPanel hosting account

### Local Development
1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env.local` file with required environment variables
4. Run development server:
   ```bash
   npm run dev
   ```

### Remote Build & Deployment

This project uses GitHub Actions for automated building and deployment. To set this up:

1. Push your code to GitHub
2. Add the following secrets to your GitHub repository (Settings > Secrets and variables > Actions):
   - `NEXT_PUBLIC_API_URL`: Your API URL
   - `NEXT_PUBLIC_FIREBASE_CONFIG`: Your Firebase configuration
   - `FTP_SERVER`: Your cPanel FTP server address
   - `FTP_USERNAME`: Your cPanel FTP username
   - `FTP_PASSWORD`: Your cPanel FTP password

3. The build will automatically run when you push to the main branch

### Build Commands
- Development build: `npm run build:dev`
- Production build: `npm run build:prod`
- Type checking: `npm run type-check`
- Linting: `npm run lint`

### Deployment
The built files will be automatically deployed to your cPanel hosting via FTP.
The deployment directory is set to `public_html/` by default.

## Environment Variables

Required environment variables:
```
NEXT_PUBLIC_API_URL=your_api_url
NEXT_PUBLIC_FIREBASE_CONFIG=your_firebase_config
```

## Support

For any issues or questions, please create an issue in the GitHub repository. 