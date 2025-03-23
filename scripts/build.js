const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const config = {
  development: {
    env: 'development',
    outDir: './out',
    publicDir: './public',
  },
  production: {
    env: 'production',
    outDir: './out',
    publicDir: './public',
  }
};

async function build() {
  try {
    const env = process.env.NODE_ENV || 'development';
    const buildConfig = config[env];
    
    console.log(`🚀 Starting ${env} build...`);

    // Clean previous build
    console.log('🧹 Cleaning previous build...');
    await fs.remove(buildConfig.outDir);

    // Install dependencies if needed
    console.log('📦 Installing dependencies...');
    execSync('npm install', { stdio: 'inherit' });

    // Skip type checking for now
    // console.log('🔍 Running type checks...');
    // execSync('tsc --noEmit', { stdio: 'inherit' });

    // Skip linting for now
    // console.log('🎨 Running linting...');
    // execSync('npm run lint', { stdio: 'inherit' });

    // Build the application
    console.log('🏗️ Building application...');
    execSync('next build', { stdio: 'inherit' });

    // Export static files for cPanel
    console.log('📤 Exporting static files...');
    execSync('next export', { stdio: 'inherit' });

    // Copy public assets
    console.log('📂 Copying public assets...');
    await fs.copy(buildConfig.publicDir, path.join(buildConfig.outDir, 'public'));

    // Create .htaccess for cPanel
    if (env === 'production') {
      console.log('📝 Creating .htaccess...');
      const htaccess = `
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteCond %{REQUEST_FILENAME} !-l
    RewriteRule . /index.html [L]
</IfModule>

# Enable compression
<IfModule mod_deflate.c>
    AddOutputFilterByType DEFLATE text/plain
    AddOutputFilterByType DEFLATE text/html
    AddOutputFilterByType DEFLATE text/xml
    AddOutputFilterByType DEFLATE text/css
    AddOutputFilterByType DEFLATE application/xml
    AddOutputFilterByType DEFLATE application/xhtml+xml
    AddOutputFilterByType DEFLATE application/rss+xml
    AddOutputFilterByType DEFLATE application/javascript
    AddOutputFilterByType DEFLATE application/x-javascript
</IfModule>

# Set caching headers
<IfModule mod_expires.c>
    ExpiresActive On
    ExpiresByType image/jpg "access plus 1 year"
    ExpiresByType image/jpeg "access plus 1 year"
    ExpiresByType image/gif "access plus 1 year"
    ExpiresByType image/png "access plus 1 year"
    ExpiresByType image/webp "access plus 1 year"
    ExpiresByType text/css "access plus 1 month"
    ExpiresByType application/javascript "access plus 1 month"
    ExpiresByType image/x-icon "access plus 1 year"
    ExpiresDefault "access plus 2 days"
</IfModule>
`;
      await fs.writeFile(path.join(buildConfig.outDir, '.htaccess'), htaccess);
    }

    // Create deployment package
    if (env === 'production') {
      console.log('📦 Creating deployment package...');
      execSync(`cd ${buildConfig.outDir} && zip -r ../deploy.zip .`, { stdio: 'inherit' });
    }

    console.log('✅ Build completed successfully!');
    console.log(`📁 Output directory: ${path.resolve(buildConfig.outDir)}`);
    
    if (env === 'production') {
      console.log('📝 Deployment instructions:');
      console.log('1. Upload the contents of the "out" directory to your cPanel hosting');
      console.log('2. Ensure the domain points to the public_html directory');
      console.log('3. Set up environment variables in cPanel if needed');
      console.log('4. Test the application by visiting your domain');
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build(); 