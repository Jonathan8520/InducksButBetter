const { execSync } = require('child_process');
const fs = require('fs');

try {
  console.log("1. Initializing Git repository...");
  execSync('git init', { stdio: 'inherit' });
  execSync('git add .', { stdio: 'inherit' });
  execSync('git commit -m "Initial commit"', { stdio: 'inherit' });

  console.log("\\n2. Creating GitHub repository...");
  execSync('gh repo create InducksButBetter --public --source=. --remote=origin', { stdio: 'inherit' });

  console.log("\\n3. Reading .env and setting secrets...");
  let dbUrl = '';
  let authToken = '';

  if (fs.existsSync('.env')) {
    const envContent = fs.readFileSync('.env', 'utf8');
    envContent.split('\\n').forEach(line => {
      if (line.startsWith('VITE_TURSO_DATABASE_URL=')) {
        dbUrl = line.split('=')[1].trim();
      }
      if (line.startsWith('VITE_TURSO_AUTH_TOKEN=')) {
        authToken = line.split('=')[1].trim();
      }
    });
  }

  if (!dbUrl || !authToken) {
    console.warn("WARNING: Could not find VITE_TURSO_DATABASE_URL or VITE_TURSO_AUTH_TOKEN in .env");
  } else {
    execSync(`gh secret set VITE_TURSO_DATABASE_URL --body "${dbUrl}"`, { stdio: 'inherit' });
    execSync(`gh secret set VITE_TURSO_AUTH_TOKEN --body "${authToken}"`, { stdio: 'inherit' });
    console.log("Secrets set successfully!");
  }

  console.log("\\n4. Pushing code to GitHub...");
  execSync('git branch -M main', { stdio: 'inherit' });
  execSync('git push -u origin main', { stdio: 'inherit' });

  console.log("\\nDone! The deployment action should now trigger on GitHub.");
} catch (error) {
  console.error("An error occurred during setup:", error.message);
}
